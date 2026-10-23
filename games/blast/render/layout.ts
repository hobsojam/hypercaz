// Where the bay and the tray sit in the 540x960 column, and how a pointer
// maps onto them.
import type { Piece } from '../sim/pieces.ts';
import type { BlastState } from '../sim/state.ts';

export const CELL = 60;
export const BAY = { x: 30, y: 210, size: 480 };
export const TRAY_Y = 800;
export const TRAY_CELL = 30;
export const TOUCH_LIFT = 1.5 * CELL; // a dragged piece floats this far above a finger
const TRAY_XS = [90, 270, 450];
const TRAY_SLOP = 12;

export function traySlotCentre(slot: number): { x: number; y: number } {
  return { x: TRAY_XS[slot]!, y: TRAY_Y };
}

// The top-left of a dragged piece centred on the pointer, in px.
export function pieceOrigin(piece: Piece, px: number, py: number, touch: boolean): { x: number; y: number } {
  return { x: px - (piece.w * CELL) / 2, y: py - (piece.h * CELL) / 2 - (touch ? TOUCH_LIFT : 0) };
}

// The bay cell nearest a dragged piece's top-left. It may be off the bay;
// `fits` decides.
export function snapCell(piece: Piece, px: number, py: number, touch: boolean): { col: number; row: number } {
  const o = pieceOrigin(piece, px, py, touch);
  return { col: Math.round((o.x - BAY.x) / CELL), row: Math.round((o.y - BAY.y) / CELL) };
}

// The tray slot whose piece (plus some slop) is under the point.
export function trayHit(state: Pick<BlastState, 'hand'>, p: { x: number; y: number }): number | null {
  for (let slot = 0; slot < state.hand.length; slot++) {
    const piece = state.hand[slot];
    if (!piece) continue;
    const c = traySlotCentre(slot);
    const hw = (piece.w * TRAY_CELL) / 2 + TRAY_SLOP;
    const hh = (piece.h * TRAY_CELL) / 2 + TRAY_SLOP;
    if (Math.abs(p.x - c.x) <= hw && Math.abs(p.y - c.y) <= hh) return slot;
  }
  return null;
}
