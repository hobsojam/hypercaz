import { describe, expect, test } from 'vitest';
import { CAPACITY, colorCounts, isDone, isWon, pour } from '../../games/sort/sim/board.ts';
import { generateLevel, levelSpec } from '../../games/sort/sim/levels.ts';
import { solve } from '../../games/sort/sim/solver.ts';

describe('generateLevel', () => {
  test('is deterministic', () => {
    expect(generateLevel(7)).toEqual(generateLevel(7));
  });

  test('has 4 of each colour, no done or single-colour tube, right tube count', () => {
    for (const n of [1, 7, 36, 60, 63, 200]) {
      const board = generateLevel(n);
      const { colors, spares } = levelSpec(n);
      // a 1-spare level may fall back to 2 spares
      const extra = board.tubes.length - colors;
      expect(extra === spares || (spares === 1 && extra === 2)).toBe(true);
      for (const c of colorCounts(board).values()) expect(c).toBe(CAPACITY);
      expect(colorCounts(board).size).toBe(colors);
      for (const t of board.tubes) {
        expect(isDone(t)).toBe(false);
        if (t.length > 0) expect(new Set(t).size).toBeGreaterThan(1);
      }
    }
  });

  test('levels 1..500 are all solvable', { timeout: 120_000 }, () => {
    for (let n = 1; n <= 500; n++) {
      let board = generateLevel(n);
      const moves = solve(board);
      expect(moves, `level ${n}`).not.toBeNull();
      for (const m of moves!) board = pour(board, m.from, m.to)!.board;
      expect(isWon(board), `level ${n}`).toBe(true);
    }
  });

  test('some 1-spare levels survive the comfort check', () => {
    let found = false;
    for (let n = 60; n <= 498 && !found; n += 3) {
      found = generateLevel(n).tubes.length === levelSpec(n).colors + 1;
    }
    expect(found).toBe(true);
  });

  test('a huge level number is fast and solvable', () => {
    const t = performance.now();
    const board = generateLevel(1_000_000);
    expect(performance.now() - t).toBeLessThan(3000);
    expect(solve(board)).not.toBeNull();
  });
});

test('levelSpec follows the curve', () => {
  for (let n = 1; n <= 5; n++) expect(levelSpec(n).colors).toBe(3);
  expect(levelSpec(6).colors).toBe(4);
  expect(levelSpec(36).colors).toBe(10);
  expect(levelSpec(10_000).colors).toBe(10);
  expect(levelSpec(60).spares).toBe(1);
  expect(levelSpec(63).spares).toBe(1);
  expect(levelSpec(61).spares).toBe(2);
  expect(levelSpec(59).spares).toBe(2);
});
