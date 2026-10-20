import { describe, expect, it } from 'vitest';
import { CHARGE_HALF_W } from '../../../games/squad/sim/constants.ts';
import { bossDamageFactor } from '../../../games/squad/sim/signature.ts';
import { createState, type GameState } from '../../../games/squad/sim/state.ts';
import { step } from '../../../games/squad/sim/step.ts';
import { DT, makeLevel } from '../fixtures.ts';

// A level whose boss appears at t=2 and settles at t=4 (length 10, speed 10),
// with a huge health pool so it outlives the test.
function bossLevel(extra: Record<string, unknown>, startSquad = 30) {
  return makeLevel({ startSquad, length: 10, boss: { hp: 1e9, pattern: 'single', fireEvery: 100, ...extra } });
}

// Steps for `seconds`, clearing shells so only the signature attack matters.
function run(s: GameState, seconds: number, targetX: number | ((s: GameState) => number) = 0, each?: (s: GameState) => void) {
  const events: GameState['events'] = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    step(s, { targetX: typeof targetX === 'number' ? targetX : targetX(s) }, DT);
    events.push(...s.events);
    s.projectiles = [];
    each?.(s);
  }
  return events;
}

describe('strafer', () => {
  it('slides side to side within reach of the road edges', () => {
    const s = createState(bossLevel({ signature: 'strafe' }), 1);
    run(s, 4);
    const xs: number[] = [];
    run(s, 20, 0, (st) => xs.push(st.boss!.x));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(-0.6);
    expect(Math.max(...xs)).toBeLessThanOrEqual(0.6);
    expect(Math.min(...xs)).toBeLessThan(-0.5);
    expect(Math.max(...xs)).toBeGreaterThan(0.5);
  });

  it('slides faster once enraged', () => {
    const cycle = (enraged: boolean) => {
      const s = createState(bossLevel({ signature: 'strafe' }), 1);
      run(s, 4);
      if (enraged) s.boss!.hp = s.boss!.maxHp * 0.4;
      // Time between two upward crossings of the centre line.
      const crossings: number[] = [];
      let last = s.boss!.x;
      run(s, 15, 0, (st) => {
        if (last < 0 && st.boss!.x >= 0) crossings.push(st.time);
        last = st.boss!.x;
      });
      return crossings[1] - crossings[0];
    };
    expect(cycle(false)).toBeCloseTo(6, 1);
    expect(cycle(true)).toBeCloseTo(4, 1);
  });

  it('a boss without a signature holds the centre', () => {
    const s = createState(bossLevel({}), 1);
    run(s, 4);
    run(s, 10, 0, (st) => expect(st.boss!.x).toBe(0));
  });
});

