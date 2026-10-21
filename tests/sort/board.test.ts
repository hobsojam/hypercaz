import { describe, expect, test } from 'vitest';
import { colorCounts, hasLegalMove, isDone, isWon, pour, topRun } from '../../games/sort/sim/board.ts';

const b = (...tubes: number[][]) => ({ tubes });

describe('pour', () => {
  test('moves exactly the top run that fits', () => {
    const a = pour(b([0, 1, 1], [2, 1]), 0, 1);
    expect(a?.moved).toBe(2);
    expect(a?.board.tubes).toEqual([[0], [2, 1, 1, 1]]);
    const c = pour(b([0, 1, 1], [3, 3, 1]), 0, 1);
    expect(c?.moved).toBe(1);
    expect(c?.board.tubes).toEqual([[0, 1], [3, 3, 1, 1]]);
  });

  test('illegal pours return null', () => {
    expect(pour(b([0], [1]), 0, 1)).toBeNull();
    expect(pour(b([1], [1, 1, 1, 1]), 0, 1)).toBeNull();
    expect(pour(b([], [1]), 0, 1)).toBeNull();
    expect(pour(b([1], [1]), 0, 0)).toBeNull();
    expect(pour(b([1], [1]), 0, 5)).toBeNull();
    expect(pour(b([1], [1]), -1, 0)).toBeNull();
  });

  test('pouring into an empty tube is legal', () => {
    expect(pour(b([0, 1], []), 0, 1)?.board.tubes).toEqual([[0], [1]]);
  });

  test('does not change its input', () => {
    const board = b([0, 1, 1], [2, 1]);
    pour(board, 0, 1);
    expect(board.tubes).toEqual([[0, 1, 1], [2, 1]]);
  });
});

test('topRun', () => {
  expect(topRun([])).toBeNull();
  expect(topRun([0, 1, 1])).toEqual({ color: 1, count: 2 });
});

test('isDone and isWon', () => {
  expect(isDone([2, 2, 2, 2])).toBe(true);
  expect(isDone([2, 2, 2])).toBe(false);
  expect(isDone([2, 2, 2, 1])).toBe(false);
  expect(isWon(b([0, 0, 0, 0], [], [1, 1, 1, 1], []))).toBe(true);
  expect(isWon(b([0, 0, 0], [0]))).toBe(false);
});

test('hasLegalMove', () => {
  expect(hasLegalMove(b([0, 1, 0, 1], [1, 0, 1, 0]))).toBe(false);
  expect(hasLegalMove(b([0, 0, 0, 0], []))).toBe(true);
});

test('colorCounts', () => {
  expect(colorCounts(b([0, 1], [1, 1])).get(1)).toBe(3);
});
