import { describe, expect, test } from 'vitest';
import { nextFloat } from '../../engine/rng.ts';
import { type Board, emptyBoard, fits, place, SIZE } from '../../games/blast/sim/board.ts';
import { chooseHand, dealHand, drawCandidates, groupWeights, pressure } from '../../games/blast/sim/dealer.ts';
import { type Piece, pieceById } from '../../games/blast/sim/pieces.ts';
import { countWays, solvable } from '../../games/blast/sim/solver.ts';
import { boardFrom, DIAGONAL } from './helpers.ts';

const p = pieceById;

test('pressure rises and caps', () => {
  expect([0, 10, 20, 99].map(pressure)).toEqual([0, 0.5, 1, 1]);
});

test('weights lean awkward as pressure rises', () => {
  const share = (w: ReturnType<typeof groupWeights>) => w.awkward / (w.friendly + w.medium + w.awkward);
  expect(share(groupWeights(1))).toBeGreaterThan(share(groupWeights(0)));
  expect(groupWeights(0)).toEqual({ friendly: 6, medium: 3, awkward: 1 });
  expect(groupWeights(1)).toEqual({ friendly: 2, medium: 3, awkward: 4 });
});

// Every fitting top-left cell for a piece.
function spots(board: Board, piece: Piece): [number, number][] {
  const out: [number, number][] = [];
  for (let row = 0; row < SIZE; row++) for (let col = 0; col < SIZE; col++) if (fits(board, piece, col, row)) out.push([col, row]);
  return out;
}

describe('every dealt hand is solvable', () => {
  test('over 30 seeds of random legal play', () => {
    for (let seed = 1; seed <= 30; seed++) {
      let board = emptyBoard();
      let rng = seed * 7919;
      let roll = seed;
      play: for (let handsDealt = 0; handsDealt < 40; handsDealt++) {
        const dealt = dealHand(board, handsDealt, rng);
        rng = dealt.rng;
        expect(dealt.hand).toHaveLength(3);
        expect(solvable(board, dealt.hand)).toBe(true);
        for (const piece of dealt.hand) {
          const options = spots(board, piece);
          if (options.length === 0) break play; // a jam: this run is over
          let r: number;
          [r, roll] = nextFloat(roll);
          const [col, row] = options[Math.floor(r * options.length)]!;
          board = place(board, piece, col, row).board;
        }
      }
    }
  });
});

test('later hands are more awkward', () => {
  const awkwardMean = (handsDealt: number) => {
    let total = 0;
    for (let seed = 0; seed < 200; seed++) total += dealHand(emptyBoard(), handsDealt, seed * 104729).hand.filter((x) => x.group === 'awkward').length;
    return total / 200;
  };
  expect(awkwardMean(30)).toBeGreaterThan(awkwardMean(0));
});

const HALF_FULL = boardFrom([
  '###.##.#',
  '#.####..',
  '####.###',
  '##..####',
  '........',
  '.#......',
  '......#.',
  '........',
]);

test('at full pressure it picks the tightest candidate', () => {
  const seed = 12345;
  const { hands } = drawCandidates(30, seed);
  const ways = hands.filter((h) => solvable(HALF_FULL, h)).map((h) => countWays(HALF_FULL, h));
  expect(ways.length).toBeGreaterThan(1);
  const dealt = dealHand(HALF_FULL, 30, seed).hand;
  expect(countWays(HALF_FULL, dealt)).toBe(Math.min(...ways));
});

test('below full pressure a low roll still picks the tightest, a high roll the first', () => {
  const a = [p('1x1'), p('1x1'), p('1x1')];
  const b = [p('v5'), p('sq3')]; // few ways through this board
  expect(chooseHand(HALF_FULL, [a, b], 0.5, 0.2)).toBe(b);
  expect(chooseHand(HALF_FULL, [a, b], 0.5, 0.8)).toBe(a);
});

test('same seed, same hands', () => {
  const ids = () => dealHand(HALF_FULL, 12, 99).hand.map((x) => x.id);
  expect(ids()).toEqual(ids());
});

test('a crowded bay falls back to singles', () => {
  const sq3s = [p('sq3'), p('sq3'), p('sq3')];
  expect(chooseHand(DIAGONAL, [sq3s], 1, 0)).toBeNull();
  const dealt = dealHand(DIAGONAL, 30, 1, () => ({ hands: [sq3s], rng: 1 }));
  expect(dealt.hand.map((x) => x.id)).toEqual(['1x1', '1x1', '1x1']);
});

test('dealing stays fast on an empty bay', () => {
  const start = performance.now();
  for (let seed = 0; seed < 50; seed++) dealHand(emptyBoard(), 30, seed);
  expect(performance.now() - start).toBeLessThan(2500);
});
