// The dealer: only ever deals a hand that can be fully placed, and leans
// harder as the run goes on, through the piece weights and by preferring the
// candidate hand with the fewest ways through. It never looks for a piece
// that would help: its only use of the board is the solver.
import { nextFloat } from '../../../engine/rng.ts';
import type { Board } from './board.ts';
import { type Group, type Piece, pieceById, PIECES } from './pieces.ts';
import { countWays, solvable } from './solver.ts';

export const PRESSURE_HANDS = 20; // hands until pressure is full
export const CANDIDATES = 8; // hands drawn per round
const EXTRA_ROUNDS = 4; // more rounds when no candidate can be placed
const HAND = 3;

const CALM: Record<Group, number> = { friendly: 6, medium: 3, awkward: 1 };
const MEAN: Record<Group, number> = { friendly: 2, medium: 3, awkward: 4 };
const GROUPS: readonly Group[] = ['friendly', 'medium', 'awkward'];
const BY_GROUP = new Map(GROUPS.map((g) => [g, PIECES.filter((piece) => piece.group === g)]));

export function pressure(handsDealt: number): number {
  return Math.min(1, handsDealt / PRESSURE_HANDS);
}

export function groupWeights(p: number): Record<Group, number> {
  const blend = (g: Group) => CALM[g] + (MEAN[g] - CALM[g]) * p;
  return { friendly: blend('friendly'), medium: blend('medium'), awkward: blend('awkward') };
}

function drawPiece(weights: Record<Group, number>, rng: number): [Piece, number] {
  const total = GROUPS.reduce((sum, g) => sum + weights[g], 0);
  let r: number;
  [r, rng] = nextFloat(rng);
  let pick = r * total;
  let group: Group = 'awkward';
  for (const g of GROUPS) {
    if (pick < weights[g]) {
      group = g;
      break;
    }
    pick -= weights[g];
  }
  const options = BY_GROUP.get(group)!;
  [r, rng] = nextFloat(rng);
  return [options[Math.floor(r * options.length)]!, rng];
}

export function drawCandidates(handsDealt: number, rng: number): { hands: Piece[][]; rng: number } {
  const weights = groupWeights(pressure(handsDealt));
  const hands: Piece[][] = [];
  for (let i = 0; i < CANDIDATES; i++) {
    const hand: Piece[] = [];
    for (let j = 0; j < HAND; j++) {
      let piece: Piece;
      [piece, rng] = drawPiece(weights, rng);
      hand.push(piece);
    }
    hands.push(hand);
  }
  return { hands, rng };
}

// With probability `p` (a roll below it) the candidate with the fewest ways
// through, the first on ties; otherwise the first that can be placed at all.
// Null when none can be placed.
export function chooseHand(board: Board, candidates: Piece[][], p: number, roll: number): Piece[] | null {
  const placeable = candidates.filter((hand) => solvable(board, hand));
  if (placeable.length === 0) return null;
  if (roll >= p) return placeable[0]!;
  let best = placeable[0]!;
  let bestWays = countWays(board, best);
  for (const hand of placeable.slice(1)) {
    const ways = countWays(board, hand);
    if (ways < bestWays) {
      best = hand;
      bestWays = ways;
    }
  }
  return best;
}

export function dealHand(board: Board, handsDealt: number, rng: number, draw = drawCandidates): { hand: Piece[]; rng: number } {
  const p = pressure(handsDealt);
  for (let round = 0; round <= EXTRA_ROUNDS; round++) {
    const drawn = draw(handsDealt, rng);
    let roll: number;
    [roll, rng] = nextFloat(drawn.rng);
    const hand = chooseHand(board, drawn.hands, p, roll);
    if (hand) return { hand, rng };
  }
  // Full lines clear at once, so every row keeps an empty cell and three
  // singles always fit.
  const single = pieceById('1x1');
  return { hand: [single, single, single], rng };
}
