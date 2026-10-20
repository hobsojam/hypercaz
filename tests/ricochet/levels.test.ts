import { expect, test } from 'vitest';
import { LEVELS, validateLevel, type Level } from '../../games/ricochet/levels.ts';
import { createState, shoot, starsFor, step } from '../../games/ricochet/sim/game.ts';

// Authored independently from the shipped layout data; never bundled into play.
export const SOLUTIONS = [
  [-Math.PI / 2],
  [Math.atan2(-464, 468)],
  [-0.8],
  [Math.atan2(-908, 150)],
  [Math.atan2(-464, -328), Math.atan2(-464, 328)],
  [-2.15],
  [-0.62],
  [-0.8, -Math.PI + 0.8],
];

test('eight distinct puzzles are valid and numbered for selection', () => {
  expect(LEVELS.map(l => l.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  for (const l of LEVELS) expect(() => validateLevel(l)).not.toThrow();
});

test.each(SOLUTIONS.map((angles, index) => ({ index, angles })))('puzzle $index has a verified par solution', ({ index, angles }) => {
  const state = createState(LEVELS[index]);
  for (const angle of angles) {
    if (state.phase === 'won') break;
    expect(shoot(state, angle)).toBe(true);
    for (let i = 0; i < 2000 && state.phase === 'flying'; i++) step(state, 1 / 60);
  }
  expect(state.phase).toBe('won');
  expect(state.shotsUsed).toBeLessThanOrEqual(state.level.par);
  expect(starsFor(state)).toBe(3);
});

test.each([
  { par: NaN },
  { shots: 0 },
  { cages: [] },
  { cages: [{ id: 'a', x: 270, y: 764 }] },
  { cages: [{ id: 'a', x: 20, y: 300 }] },
  { cages: [{ id: 'a', x: NaN, y: 300 }] },
  { cages: [{ id: 'a', x: 270, y: 300 }, { id: 'a', x: 400, y: 400 }] },
  { cages: [{ id: 'a', x: 270, y: 300 }, { id: 'b', x: 280, y: 300 }] },
  { walls: [{ x: 250, y: 740, w: 40, h: 40 }] },
  { walls: [{ x: 0, y: 300, w: 100, h: 10 }] },
  { walls: [{ x: 240, y: 280, w: 60, h: 40 }] },
  { walls: [{ x: 50, y: 200, w: 60, h: 40 }, { x: 70, y: 210, w: 60, h: 40 }] },
])('rejects invalid level geometry: %j', bad => {
  const l: Level = { id: 1, name: 'Fixture', lesson: 'Aim.', par: 1, shots: 3, walls: [], cages: [{ id: 'a', x: 270, y: 300 }], ...bad };
  expect(() => validateLevel(l)).toThrow();
});
