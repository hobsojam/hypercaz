import { describe, expect, test } from 'vitest';
import { type Board, emptyBoard, isEmpty, SIZE } from '../../games/blast/sim/board.ts';
import { type Piece, pieceById } from '../../games/blast/sim/pieces.ts';
import { solvable } from '../../games/blast/sim/solver.ts';
import { type BlastState, createBlast, EMPTY_BONUS, fitsSomewhere, linePoints, placePiece, STREAK_CAP } from '../../games/blast/sim/state.ts';
import { DIAGONAL } from './helpers.ts';

const p = pieceById;
const single = () => p('1x1');

// A run on a chosen board and hand.
function run(board: Board, hand: (Piece | null)[]): BlastState {
  const s = createBlast(1);
  s.board = board;
  s.hand = hand;
  return s;
}

// Rows filled from col 1 to the end, so a single at col 0 completes each.
function rowsBut0(...rows: number[]): Board {
  const b = emptyBoard();
  for (const r of rows) for (let c = 1; c < SIZE; c++) b[r * SIZE + c] = 1;
  return b;
}

// Plus one stray crate, so a clear does not also empty the bay.
function linesBut0(...rows: number[]): Board {
  const b = rowsBut0(...rows);
  b[7 * SIZE + 6] = 1;
  return b;
}

test('a new run has dealt one solvable hand', () => {
  const s = createBlast(42);
  expect(s.handsDealt).toBe(1);
  expect(s.hand).toHaveLength(3);
  expect(solvable(s.board, s.hand as Piece[])).toBe(true);
  expect([s.score, s.streak, s.phase]).toEqual([0, 0, 'play']);
});

test('placing scores a point per crate', () => {
  const s = run(emptyBoard(), [p('sq2'), single(), single()]);
  expect(placePiece(s, 0, 3, 3)).toBe(true);
  expect(s.score).toBe(4);
  expect(s.events).toEqual([{ type: 'place', slot: 0, col: 3, row: 3, crates: 4 }]);
  expect(s.hand[0]).toBeNull();
});

describe('line points', () => {
  test('grow with the number of lines at once', () => {
    expect([1, 2, 3, 4].map(linePoints)).toEqual([10, 30, 60, 100]);
  });

  test('a single in the first cleared hand scores 10 x 1', () => {
    const s = run(linesBut0(0), [single(), single(), single()]);
    placePiece(s, 0, 0, 0);
    expect(s.score).toBe(1 + 10);
    const clear = s.events.find((e) => e.type === 'clear');
    expect(clear).toMatchObject({ rows: [0], cols: [], points: 10, streak: 1 });
  });

  test('a double scores 30 x 1', () => {
    const s = run(linesBut0(0, 1), [p('v2'), single(), single()]);
    placePiece(s, 0, 0, 0);
    expect(s.score).toBe(2 + 30);
  });
});

describe('the streak', () => {
  test('counts hands with a clear, and resets after a hand without one', () => {
    const s = run(rowsBut0(0, 1, 2), [single(), single(), single()]);
    // Hand A: one clear.
    placePiece(s, 0, 0, 0);
    expect(s.streak).toBe(1);
    placePiece(s, 1, 5, 5);
    placePiece(s, 2, 6, 6);
    expect(s.streak).toBe(1);
    // Hand B: two clears, the multiplier is x2 for both.
    s.hand = [single(), single(), single()];
    const before = s.score;
    placePiece(s, 0, 0, 1);
    expect(s.streak).toBe(2);
    expect(s.score - before).toBe(1 + 10 * 2);
    placePiece(s, 1, 0, 2);
    expect(s.streak).toBe(2);
    expect(s.score - before).toBe(2 * (1 + 10 * 2));
    placePiece(s, 2, 7, 7);
    // Hand C: no clear, so the streak ends with it.
    s.hand = [single(), single(), single()];
    placePiece(s, 0, 3, 5);
    expect(s.streak).toBe(2);
    placePiece(s, 1, 3, 6);
    placePiece(s, 2, 3, 7);
    expect(s.streak).toBe(0);
  });

  test('caps at 8', () => {
    const s = run(linesBut0(0), [single(), single(), single()]);
    s.streak = STREAK_CAP;
    placePiece(s, 0, 0, 0);
    expect(s.streak).toBe(8);
    expect(s.score).toBe(1 + 10 * 8);
  });
});

test('an empty bay scores the bonus', () => {
  const s = run(rowsBut0(4), [single(), single(), single()]);
  placePiece(s, 0, 0, 4);
  expect(isEmpty(s.board)).toBe(true);
  expect(s.events.map((e) => e.type)).toEqual(['place', 'clear', 'empty']);
  expect(s.events[2]).toEqual({ type: 'empty', points: EMPTY_BONUS });
  expect(s.score).toBe(1 + 10 + 500);
});

test('placing the third piece deals a new hand', () => {
  const s = run(emptyBoard(), [single(), null, null]);
  placePiece(s, 0, 2, 2);
  expect(s.events.map((e) => e.type)).toEqual(['place', 'deal']);
  expect(s.hand).toHaveLength(3);
  expect(s.hand.every((x) => x !== null)).toBe(true);
  expect(s.handsDealt).toBe(2);
});

test('a jam ends the run', () => {
  const s = run(DIAGONAL, [single(), p('sq3'), p('sq3')]);
  expect(placePiece(s, 0, 0, 0)).toBe(true);
  expect(s.events.map((e) => e.type)).toEqual(['place', 'clear', 'jam']);
  expect(s.phase).toBe('over');
  expect(placePiece(s, 1, 0, 0)).toBe(false);
});

test('invalid placements change nothing', () => {
  const b = emptyBoard();
  b[0] = 1;
  const s = run(b, [p('sq2'), null, single()]);
  s.events = [{ type: 'deal' }];
  const board = s.board.slice();
  expect(placePiece(s, 0, 0, 0)).toBe(false);
  expect(placePiece(s, 0, 7, 7)).toBe(false); // off the bay
  expect(placePiece(s, 1, 4, 4)).toBe(false); // an empty slot
  expect(placePiece(s, 5, 4, 4)).toBe(false); // no such slot
  expect(s.score).toBe(0);
  expect(s.board).toEqual(board);
  expect(s.events).toEqual([{ type: 'deal' }]);
});

test('fitsSomewhere says whether a slot can go anywhere', () => {
  const s = run(DIAGONAL, [single(), p('sq2'), null]);
  expect([0, 1, 2].map((slot) => fitsSomewhere(s, slot))).toEqual([true, false, false]);
});
