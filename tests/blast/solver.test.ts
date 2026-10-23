import { expect, test } from 'vitest';
import { emptyBoard, fits } from '../../games/blast/sim/board.ts';
import { pieceById } from '../../games/blast/sim/pieces.ts';
import { countWays, solvable, WAYS_CAP } from '../../games/blast/sim/solver.ts';
import { boardFrom } from './helpers.ts';

const p = pieceById;

// Full but for a diagonal of holes, so no line is full and nothing bigger
// than a single fits; a single completes a row and a column and clears both.
const DIAGONAL = boardFrom([
  '.#######',
  '#.######',
  '##.#####',
  '###.####',
  '####.###',
  '#####.##',
  '######.#',
  '#######.',
]);

test('an empty hand has exactly one way', () => {
  expect(countWays(emptyBoard(), [])).toBe(1);
});

test('counts placements of one piece', () => {
  expect(countWays(emptyBoard(), [p('sq3')], 1000)).toBe(36);
});

test('the cap stops counting', () => {
  expect(countWays(emptyBoard(), [p('1x1'), p('1x1'), p('1x1')])).toBe(WAYS_CAP);
});

test('finds a way that only exists in one order', () => {
  const b = DIAGONAL;
  expect(fits(b, p('h5'), 0, 7)).toBe(false);
  expect(solvable(b, [p('h5')])).toBe(false);
  expect(solvable(b, [p('h5'), p('1x1')])).toBe(true);
});

test('reports none when no order works', () => {
  // A single clears one row and one column, but that never leaves a 3x3
  // hole; a 2x2 square fits nowhere at all.
  const b = DIAGONAL;
  expect(solvable(b, [p('sq2')])).toBe(false);
  expect(solvable(b, [p('1x1'), p('sq3')])).toBe(false);
  expect(solvable(b, [p('1x1'), p('v5')])).toBe(true);
});
