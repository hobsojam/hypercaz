import { describe, expect, it } from 'vitest';
import { BARRAGE_GAP, BARRAGE_MAX_SHIFT, BARRAGE_WARN, CHARGE_HALF_W, SHIELD_BURST, SHIELD_DAMAGE } from '../../../games/squad/sim/constants.ts';
import { botInput } from '../../../games/squad/sim/bot.ts';
import { formationHalfWidth, formationSlots } from '../../../games/squad/sim/formation.ts';
import { absorbHit, bossDamageFactor } from '../../../games/squad/sim/signature.ts';
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

describe('fortress', () => {
  const fortress = (extra: Record<string, unknown> = {}, seed = 1, squad = 7) =>
    createState(bossLevel({ signature: 'fortress', shieldHp: 1e9, ...extra }, squad), seed);
  // Stands in each barrage's gap; otherwise holds the centre.
  const inGap = (s: GameState) => (s.boss?.attack?.kind === 'barrage' ? s.boss.attack.gapX : 0);
  const kinds = (events: GameState['events']) =>
    events.map((e) => e.type).filter((t) => ['bossBarrage', 'shieldUp', 'shieldBreak'].includes(t));

  it('fires its opening volley, then alternates barrages with a shield', () => {
    const s = fortress();
    const first = run(s, 20, inGap);
    expect(first.filter((e) => e.type === 'bossFire')).toHaveLength(1);
    expect(kinds(first)).toEqual(['bossBarrage', 'bossBarrage', 'bossBarrage', 'shieldUp']);
    if (s.boss!.attack?.kind === 'shield') s.boss!.attack.hp = 0.5;
    const after = run(s, 7, inGap);
    expect(kinds(after).slice(0, 2)).toEqual(['shieldBreak', 'bossBarrage']);
    expect(after.filter((e) => e.type === 'bossFire')).toHaveLength(0);
  });

  it('is stunned for four seconds after the shield breaks', () => {
    const s = fortress();
    run(s, 20, inGap);
    if (s.boss!.attack?.kind === 'shield') s.boss!.attack.hp = 0.5;
    let broke = -1;
    let next = -1;
    run(s, 7, inGap, (st) => {
      if (st.events.some((e) => e.type === 'shieldBreak')) broke = st.time;
      if (broke > 0 && next < 0 && st.events.some((e) => e.type === 'bossBarrage')) next = st.time;
    });
    expect(next - broke).toBeCloseTo(4, 1);
  });

  it('enraged, it fires two barrages per phase', () => {
    const s = fortress();
    run(s, 4.5, inGap);
    s.boss!.hp = s.boss!.maxHp * 0.4;
    expect(kinds(run(s, 20, inGap))).toEqual(['bossBarrage', 'bossBarrage', 'shieldUp']);
  });

  it('shows each barrage for at least 1.5 s before it lands, with the warning glow', () => {
    const s = fortress();
    run(s, 20, inGap, (st) => {
      if (st.boss?.attack?.kind === 'barrage' && st.boss.attack.t <= BARRAGE_WARN) expect(st.boss.charging).toBe(true);
      if (st.events.some((e) => e.type === 'bossBarrage') && st.boss!.attack?.kind === 'barrage') {
        expect(st.boss!.attack.t).toBeGreaterThanOrEqual(BARRAGE_WARN - 2 * DT);
      }
    });
  });

  it('always leaves a reachable gap on the road', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = fortress({}, seed);
      const gaps: number[] = [];
      run(s, 20, inGap, (st) => {
        if (st.events.some((e) => e.type === 'bossBarrage') && st.boss!.attack?.kind === 'barrage') gaps.push(st.boss!.attack.gapX);
      });
      expect(gaps).toHaveLength(3);
      for (const g of gaps) expect(Math.abs(g)).toBeLessThanOrEqual(1 - BARRAGE_GAP / 2);
      for (let i = 1; i < gaps.length; i++) expect(Math.abs(gaps[i] - gaps[i - 1])).toBeLessThanOrEqual(BARRAGE_MAX_SHIFT + 1e-9);
    }
  });

  it('spares a squad in the gap and hits one outside it', () => {
    const safe = fortress();
    const safeLosses = run(safe, 13, inGap).filter((e) => e.type === 'lose');
    expect(safeLosses).toHaveLength(0);
    const exposed = fortress({}, 1, 30);
    const away = (st: GameState) => (st.boss?.attack?.kind === 'barrage' ? (st.boss.attack.gapX > 0 ? -0.75 : 0.75) : 0);
    const hits = run(exposed, 13, away).filter((e) => e.type === 'lose');
    expect(hits).toContainEqual(expect.objectContaining({ cause: 'bossShot' }));
  });

  it('a shield takes the damage: 20% reaches the boss, Rapid Fire hits the shield three times as hard', () => {
    const s = fortress();
    run(s, 20, inGap);
    const shield = s.boss!.attack;
    expect(shield?.kind).toBe('shield');
    if (shield?.kind !== 'shield') return;
    expect(bossDamageFactor(s)).toBe(SHIELD_DAMAGE);
    const before = shield.hp;
    expect(absorbHit(s, 10)).toBeCloseTo(10 * SHIELD_DAMAGE);
    expect(before - shield.hp).toBeCloseTo(10);
    s.burstTime = 1;
    absorbHit(s, 10);
    expect(before - shield.hp).toBeCloseTo(10 + 10 * SHIELD_BURST);
  });

  it('a broken shield leaves the boss open to full damage', () => {
    const s = fortress();
    run(s, 20, inGap);
    expect(absorbHit(s, 2e9)).toBeCloseTo(2e9 * SHIELD_DAMAGE);
    expect(s.boss!.attack?.kind).toBe('stunned');
    expect(absorbHit(s, 10)).toBe(10);
  });

  it('summons only while shielded or stunned', () => {
    const s = fortress({ summonEvery: 1, summonCount: 1, summonHp: 1 });
    run(s, 30, inGap, (st) => {
      if (st.events.some((e) => e.type === 'bossSummon')) expect(['shield', 'stunned']).toContain(st.boss!.attack?.kind);
      // Break the shield late on, so the stunned phase is covered too.
      if (st.time > 22 && st.boss!.attack?.kind === 'shield') st.boss!.attack.hp = 0.5;
    });
  });

  it('the same seed gives the same gaps', () => {
    const gaps = (seed: number) => {
      const s = fortress({}, seed);
      const out: number[] = [];
      run(s, 20, inGap, (st) => {
        if (st.events.some((e) => e.type === 'bossBarrage') && st.boss!.attack?.kind === 'barrage') out.push(st.boss!.attack.gapX);
      });
      return out;
    };
    expect(gaps(3)).toEqual(gaps(3));
    expect(gaps(3)).not.toEqual(gaps(4));
  });
});