describe('charger', () => {
  const charger = (extra: Record<string, unknown> = {}, squad = 30) => {
    const s = createState(bossLevel({ signature: 'charge', chargeEvery: 7, ...extra }, squad), 1);
    return s;
  };
  // Settles the boss with the squad at `x`, then starts a charge at once.
  const startCharge = (s: GameState, x: number) => {
    run(s, 4.5, x); // settled
    s.boss!.signatureTimer = 0;
  };
  const stage = (s: GameState) => (s.boss!.attack?.kind === 'charge' ? s.boss!.attack.stage : null);
  // Steers to the far side of any charge stripe, otherwise holds `x`.
  const dodging = (x: number) => (s: GameState) => {
    const a = s.boss?.attack;
    return a?.kind === 'charge' ? (a.laneX > 0 ? -0.75 : 0.75) : x;
  };

  it('warns on the squad\'s lane for at least a second before the lunge', () => {
    const s = charger();
    startCharge(s, 0.3);
    let warnedAt = -1;
    let lungedAt = -1;
    run(s, 3, 0.3, (st) => {
      if (warnedAt < 0 && stage(st) === 'warn') warnedAt = st.time;
      if (lungedAt < 0 && st.events.some((e) => e.type === 'bossCharge')) lungedAt = st.time;
    });
    expect(lungedAt - warnedAt).toBeGreaterThanOrEqual(1);
    const s2 = charger();
    startCharge(s2, 0.3);
    run(s2, DT, 0.3);
    expect(s2.boss!.attack).toMatchObject({ kind: 'charge', stage: 'warn' });
    if (s2.boss!.attack?.kind === 'charge') expect(s2.boss!.attack.laneX).toBeCloseTo(s2.squad.x, 2);
  });

  it('keeps the stripe on the road at the edge', () => {
    const s = charger();
    startCharge(s, 1);
    run(s, DT, 1);
    if (s.boss!.attack?.kind === 'charge') expect(s.boss!.attack.laneX).toBeLessThanOrEqual(1 - CHARGE_HALF_W);
  });

  it('the lunge hits soldiers in the stripe and misses a squad that got out', () => {
    const stay = charger();
    startCharge(stay, 0);
    const hits = run(stay, 2, 0).filter((e) => e.type === 'lose');
    expect(hits).toContainEqual(expect.objectContaining({ cause: 'bossCharge' }));

    const dodge = charger();
    startCharge(dodge, 0);
    const dodged = run(dodge, 2, 0.75).filter((e) => e.type === 'lose');
    expect(dodged).toHaveLength(0);
    expect(dodge.phase).toBe('boss');
  });

  it('is exposed after the lunge and takes double damage', () => {
    const s = charger();
    startCharge(s, 0.6);
    run(s, 1.7, dodging(0.6));
    expect(stage(s)).toBe('exposed');
    expect(bossDamageFactor(s)).toBe(2);
    run(s, 4, dodging(0.6));
    expect(stage(s)).toBeNull();
    expect(bossDamageFactor(s)).toBe(1);
  });

  it('a squad firing at the exposed boss deals about twice the damage', () => {
    const damage = (exposed: boolean) => {
      const s = charger({}, 40);
      run(s, 4.5, 0);
      if (exposed) s.boss!.attack = { kind: 'charge', stage: 'exposed', t: -100, laneX: 0, fromX: 0, fromZ: 18 };
      const before = s.boss!.hp;
      run(s, 1, 0);
      return before - s.boss!.hp;
    };
    expect(damage(true) / damage(false)).toBeGreaterThan(1.7);
    expect(damage(true) / damage(false)).toBeLessThan(2.3);
  });

  it('fires no volleys while charging', () => {
    const s = charger({ fireEvery: 0.5 });
    startCharge(s, 0.75);
    const events: GameState['events'] = [];
    run(s, 5.5, 0.75, (st) => {
      if (stage(st) !== null) events.push(...st.events);
    });
    expect(events.filter((e) => e.type === 'bossCharge')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'bossFire')).toHaveLength(0);
  });

  it('reaching the squad is not boss contact unless every soldier is in the stripe', () => {
    const s = charger({ advance: 0.5 });
    startCharge(s, 0);
    const events = run(s, 2, 0.5);
    expect(events.filter((e) => e.type === 'lose' && e.cause === 'bossContact')).toHaveLength(0);
    expect(s.phase).toBe('boss');
  });

  it('charges more often once enraged', () => {
    const gap = (enraged: boolean) => {
      const s = charger();
      run(s, 4.5, 0.75);
      if (enraged) s.boss!.hp = s.boss!.maxHp * 0.4;
      const times: number[] = [];
      run(s, 40, dodging(0.75), (st) => {
        if (st.events.some((e) => e.type === 'bossCharge')) times.push(st.time);
      });
      return times[2] - times[1];
    };
    // Interval plus the charge itself (warning 1.2 + lunge 0.4 + exposed 2.5 + return 1).
    expect(gap(false)).toBeCloseTo(7 + 5.1, 1);
    expect(gap(true)).toBeCloseTo(7 * 0.7 + 5.1, 1);
  });

  it('a boss killed while exposed stays dead: no later losses', () => {
    const s = createState(bossLevel({ signature: 'charge', chargeEvery: 7, hp: 1e9 }, 40), 1);
    startCharge(s, 0.6);
    run(s, 1.7, dodging(0.6));
    s.boss!.hp = 1;
    const events = run(s, 3, 0);
    expect(s.phase).toBe('won');
    expect(events.filter((e) => e.type === 'lose')).toHaveLength(0);
  });
});
