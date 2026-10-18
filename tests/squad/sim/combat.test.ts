import { describe, expect, it } from 'vitest';
import { hitTest } from '../../../games/squad/sim/combat.ts';
import { createState, type GameState } from '../../../games/squad/sim/state.ts';
import { step } from '../../../games/squad/sim/step.ts';
import { DT, makeLevel } from '../fixtures.ts';

function runCollect(s: GameState, seconds: number) {
  const events: GameState['events'] = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    step(s, { targetX: s.squad.x }, DT);
    events.push(...s.events);
  }
  return events;
}

describe('hitTest', () => {
  it('catches a bullet that jumps over a thin target in one step', () => {
    expect(hitTest({ x: 0, zFrom: 9, zTo: 11 }, { x: 0, z: 10, halfW: 0.2, halfD: 0.3 })).toBe(true);
  });
  it('misses when x is outside the target', () => {
    expect(hitTest({ x: 0.5, zFrom: 9, zTo: 11 }, { x: 0, z: 10, halfW: 0.2, halfD: 0.3 })).toBe(false);
  });
});

describe('firing', () => {
  it('a squad of 10 fires 25 bullets per second', () => {
    const s = createState(makeLevel({ startSquad: 10 }), 1);
    const shots = runCollect(s, 1).filter((e) => e.type === 'shot').length;
    expect(Math.abs(shots - 25)).toBeLessThanOrEqual(1);
  });

  it('caps bullets for huge squads but keeps total damage', () => {
    const s = createState(makeLevel({ startSquad: 3000 }), 1);
    const shots = runCollect(s, 1).filter((e) => e.type === 'shot').length;
    expect(shots).toBeLessThanOrEqual(376);
    const damagePerBullet = s.bullets[0].damage;
    expect(Math.abs(shots * damagePerBullet - 7500) / 7500).toBeLessThan(0.02);
  });
});

describe('hits', () => {
  it('breaking a cage adds its soldiers', () => {
    const s = createState(makeLevel({ speed: 2, spawns: [{ z: 10, x: 0, type: 'cage', hp: 3, value: 4 }] }), 1);
    const events = runCollect(s, 3);
    expect(s.squad.count).toBe(5);
    expect(events).toContainEqual(expect.objectContaining({ type: 'gain', amount: 4 }));
    expect(events).toContainEqual(expect.objectContaining({ type: 'destroyed', target: 'cage' }));
  });

  it('each hit raises a gate value by one', () => {
    const s = createState(makeLevel({ speed: 1, spawns: [{ z: 10, x: 0, type: 'gate', width: 0.4, value: -5 }] }), 1);
    step(s, { targetX: 0 }, DT);
    s.bullets = [0, 1, 2].map(() => ({ x: 0, z: 9.6, damage: 1 }));
    step(s, { targetX: 0 }, DT);
    expect(s.entities[0].value).toBe(-2);
    expect(s.bullets).toHaveLength(0);
  });

  it('gate values stop rising at their cap, one per hit whatever the damage', () => {
    const s = createState(makeLevel({ speed: 1, spawns: [{ z: 10, x: 0, type: 'gate', width: 0.4, value: 2, max: 6 }] }), 1);
    step(s, { targetX: 0 }, DT);
    s.bullets = [{ x: 0, z: 9.6, damage: 20 }];
    step(s, { targetX: 0 }, DT);
    expect(s.entities[0].value).toBe(3);
    s.bullets = Array.from({ length: 10 }, () => ({ x: 0, z: 9.5, damage: 1 }));
    step(s, { targetX: 0 }, DT);
    expect(s.entities[0].value).toBe(6);
  });

  it('bullets pass through hazards', () => {
    const s = createState(
      makeLevel({
        speed: 1,
        spawns: [
          { z: 5, x: 0, type: 'hazard', kind: 'blade', width: 0.4 },
          { z: 8, x: 0, type: 'enemy', hp: 5 },
        ],
      }),
      1,
    );
    step(s, { targetX: 0 }, DT);
    s.bullets = [{ x: 0, z: 4, damage: 1 }];
    for (let i = 0; i < 10; i++) step(s, { targetX: 0 }, DT);
    expect(s.entities.find((e) => e.type === 'enemy')!.hp).toBe(4);
  });

  it('a bullet stops at the first entity in its path', () => {
    const s = createState(
      makeLevel({
        speed: 1,
        spawns: [
          { z: 5, x: 0, type: 'enemy', hp: 5 },
          { z: 8, x: 0, type: 'enemy', hp: 5 },
        ],
      }),
      1,
    );
    step(s, { targetX: 0 }, DT);
    s.bullets = [{ x: 0, z: 3, damage: 1 }];
    for (let i = 0; i < 10; i++) step(s, { targetX: 0 }, DT);
    const [near, far] = [...s.entities].sort((a, b) => a.z - b.z);
    expect(near.hp).toBe(4);
    expect(far.hp).toBe(5);
  });
});
