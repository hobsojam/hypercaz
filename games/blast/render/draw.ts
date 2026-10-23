// Draws a BlastState. Read-only: nothing here changes the simulation.
import { drawCenteredText } from '../../../engine/ui.ts';
import { SIZE } from '../sim/board.ts';
import { type Piece, PIECES } from '../sim/pieces.ts';
import { type BlastState, fitsSomewhere } from '../sim/state.ts';
import { BAY, CELL, TRAY_CELL, traySlotCentre } from './layout.ts';

type Ctx = CanvasRenderingContext2D;

const OUTLINE = '#1A1A2E';
const CONCRETE = '#8C8F94';
const SEAM = 'rgba(26,26,46,0.18)';
const BAY_FLOOR = '#6E7278';
const HAZARD = '#F5C242';
const HAZARD_EDGE = 14;
const SLAB = 120; // the floor's poured slabs
const DIM = 0.35;
export const JAM_RED = '#C62828'; // the pieces left in a jammed hand

export interface BlastView {
  best: number;
  time: number;
  // The piece being dragged: its top-left in px, where it would land and
  // the lines it would complete.
  drag: { slot: number; x: number; y: number; ghost: { col: number; row: number } | null; glow: { rows: number[]; cols: number[] } } | null;
  hidden: Set<string>; // "col,row" cells currently animating away
  showHud?: boolean; // the score and best; off behind the title
}

// The concrete floor of the warehouse, with the seams between its slabs.
export function drawBackdrop(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = CONCRETE;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = SEAM;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let sx = Math.floor(x / SLAB) * SLAB; sx <= x + w; sx += SLAB) {
    ctx.moveTo(sx, y);
    ctx.lineTo(sx, y + h);
  }
  for (let sy = Math.floor(y / SLAB) * SLAB; sy <= y + h; sy += SLAB) {
    ctx.moveTo(x, sy);
    ctx.lineTo(x + w, sy);
  }
  ctx.stroke();
}

// A painted shipping crate: a bold fill, a dark outline, a light top-left
// edge and two plank lines.
export function drawCrate(ctx: Ctx, x: number, y: number, size: number, color: string, alpha = 1): void {
  const inset = Math.max(1, size * 0.04);
  const s = size - inset * 2;
  const x0 = x + inset;
  const y0 = y + inset;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = Math.max(1.5, size * 0.06);
  ctx.beginPath();
  ctx.roundRect(x0, y0, s, s, size * 0.1);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = Math.max(1, size * 0.05);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.moveTo(x0 + s * 0.12, y0 + s - s * 0.14);
  ctx.lineTo(x0 + s * 0.12, y0 + s * 0.12);
  ctx.lineTo(x0 + s - s * 0.14, y0 + s * 0.12);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(26,26,46,0.35)';
  ctx.lineWidth = Math.max(1, size * 0.035);
  ctx.beginPath();
  for (const f of [0.4, 0.68]) {
    ctx.moveTo(x0 + s * 0.2, y0 + s * f);
    ctx.lineTo(x0 + s * 0.88, y0 + s * f);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export function drawPiece(ctx: Ctx, piece: Piece, x: number, y: number, cell: number, alpha = 1, color = piece.color): void {
  for (const [c, r] of piece.cells) drawCrate(ctx, x + c * cell, y + r * cell, cell, color, alpha);
}

// The yellow-and-black hazard edge around the bay, and its floor.
function drawBay(ctx: Ctx): void {
  const e = HAZARD_EDGE;
  ctx.save();
  ctx.beginPath();
  ctx.rect(BAY.x - e, BAY.y - e, BAY.size + 2 * e, BAY.size + 2 * e);
  ctx.clip();
  ctx.fillStyle = HAZARD;
  ctx.fillRect(BAY.x - e, BAY.y - e, BAY.size + 2 * e, BAY.size + 2 * e);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 9;
  ctx.beginPath();
  for (let d = -BAY.size; d < 2 * BAY.size; d += 26) {
    ctx.moveTo(BAY.x - e + d, BAY.y - e);
    ctx.lineTo(BAY.x - e + d + BAY.size + 2 * e, BAY.y + BAY.size + e);
  }
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = BAY_FLOOR;
  ctx.fillRect(BAY.x, BAY.y, BAY.size, BAY.size);
  ctx.strokeStyle = 'rgba(26,26,46,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < SIZE; i++) {
    ctx.moveTo(BAY.x + i * CELL, BAY.y);
    ctx.lineTo(BAY.x + i * CELL, BAY.y + BAY.size);
    ctx.moveTo(BAY.x, BAY.y + i * CELL);
    ctx.lineTo(BAY.x + BAY.size, BAY.y + i * CELL);
  }
  ctx.stroke();
}

function drawCrates(ctx: Ctx, state: BlastState, hidden: Set<string>): void {
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const v = state.board[row * SIZE + col]!;
      if (v === 0 || hidden.has(`${col},${row}`)) continue;
      drawCrate(ctx, BAY.x + col * CELL, BAY.y + row * CELL, CELL, PIECES[v - 1]!.color);
    }
  }
}

// The lines the dragged piece would complete, pulsing.
function drawGlow(ctx: Ctx, glow: { rows: number[]; cols: number[] }, time: number): void {
  ctx.fillStyle = `rgba(255,236,150,${0.28 + 0.12 * Math.sin(time * 10)})`;
  for (const r of glow.rows) ctx.fillRect(BAY.x, BAY.y + r * CELL, BAY.size, CELL);
  for (const c of glow.cols) ctx.fillRect(BAY.x + c * CELL, BAY.y, CELL, BAY.size);
}

function drawTray(ctx: Ctx, state: BlastState, dragSlot: number | null): void {
  state.hand.forEach((piece, slot) => {
    if (!piece || slot === dragSlot) return;
    const c = traySlotCentre(slot);
    const alpha = fitsSomewhere(state, slot) ? 1 : DIM;
    const color = state.phase === 'over' ? JAM_RED : piece.color;
    drawPiece(ctx, piece, c.x - (piece.w * TRAY_CELL) / 2, c.y - (piece.h * TRAY_CELL) / 2, TRAY_CELL, alpha, color);
  });
}

// Where the dragged piece would land, and the lines it would complete.
function drawLanding(ctx: Ctx, piece: Piece, drag: NonNullable<BlastView['drag']>, time: number): void {
  drawGlow(ctx, drag.glow, time);
  if (drag.ghost) drawPiece(ctx, piece, BAY.x + drag.ghost.col * CELL, BAY.y + drag.ghost.row * CELL, CELL, DIM);
}

function drawHud(ctx: Ctx, state: BlastState, best: number): void {
  drawCenteredText(ctx, `Best: ${best}`, 270, 84, 24, '#F5C242');
  drawCenteredText(ctx, String(state.score), 270, 140, 64);
  if (state.streak >= 2) drawCenteredText(ctx, `×${state.streak}`, 420, 140, 40, '#FF8A1F');
}

export function renderBlast(ctx: Ctx, state: BlastState, view: BlastView): void {
  drawBay(ctx);
  drawCrates(ctx, state, view.hidden);
  const { drag } = view;
  const held = drag ? state.hand[drag.slot] : null;
  if (drag && held) drawLanding(ctx, held, drag, view.time);
  drawTray(ctx, state, drag?.slot ?? null);
  if (drag && held) drawPiece(ctx, held, drag.x, drag.y, CELL);
  if (view.showHud !== false) drawHud(ctx, state, view.best);
}
