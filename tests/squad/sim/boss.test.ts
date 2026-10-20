import { describe, expect, it } from 'vitest';
import { updateBoss } from '../../../games/squad/sim/boss.ts';
import { BOSS_WINDUP } from '../../../games/squad/sim/constants.ts';
import { changeCount } from '../../../games/squad/sim/contact.ts';
import { createState, type GameState } from '../../../games/squad/sim/state.ts';
import { step } from '../../../games/squad/sim/step.ts';
import { DT, makeLevel } from '../fixtures.ts';

function runCollect(s: GameState, seconds: number, targetX = 0, { noShells = false } = {}) {
  const events: GameState['events'] = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    step(s, { targetX }, DT);
    events.push(...s.events);
    if (noShells) s.projectiles = [];
  }
  return events;
}

describe('boss', () => {
  it('arrives after the road ends and settles at its fighting distance', () => {
    const s = createState(makeLevel({ length: 100, boss: { hp: 100000, pattern: 'single', fireEvery: 100 } }), 1);
    const events = runCollect(s, 10.05);
    expect(s.boss).not.toBeNull();
    expect(events.filter((e) => e.type === 'bossArrive')).toHaveLength(1);
    runCollect(s, 4);
    expect(s.boss!.z).toBeCloseTo(18);
  });

  it('keeps each shell launch position when the boss moves after firing', () => {
    const s = createState(makeLevel({ boss: { hp: 100, pattern: 'volley3', fireEvery: 2 } }), 7);
    s.phase = 'boss';
    s.squad.x = -0.7;
    s.boss = { hp: 100, maxHp: 100, x: 0.3, z: 18, fireTimer: 0, summonTimer: 5, enraged: false, charging: false, flash: 0 };
    updateBoss(s, 0);
    expect(s.projectiles).toHaveLength(3);
    expect(new Set(s.projectiles.map(p => p.x)).size).toBe(3);
    for (const p of s.projectiles) expect(p).toMatchObject({ originX: 0.3, originZ: 18, z: 18 });
    const targets = s.projectiles.map(p => p.x);
    s.boss.x = -0.3;
    s.boss.z = 12;
    updateBoss(s, 0.1);
    expect(s.projectiles.map(p => p.x)).toEqual(targets);
    for (const p of s.projectiles) expect(p).toMatchObject({ originX: 0.3, originZ: 18, z: 17 });
  });

  it('fires volleys deterministically from the seed', () => {
    const volley = (seed: number) => {
      const s = createState(makeLevel({ length: 10, boss: { hp: 100000, pattern: 'volley3', fireEvery: 1 } }), seed);
      runCollect(s, 1 + 4 + 1.5);
      return s.projectiles.map((p) => p.x);
    };
    const a = volley(7);
    expect(a).toHaveLength(3);
    expect(volley(7)).toEqual(a);
    expect(volley(8)).not.toEqual(a);
  });

  it('a landing projectile kills the soldiers within its radius', () => {
    const s = createState(makeLevel({ startSquad: 11 }), 1);
    s.projectiles = [{ x: 0, z: 0.1, originX: 0, originZ: 18 }];
    step(s, { targetX: 0 }, DT);
    // Rows of 7 + 4: 3 of the front row and all 4 of the second row are in the blast.
    expect(s.squad.count).toBe(4);
    expect(s.projectiles).toHaveLength(0);
    expect(s.events).toContainEqual(expect.objectContaining({ type: 'lose', cause: 'bossShot', amount: 7 }));
  });

  it('a projectile only hits soldiers near where it lands, not its whole column', () => {
    const s = createState(makeLevel({ startSquad: 110 }), 1); // 10 rows of 11
    s.projectiles = [{ x: 0, z: 0.1, originX: 0, originZ: 18 }];
    step(s, { targetX: 0 }, DT);
    expect(110 - s.squad.count).toBeGreaterThanOrEqual(3);
    expect(110 - s.squad.count).toBeLessThanOrEqual(9);
  });

  it('killing the boss wins the level once', () => {
    const s = createState(makeLevel({ startSquad: 10, length: 10, boss: { hp: 10, pattern: 'single', fireEvery: 100 } }), 1);
    const events = runCollect(s, 10);
    expect(s.phase).toBe('won');
    expect(events.filter((e) => e.type === 'won')).toHaveLength(1);
    expect(events).toContainEqual(expect.objectContaining({ type: 'bossDead' }));
    const before = structuredClone(s);
    step(s, { targetX: 0.5 }, DT);
    expect(s).toEqual(before);
  });
});

