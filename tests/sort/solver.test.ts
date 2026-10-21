import { expect, test } from 'vitest';
import { isWon, pour, type Board } from '../../games/sort/sim/board.ts';
import { solve } from '../../games/sort/sim/solver.ts';

test('solves a hand-made board and the moves win when replayed', () => {
  const start: Board = {
    tubes: [[0, 1, 2, 0], [1, 2, 0, 1], [2, 0, 1, 2], [], []],
  };
  const moves = solve(start);
  expect(moves).not.toBeNull();
  let board = start;
  for (const m of moves!) {
    const r = pour(board, m.from, m.to);
    expect(r).not.toBeNull();
    board = r!.board;
  }
  expect(isWon(board)).toBe(true);
});

test('returns null on a stuck board', () => {
  expect(solve({ tubes: [[0, 1, 0, 1], [1, 0, 1, 0]] })).toBeNull();
});
