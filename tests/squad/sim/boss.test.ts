import { describe, expect, it } from 'vitest';
import { changeCount } from '../../../games/squad/sim/contact.ts';
import { createState, type GameState } from '../../../games/squad/sim/state.ts';
import { step } from '../../../games/squad/sim/step.ts';
import { DT, makeLevel } from '../fixtures.ts';

function runCollect(s: GameState, seconds: number, targetX = 0) {
  const events: GameState['events'] = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    step(s, { targetX }, DT);
    events.push(...s.events);
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
    s.projectiles = [{ x: 0, z: 0.1 }];
    step(s, { targetX: 0 }, DT);
    expect(s.squad.count).toBe(8);
    expect(s.projectiles).toHaveLength(0);
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

describe('end of run', () => {
  it('losing every soldier after the boss died keeps the win', () => {
    const s = createState(makeLevel({ startSquad: 1 }), 1);
    s.phase = 'won';
    changeCount(s, -1, 0, 0);
    expect(s.phase).toBe('won');
    expect(s.events.filter((e) => e.type === 'lost')).toHaveLength(0);
  });
});