describe('boss pressure', () => {
  // length 10 at speed 10: the boss arrives at t=1 and settles (z=18) at t=3.
  const boss = (extra: Record<string, unknown>) => ({ hp: 100000, pattern: 'single', fireEvery: 100, ...extra });

  it('advances on the squad once settled, and reaching it loses the level', () => {
    const s = createState(makeLevel({ startSquad: 5, length: 10, boss: boss({ advance: 2 }) }), 1);
    // Shells are cleared so only the boss reaching the squad kills it.
    runCollect(s, 4, 0, { noShells: true });
    expect(s.boss!.z).toBeLessThan(18);
    expect(s.boss!.z).toBeGreaterThan(14);
    const events = runCollect(s, 10, 0, { noShells: true });
    expect(s.phase).toBe('lost');
    expect(s.squad.count).toBe(0);
    expect(events.filter((e) => e.type === 'lost')).toHaveLength(1);
    expect(events).toContainEqual(expect.objectContaining({ type: 'lose', cause: 'bossContact', amount: 5 }));
  });

  it('stays at its fighting distance when it has no advance', () => {
    const s = createState(makeLevel({ startSquad: 5, length: 10, boss: boss({}) }), 1);
    runCollect(s, 12);
    expect(s.boss!.z).toBeCloseTo(18);
    expect(s.phase).toBe('boss');
  });

  it('summons a crowd in front of itself on a timer', () => {
    const s = createState(makeLevel({ length: 10, boss: boss({ summonEvery: 3, summonCount: 8, summonHp: 2 }) }), 1);
    runCollect(s, 5, 0.9);
    expect(s.entities.filter((e) => e.type === 'enemy')).toHaveLength(0);
    const events = runCollect(s, 3.1, 0.9); // squad out of the crowd's lane
    const crowd = s.entities.filter((e) => e.type === 'enemy');
    expect(crowd).toHaveLength(8);
    expect(events.filter((e) => e.type === 'bossSummon')).toHaveLength(1);
    for (const e of crowd) {
      expect(e.hp).toBe(2);
      expect(e.z).toBeLessThan(s.boss!.z);
      expect(Math.abs(e.x)).toBeLessThanOrEqual(0.95);
    }
  });

  it('never summons without summon settings', () => {
    const s = createState(makeLevel({ length: 10, boss: boss({}) }), 1);
    runCollect(s, 20);
    expect(s.entities.filter((e) => e.type === 'enemy')).toHaveLength(0);
  });

  it('enrages once at half health: faster fire and a bigger volley', () => {
    const s = createState(makeLevel({ startSquad: 1, length: 10, boss: boss({ hp: 1000, fireEvery: 2 }) }), 1);
    // Projectiles are cleared each step so the lone soldier survives the volleys.
    const run = (seconds: number) => {
      const events: GameState['events'] = [];
      let volley = 0;
      for (let i = 0; i < Math.round(seconds / DT); i++) {
        step(s, { targetX: 0.9 }, DT);
        events.push(...s.events);
        if (s.projectiles.length > 0) volley = s.projectiles.length;
        s.projectiles = [];
      }
      return { events, volley };
    };
    run(5);
    const calm = run(6);
    s.boss!.hp = 499;
    const angry = run(6);
    expect(angry.events.filter((e) => e.type === 'bossEnrage')).toHaveLength(1);
    const fires = (r: typeof calm) => r.events.filter((e) => e.type === 'bossFire').length;
    expect(fires(angry)).toBeGreaterThan(fires(calm));
    expect(calm.volley).toBe(1);
    expect(angry.volley).toBe(3);
  });

  it('opens fire soon after it appears, after a full warning glow', () => {
    // length 10 at speed 10: the boss appears at t=1.
    const s = createState(makeLevel({ startSquad: 5, length: 10, boss: boss({ fireEvery: 3 }) }), 1);
    const seen: { type: string; t: number }[] = [];
    for (let i = 0; i < Math.round(8 / DT); i++) {
      step(s, { targetX: 0.9 }, DT);
      for (const e of s.events) seen.push({ type: e.type, t: s.time });
    }
    const at = (type: string) => seen.find((e) => e.type === type)!.t;
    expect(at('bossFire') - at('bossArrive')).toBeLessThanOrEqual(4);
    expect(at('bossFire') - at('bossWindup')).toBeCloseTo(BOSS_WINDUP, 1);
  });

  it('glows a warning just before each volley', () => {
    const s = createState(makeLevel({ length: 10, boss: boss({ fireEvery: 2 }) }), 1);
    runCollect(s, 3.5); // settled; the first volley is due at t=4.5
    expect(s.boss!.charging).toBe(false);
    runCollect(s, 0.5);
    expect(s.boss!.charging).toBe(true);
    const events = runCollect(s, 0.6);
    expect(events.some((e) => e.type === 'bossFire')).toBe(true);
    expect(s.boss!.charging).toBe(false);
  });
});

describe('end of run', () => {
  it('losing every soldier after the boss died keeps the win', () => {
    const s = createState(makeLevel({ startSquad: 1 }), 1);
    s.phase = 'won';
    changeCount(s, -1, 0, 0);
    expect(s.phase).toBe('won');
    expect(s.events.filter((e) => e.type === 'lost')).toHaveLength(0);
  });
});
