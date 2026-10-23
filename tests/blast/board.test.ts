import { describe, expect, test } from 'vitest';
import { canPlaceAnywhere, emptyBoard, fits, isEmpty, place, SIZE } from '../../games/blast/sim/board.ts';
import { pieceById, PIECES } from '../../games/blast/sim/pieces.ts';
import { fullExcept } from './helpers.ts';

describe('the piece set', () => {
  test('27 pieces with unique ids, grouped 10 / 10 / 7', () => {
    expect(PIECES).toHaveLength(27);
    expect(new Set(PIECES.map((p) => p.id)).size).toBe(27);
    const count = (g: string) => PIECES.filter((p) => p.group === g).length;
    expect([count('friendly'), count('medium'), count('awkward')]).toEqual([10, 10, 7]);
    for (const id of ['1x1', 'h5', 'v5', 'sq3']) expect(pieceById(id).id).toBe(id);
  });

  test('every piece is normalised, inside its box and coloured', () => {
    for (const p of PIECES) {
      const keys = p.cells.map(([c, r]) => `${c},${r}`);
      expect(new Set(keys).size, p.id).toBe(keys.length);
      for (const [c, r] of p.cells) {
        expect(c >= 0 && c < p.w && r >= 0 && r < p.h, p.id).toBe(true);
      }
      expect(Math.min(...p.cells.map(([c]) => c)), p.id).toBe(0);
      expect(Math.min(...p.cells.map(([, r]) => r)), p.id).toBe(0);
      expect(Math.max(...p.cells.map(([c]) => c)), p.id).toBe(p.w - 1);
      expect(Math.max(...p.cells.map(([, r]) => r)), p.id).toBe(p.h - 1);
      expect(p.color, p.id).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  test('an unknown id throws', () => {
    expect(() => pieceById('nope')).toThrow();
  });
});

test('fits only on empty cells inside the bay', () => {
  const h3 = pieceById('h3');
  const b = emptyBoard();
  expect(fits(b, h3, 5, 0)).toBe(true);
  expect(fits(b, h3, 6, 0)).toBe(false);
  expect(fits(b, h3, -1, 0)).toBe(false);
  expect(fits(b, h3, 0, SIZE)).toBe(false);
  const after = place(b, pieceById('1x1'), 2, 0).board;
  expect(fits(after, h3, 0, 0)).toBe(false);
});

test('placing fills exactly its cells and leaves the input alone', () => {
  const sq2 = pieceById('sq2');
  const b = emptyBoard();
  const { board, rows, cols, cleared } = place(b, sq2, 3, 4);
  const value = PIECES.indexOf(sq2) + 1;
  const filled = [...board.keys()].filter((i) => board[i] !== 0);
  expect(filled).toEqual([4 * SIZE + 3, 4 * SIZE + 4, 5 * SIZE + 3, 5 * SIZE + 4]);
  for (const i of filled) expect(board[i]).toBe(value);
  expect([rows, cols, cleared]).toEqual([[], [], []]);
  expect(isEmpty(b)).toBe(true);
});

test('a full row and a full column clear together, the crossing cell once', () => {
  const b = emptyBoard();
  for (let i = 0; i < SIZE; i++) {
    if (i !== 4) b[2 * SIZE + i] = 3; // row 2
    if (i !== 2) b[i * SIZE + 4] = 5; // column 4
  }
  const { board, rows, cols, cleared } = place(b, pieceById('1x1'), 4, 2);
  expect(rows).toEqual([2]);
  expect(cols).toEqual([4]);
  expect(cleared).toHaveLength(15);
  expect(cleared.filter((c) => c.col === 4 && c.row === 2)).toEqual([{ col: 4, row: 2, value: PIECES.indexOf(pieceById('1x1')) + 1 }]);
  expect(cleared.find((c) => c.col === 0 && c.row === 2)?.value).toBe(3);
  expect(isEmpty(board)).toBe(true);
});

test('canPlaceAnywhere and isEmpty', () => {
  const holes = fullExcept([[0, 0], [1, 0], [0, 1], [1, 1], [5, 5], [6, 5], [5, 6], [6, 6]]);
  expect(canPlaceAnywhere(holes, pieceById('sq3'))).toBe(false);
  expect(canPlaceAnywhere(holes, pieceById('sq2'))).toBe(true);
  expect(isEmpty(emptyBoard())).toBe(true);
  expect(isEmpty(holes)).toBe(false);
});
