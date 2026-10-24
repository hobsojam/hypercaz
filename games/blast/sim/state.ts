// A run of Crate Blast: the bay, the hand, the score and streak, and the
// events the last placement caused, for the scene to turn into effects.
import { createRng } from '../../../engine/rng.ts';
import { type Board, canPlaceAnywhere, emptyBoard, fits, isEmpty, place, type Placement } from './board.ts';
import { dealHand } from './dealer.ts';
import type { Piece } from './pieces.ts';

export const STREAK_CAP = 8;
export const EMPTY_BONUS = 500;

// Clearing k lines with one placement: 10, 30, 60, 100, ...
export function linePoints(k: number): number {
  return (10 * k * (k + 1)) / 2;
}

export type BlastEvent =
  | { type: 'place'; slot: number; col: number; row: number; crates: number }
  | { type: 'clear'; rows: number[]; cols: number[]; cleared: Placement['cleared']; points: number; streak: number }
  | { type: 'empty'; points: number }
  | { type: 'deal' }
  | { type: 'jam' };

export interface BlastState {
  board: Board;
  hand: (Piece | null)[];
  score: number;
  streak: number; // consecutive hands with a clear
  clearedThisHand: boolean;
  handsDealt: number;
  rng: number;
  phase: 'play' | 'over';
  events: BlastEvent[];
}

function deal(state: BlastState): void {
  const dealt = dealHand(state.board, state.handsDealt, state.rng);
  state.hand = dealt.hand;
  state.rng = dealt.rng;
  state.handsDealt++;
  state.clearedThisHand = false;
}

export function createBlast(seed: number): BlastState {
  const state: BlastState = {
    board: emptyBoard(),
    hand: [],
    score: 0,
    streak: 0,
    clearedThisHand: false,
    handsDealt: 0,
    rng: createRng(seed),
    phase: 'play',
    events: [],
  };
  deal(state);
  return state;
}

export function fitsSomewhere(state: BlastState, slot: number): boolean {
  const piece = state.hand[slot];
  return piece ? canPlaceAnywhere(state.board, piece) : false;
}

function scoreClear(state: BlastState, placed: Placement): void {
  const lines = placed.rows.length + placed.cols.length;
  if (lines === 0) return;
  if (!state.clearedThisHand) {
    state.streak = Math.min(STREAK_CAP, state.streak + 1);
    state.clearedThisHand = true;
  }
  const points = linePoints(lines) * Math.max(1, state.streak);
  state.score += points;
  state.events.push({ type: 'clear', rows: placed.rows, cols: placed.cols, cleared: placed.cleared, points, streak: state.streak });
}

// Drops the piece in `slot` with its top-left at (col, row). False, with
// nothing changed, when the run is over, the slot is empty or it does not fit.
export function placePiece(state: BlastState, slot: number, col: number, row: number): boolean {
  const piece = state.hand[slot];
  if (state.phase === 'over' || !piece || !fits(state.board, piece, col, row)) return false;
  state.events = [];
  const placed = place(state.board, piece, col, row);
  state.board = placed.board;
  state.hand[slot] = null;
  state.score += piece.cells.length;
  state.events.push({ type: 'place', slot, col, row, crates: piece.cells.length });
  scoreClear(state, placed);
  if (isEmpty(state.board)) {
    state.score += EMPTY_BONUS;
    state.events.push({ type: 'empty', points: EMPTY_BONUS });
  }
  const left = state.hand.filter((p): p is Piece => p !== null);
  if (left.length === 0) {
    if (!state.clearedThisHand) state.streak = 0;
    deal(state);
    state.events.push({ type: 'deal' });
  } else if (!left.some((p) => canPlaceAnywhere(state.board, p))) {
    state.phase = 'over';
    state.events.push({ type: 'jam' });
  }
  return true;
}
