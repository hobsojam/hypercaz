import { describe, expect, test } from 'vitest';
import { CAPACITY, colorCounts, isDone, isWon, pour } from '../../games/sort/sim/board.ts';
import { generateLevel, levelSpec } from '../../games/sort/sim/levels.ts';
import { solve } from '../../games/sort/sim/solver.ts';

describe('generateLevel', () => {
  test('is deterministic', () => {
    expect(generateLevel(7)).toEqual(generateLevel(7));
  });

  test('each colour fills whole tubes, spread evenly; no done or single-colour tube; right tube count', () => {
    for (const n of [1, 7, 20, 36, 47, 60, 200]) {
      const board = generateLevel(n);
      const { colors, filled, spares } = levelSpec(n);
      expect(board.tubes.length).toBe(filled + spares);
      expect(board.tubes.slice(filled).every((t) => t.length === 0)).toBe(true);
      const counts = colorCounts(board);
      expect(counts.size).toBe(colors);
      // each colour fills floor(filled / colors) or one more tubes' worth
      const each = Math.floor(filled / colors);
      for (const c of counts.values()) expect([each * CAPACITY, (each + 1) * CAPACITY]).toContain(c);
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

  test('a huge level number is fast and solvable', () => {
    const t = performance.now();
    const board = generateLevel(1_000_000);
    expect(performance.now() - t).toBeLessThan(3000);
    expect(solve(board)).not.toBeNull();
  });
});

test('levelSpec follows the curve: a filled tube every 2 levels up to 26, new colours first up to 10, always 2 spares', () => {
  expect(levelSpec(1)).toEqual({ colors: 3, filled: 3, spares: 2 });
  expect(levelSpec(2)).toEqual({ colors: 3, filled: 3, spares: 2 });
  expect(levelSpec(3)).toEqual({ colors: 4, filled: 4, spares: 2 });
  expect(levelSpec(15)).toEqual({ colors: 10, filled: 10, spares: 2 });
  expect(levelSpec(17)).toEqual({ colors: 10, filled: 11, spares: 2 });
  expect(levelSpec(46)).toEqual({ colors: 10, filled: 25, spares: 2 });
  expect(levelSpec(47)).toEqual({ colors: 10, filled: 26, spares: 2 });
  expect(levelSpec(10_000)).toEqual({ colors: 10, filled: 26, spares: 2 });
});

// These pin the puzzle each level number gives. generateLevel keeps or rejects a
// deal by what the solver finds, so a solver change can silently reshuffle levels.
// Changing the expected values changes players' levels: only do it deliberately.
describe('level snapshot', () => {
  const pinned: Record<number, string> = {
    1: '[[1,2,0,1],[2,0,0,2],[2,1,0,1],[],[]]',
    6: '[[1,1,3,1],[3,4,1,3],[4,2,0,3],[4,4,0,2],[0,2,0,2],[],[]]',
    36: '[[1,7,1,8],[0,0,6,9],[2,7,8,5],[4,3,5,8],[0,3,2,5],[9,5,1,6],[6,6,3,0],[8,0,6,2],[7,5,8,7],[2,7,7,1],[9,2,6,9],[4,4,2,3],[8,1,0,6],[0,9,2,3],[1,8,2,4],[4,4,7,5],[4,1,9,1],[6,9,3,3],[7,0,5,5],[3,4,8,9],[],[]]',
    // the first full-size board: 26 filled tubes + 2 spares
    47: '[[4,0,1,7],[6,1,7,9],[2,6,0,2],[7,9,5,8],[4,7,9,8],[2,0,1,9],[0,8,3,7],[7,4,1,9],[3,9,0,0],[8,1,7,6],[1,3,4,5],[4,5,0,4],[6,3,1,8],[9,1,4,3],[5,2,3,3],[8,1,2,2],[9,5,3,0],[5,0,2,6],[3,4,8,5],[0,3,4,5],[1,1,2,4],[5,5,5,7],[0,5,4,8],[1,2,3,0],[4,6,6,2],[3,2,2,6],[],[]]',
  };

  test.each(Object.keys(pinned).map(Number))('level %i deals the same tubes', (n) => {
    expect(JSON.stringify(generateLevel(n).tubes)).toBe(pinned[n]);
  });

  test('levels 1..300 hash to the same value', { timeout: 60_000 }, () => {
    // FNV-1a over the JSON of every level's tubes
    const text = JSON.stringify(Array.from({ length: 300 }, (_, i) => generateLevel(i + 1).tubes));
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
    expect(hash).toBe(3970606129);
  });
});
