import { expect, test } from 'vitest';
import { blocker, cells, createState, remove, validatePuzzle, type Arrow, type Puzzle } from '../../games/arrows/sim.ts';

const bent: Arrow = { id: 1, direction: 'E', path: [{ x: 1, y: 3 }, { x: 1, y: 2 }, { x: 2, y: 2 }] };
const puzzle = (arrows: readonly Arrow[]): Puzzle => ({ id: 1, name: 'Bend', lesson: 'The tail follows.', size: 5, arrows });

test('a bent arrow occupies every cell from its tail through its elbow to the head', () => {
  expect(cells(bent)).toEqual(bent.path);
  const p = puzzle([bent, { id: 2, direction: 'N', path: [{ x: 1, y: 4 }] }]);
  expect(blocker(p, createState(p).remaining, 2)?.id).toBe(1);
});

test('only the path ahead of the head must be clear; the elbow does not translate sideways', () => {
  // Rigid translation east would hit the piece at (2,3). Following the original path cannot.
  const p = puzzle([bent, { id: 2, direction: 'S', path: [{ x: 2, y: 3 }] }]);
  const s = createState(p);
  expect(blocker(p, s.remaining, 1)).toBeNull();
  expect(remove(s, 1)).toBe('removed');
  expect(s.remaining.has(2)).toBe(true);
});

test('a distant bent shaft blocks the exit ray from the actual head', () => {
  const target: Arrow = { id: 2, direction: 'N', path: [{ x: 3, y: 3 }, { x: 4, y: 3 }, { x: 4, y: 2 }, { x: 4, y: 1 }] };
  const p = puzzle([bent, target]), s = createState(p);
  expect(blocker(p, s.remaining, 1)?.id).toBe(2);
  expect(remove(s, 1)).toBe('blocked');
  remove(s, 2); expect(remove(s, 1)).toBe('removed');
});

test.each([
  [],
  [{ x: 1, y: 1 }, { x: 2, y: 2 }], // diagonal
  [{ x: 1, y: 1 }, { x: 3, y: 1 }], // gap
  [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 1 }], // self-cross/reversal
  [{ x: 1, y: 1 }, { x: 1, y: 2 }], // head direction does not match final segment
  [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 }, { x: 1, y: 1 }],
].map(path => ({ path })))('rejects malformed paths and a head pointing back into its own body: %j', ({ path }) => {
  const direction = path.length === 6 ? 'N' : 'E';
  expect(() => validatePuzzle(puzzle([{ id: 1, direction, path }]))).toThrow();
});