describe('the bot', () => {
  const fighting = (extra: Record<string, unknown>, squad = 30) => {
    const s = createState(bossLevel(extra, squad), 1);
    run(s, 4.5, 0);
    return s;
  };

  it.each([0, 0.5, -0.65])('steps out of a charge stripe on lane %d', (lane) => {
    const s = fighting({ signature: 'charge', chargeEvery: 7 });
    s.squad.x = lane;
    s.boss!.attack = { kind: 'charge', stage: 'warn', t: 0.2, laneX: lane, fromX: 0, fromZ: 18 };
    const hw = formationHalfWidth(formationSlots(s.squad.count));
    expect(Math.abs(botInput(s).targetX - lane)).toBeGreaterThanOrEqual(CHARGE_HALF_W + hw);
  });

  it('holds its spot outside the stripe until the lunge is over', () => {
    const s = fighting({ signature: 'charge', chargeEvery: 7 });
    s.squad.x = 0.7;
    s.boss!.x = 0;
    s.boss!.attack = { kind: 'charge', stage: 'warn', t: 0.5, laneX: 0, fromX: 0, fromZ: 18 };
    expect(botInput(s).targetX).toBeCloseTo(0.7);
  });

  it('heads for a showing barrage\'s gap', () => {
    const s = fighting({ signature: 'fortress', shieldHp: 100 });
    s.boss!.attack = { kind: 'barrage', t: 1, gapX: -0.6, left: 2 };
    expect(botInput(s).targetX).toBeCloseTo(-0.6);
  });

  it('saves Rapid Fire for a Fortress shield', () => {
    const s = fighting({ signature: 'fortress', shieldHp: 100 });
    s.meter = s.level.burstKills;
    s.boss!.attack = { kind: 'stunned', t: 2 };
    expect(botInput(s).burst).toBe(false);
    s.boss!.attack = { kind: 'shield', hp: 100, maxHp: 100 };
    expect(botInput(s).burst).toBe(true);
  });
});
