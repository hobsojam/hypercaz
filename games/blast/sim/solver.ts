// Exact search for ways to place a whole hand, in any order, with lines
// clearing between placements. The dealer only needs to tell "none" from
// "few" from "many", so counting stops at a cap.
import { type Board, fits, place, SIZE } from './board.ts';
import type { Piece } from './pieces.ts';

export const WAYS_CAP = 64;

// The number of (order, positions) sequences that place every piece in the
// hand, up to `cap`. Identical pieces count once per depth, so a hand of
// three singles is not counted six times over.
export function countWays(board: Board, hand: readonly Piece[], cap = WAYS_CAP): number {
  if (hand.length === 0) return 1;
  let ways = 0;
  const tried = new Set<string>();
  for (let i = 0; i < hand.length && ways < cap; i++) {
    const piece = hand[i]!;
    if (tried.has(piece.id)) continue;
    tried.add(piece.id);
    ways += waysPlacingFirst(board, piece, hand.filter((_, j) => j !== i), cap - ways);
  }
  return Math.min(ways, cap);
}

// The ways through that start by placing `piece`, up to `cap`.
function waysPlacingFirst(board: Board, piece: Piece, rest: readonly Piece[], cap: number): number {
  let ways = 0;
  for (let row = 0; row + piece.h <= SIZE; row++) {
    for (let col = 0; col + piece.w <= SIZE; col++) {
      if (!fits(board, piece, col, row)) continue;
      ways += countWays(place(board, piece, col, row).board, rest, cap - ways);
      if (ways >= cap) return cap;
    }
  }
  return ways;
}

export function solvable(board: Board, hand: readonly Piece[]): boolean {
  return countWays(board, hand, 1) > 0;
}
