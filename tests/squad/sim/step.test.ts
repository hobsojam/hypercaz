import { describe, expect, it } from 'vitest';
import { createState } from '../../../games/squad/sim/state.ts';
import { step } from '../../../games/squad/sim/step.ts';
import { formationHalfWidth, formationSlots } from '../../../games/squad/sim/formation.ts';
import { DT, makeLevel } from '../fixtures.ts';

function run(state: ReturnType<typeof createState>, seconds: number, targetX = 0) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) step(state, { targetX }, DT);
  return state;
}

describe('createState', () => {
  it('starts with the level squad in the advance phase', () => {
    const s = createState(makeLevel({ startSquad: 4 }), 1);
    expect(s.squad).toEqual({ x: 0, vx: 0, count: 4, peak: 4 });
    expect(s.phase).toBe('advance');
    expect(s.distance).toBe(0);
  });
});

describe('squad movement', () => {
  it('eases to the target without overshooting', () => {
    const s = createState(makeLevel(), 1);
    let max = 0;
    for (let i = 0; i < 120; i++) {
      step(s, { targetX: 0.5 }, DT);
      max = Math.max(max, s.squad.x);
    }
    expect(Math.abs(s.squad.x - 0.5)).toBeLessThan(0.01);
    expect(max).toBeLessThanOrEqual(0.51);
  });

  it('keeps the formation on the road for out-of-range targets', () => {
    const s = createState(makeLevel({ startSquad: 11 }), 1);
    const hw = formationHalfWidth(formationSlots(11));
    run(s, 2, 5);
    expect(s.squad.x).toBeLessThanOrEqual(1 - hw + 1e-9);
    run(s, 3, -5);
    expect(s.squad.x).toBeGreaterThanOrEqual(-(1 - hw) - 1e-9);
  });
});

describe('scrolling and spawning', () => {
  it('spawns entities when they come within the horizon', () => {
    const s = createState(makeLevel({ spawns: [{ z: 100, x: 0.9, type: 'cage', hp: 1, value: 1 }] }), 1);
    run(s, 3.9);
    expect(s.entities).toHaveLength(0);
    run(s, 0.2);
    expect(s.entities).toHaveLength(1);
    expect(Math.abs(s.entities[0].z - 59)).toBeLessThan(0.5);
  });

  it('enemies close faster than static objects', () => {
    const s = createState(
      makeLevel({
        spawns: [
          { z: 50, x: 0.9, type: 'cage', hp: 1, value: 1 },
          { z: 50, x: -0.9, type: 'enemy', hp: 1 },
        ],
      }),
      1,
    );
    step(s, { targetX: 0 }, DT);
    const before = s.entities.map((e) => e.z);
    run(s, 1);
    const cage = s.entities.find((e) => e.type === 'cage')!;
    const enemy = s.entities.find((e) => e.type === 'enemy')!;
    expect(before[0] - cage.z).toBeCloseTo(10, 1);
    expect(before[1] - enemy.z).toBeCloseTo(11.5, 1);
  });

  it('enters the boss phase at the end of the road and stops scrolling', () => {
    const s = createState(makeLevel({ length: 100 }), 1);
    run(s, 10.05);
    expect(s.phase).toBe('boss');
    const d = s.distance;
    run(s, 1);
    expect(s.distance).toBe(d);
  });

  it('despawns entities that pass behind the squad', () => {
    const s = createState(makeLevel({ spawns: [{ z: 10, x: 0.9, type: 'cage', hp: 1, value: 1 }] }), 1);
    run(s, 0.5);
    expect(s.entities).toHaveLength(1);
    run(s, 1.2);
    expect(s.entities).toHaveLength(0);
  });

  it('does nothing once the run is over', () => {
    const s = createState(makeLevel({ spawns: [{ z: 10, x: 0, type: 'enemy', hp: 1 }] }), 1);
    s.phase = 'lost';
    const before = structuredClone(s);
    step(s, { targetX: 0.7 }, DT);
    expect(s).toEqual(before);
  });
});
