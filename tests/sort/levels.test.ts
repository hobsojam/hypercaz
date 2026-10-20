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

// These pin the puzzle each level number gives. generateLevel keeps or rejects a
// deal by what the solver finds, so a solver change can silently reshuffle levels.
// Changing the expected values changes players' levels: only do it deliberately.
describe('level snapshot', () => {
  const pinned: Record<number, string> = {
    1: '[[1,2,0,1],[2,0,0,2],[2,1,0,1],[],[]]',
    6: '[[1,3,0,3],[2,1,0,1],[3,2,3,1],[0,2,0,2],[],[]]',
    36: '[[2,4,1,3],[7,1,9,4],[2,6,3,5],[0,8,3,0],[4,1,6,8],[5,7,5,8],[5,0,6,0],[2,3,9,6],[7,4,8,7],[1,2,9,9],[],[]]',
    // level 60 is 1-spare eligible but falls back to 2 spares
    60: '[[0,1,2,7],[3,5,7,3],[9,4,4,7],[9,3,3,5],[5,6,8,6],[4,8,7,0],[8,6,1,0],[2,6,9,1],[8,2,4,9],[5,1,2,0],[],[]]',
    63: '[[3,8,2,2],[0,4,1,5],[6,7,2,3],[1,9,3,5],[9,9,2,8],[9,7,1,4],[7,8,8,7],[6,6,5,6],[4,0,0,3],[4,1,0,5],[],[]]',
  };

  test.each(Object.keys(pinned).map(Number))('level %i deals the same tubes', (n) => {
    expect(JSON.stringify(generateLevel(n).tubes)).toBe(pinned[n]);
  });

  test('levels 1..300 hash to the same value', { timeout: 60_000 }, () => {
    // FNV-1a over the JSON of every level's tubes
    const text = JSON.stringify(Array.from({ length: 300 }, (_, i) => generateLevel(i + 1).tubes));
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
    expect(hash).toBe(1712358973);
  });
});
