// Draws a MergeState. Read-only: nothing here changes the simulation.
import { drawCenteredText } from '../../../engine/ui.ts';
import { CRATE, DANGER_Y, DROP_Y, RADII } from '../sim/constants.ts';
import type { Ball } from '../sim/physics.ts';
import { overLine } from '../sim/state.ts';
import type { MergeState } from '../sim/state.ts';

type Ctx = CanvasRenderingContext2D;

const SNOW = '#F4F8FF';
const SHADE = '#C9D8F0';
const COAL = '#2A2A33';
const CARROT = '#F28C28';
const WOOD = '#8B5A2B';
const WOOD_DARK = '#5E3B18';
const ACCENTS = ['#E04848', '#2F7DE1', '#3CC85A', '#9B5DE5', '#F5C242'];

export interface PieceLook {
  face: boolean;
  nose: boolean;
  scarf: boolean;
  hat: boolean;
  earmuffs: boolean;
  accent: string | null;
}

export function pieceLook(size: number): PieceLook {
  return {
    face: size >= 5,
    nose: size >= 6,
    scarf: size >= 7,
    hat: size >= 8,
    earmuffs: size >= 9,
    accent: size >= 5 ? ACCENTS[size - 5] : null,
  };
}

function circle(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// A snowball: blue-shaded rim with a lighter lit face so neighbours separate.
function drawSnowBody(ctx: Ctx, x: number, y: number, r: number): void {
  circle(ctx, x, y, r, SHADE);
  circle(ctx, x - r * 0.08, y - r * 0.1, r * 0.88, SNOW);
}

function line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawSnowflake(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.strokeStyle = SHADE;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3;
    const dx = Math.cos(a) * r * 0.6;
    const dy = Math.sin(a) * r * 0.6;
    line(ctx, x - dx, y - dy, x + dx, y + dy);
  }
}

function drawPacked(ctx: Ctx, x: number, y: number, r: number): void {
  for (let i = 0; i < 5; i++) {
    const a = i * 2.4;
    circle(ctx, x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, r * 0.09, SHADE);
  }
}

function drawSparkles(ctx: Ctx, x: number, y: number, r: number, time: number): void {
  ctx.strokeStyle = '#8FB4E8';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + 0.5;
    const s = r * (0.1 + 0.05 * Math.sin(time * 4 + i * 2));
    const sx = x + Math.cos(a) * r * 0.5;
    const sy = y + Math.sin(a) * r * 0.5;
    line(ctx, sx - s, sy, sx + s, sy);
    line(ctx, sx, sy - s, sx, sy + s);
  }
}

function drawMark(ctx: Ctx, size: number, x: number, y: number, time: number): void {
  const r = RADII[size];
  if (size === 1) drawSnowflake(ctx, x, y, r);
  else if (size === 3) drawPacked(ctx, x, y, r);
  else if (size === 4) drawSparkles(ctx, x, y, r, time);
}

function drawEyes(ctx: Ctx, x: number, y: number, r: number): void {
  circle(ctx, x - r * 0.25, y - r * 0.2, r * 0.09, COAL);
  circle(ctx, x + r * 0.25, y - r * 0.2, r * 0.09, COAL);
  for (let i = -2; i <= 2; i++) circle(ctx, x + i * r * 0.11, y + r * 0.28 + Math.abs(i) * r * -0.03, r * 0.04, COAL);
}

function drawNose(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.fillStyle = CARROT;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.1, y - r * 0.02);
  ctx.lineTo(x + r * 0.48, y + r * 0.1);
  ctx.lineTo(x - r * 0.1, y + r * 0.16);
  ctx.closePath();
  ctx.fill();
}

function drawScarf(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.62, r * 0.62, r * 0.17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x + r * 0.15, y + r * 0.62, r * 0.2, r * 0.4);
}

function drawHat(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = COAL;
  ctx.fillRect(x - r * 0.62, y - r * 0.9, r * 1.24, r * 0.12);
  ctx.fillRect(x - r * 0.38, y - r * 1.4, r * 0.76, r * 0.54);
  ctx.fillStyle = color;
  ctx.fillRect(x - r * 0.38, y - r * 1.0, r * 0.76, r * 0.1);
}

function drawEarmuffs(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ctx.strokeStyle = COAL;
  ctx.lineWidth = Math.max(2, r * 0.05);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.88, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  circle(ctx, x - r * 0.84, y - r * 0.3, r * 0.2, color);
  circle(ctx, x + r * 0.84, y - r * 0.3, r * 0.2, color);
}

function drawMittens(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  circle(ctx, x - r * 0.98, y + r * 0.25, r * 0.14, color);
  circle(ctx, x + r * 0.98, y + r * 0.25, r * 0.14, color);
}

function drawRing(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.06);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.93, 0, Math.PI * 2);
  ctx.stroke();
}

function drawDress(ctx: Ctx, look: PieceLook, x: number, y: number, r: number): void {
  const accent = look.accent ?? SHADE;
  if (look.nose) drawNose(ctx, x, y, r);
  else drawRing(ctx, x, y, r, accent);
  if (look.scarf) drawScarf(ctx, x, y, r, accent);
  if (look.hat) drawHat(ctx, x, y, r, accent);
  if (look.earmuffs) {
    drawEarmuffs(ctx, x, y, r, accent);
    drawMittens(ctx, x, y, r, accent);
  }
}

export function drawPiece(ctx: Ctx, size: number, x: number, y: number, time: number): void {
  const r = RADII[size];
  drawSnowBody(ctx, x, y, r);
  const look = pieceLook(size);
  if (!look.face) {
    drawMark(ctx, size, x, y, time);
    return;
  }
  drawEyes(ctx, x, y, r);
  if (size === 6) drawRing(ctx, x, y, r, look.accent ?? SHADE);
  drawDress(ctx, look, x, y, r);
}

// Backdrop ---------------------------------------------------------------

function drawTree(ctx: Ctx, x: number, base: number, s: number): void {
  ctx.fillStyle = '#16302A';
  for (let i = 0; i < 3; i++) {
    const w = (46 - i * 10) * s;
    const top = base - (40 + i * 30) * s;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x + w, top + 50 * s);
    ctx.lineTo(x - w, top + 50 * s);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = SNOW;
  ctx.fillRect(x - 3 * s, base - 4 * s, 6 * s, 8 * s);
}

function drawFence(ctx: Ctx, x: number, w: number, y: number): void {
  ctx.fillStyle = '#6B5A48';
  ctx.fillRect(x, y + 14, w, 6);
  ctx.fillRect(x, y + 34, w, 6);
  for (let px = x + 10; px < x + w; px += 36) {
    ctx.fillRect(px, y, 14, 56);
    circle(ctx, px + 7, y, 3, SNOW);
  }
}

function drawFlakes(ctx: Ctx, x: number, y: number, w: number, h: number, time: number): void {
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 40; i++) {
    const fall = time * (14 + (i % 4) * 6) + i * 53;
    const fx = x + ((i * 97 + Math.sin(time * 0.6 + i) * 12 + w) % w);
    const fy = y + (fall % h);
    ctx.beginPath();
    ctx.arc(fx, fy, 1.5 + (i % 3) * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawBackdrop(ctx: Ctx, x: number, y: number, w: number, h: number, time: number): void {
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, '#1E2A4A');
  sky.addColorStop(1, '#5A6FA0');
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  const ground = y + h * 0.72;
  [0.12, 0.88, 0.3, 0.72].forEach((f, i) => drawTree(ctx, x + w * f, ground + 6, 0.9 + (i % 2) * 0.3));
  drawFence(ctx, x, w, ground - 36);
  ctx.fillStyle = SHADE;
  ctx.fillRect(x, ground, w, y + h - ground);
  ctx.fillStyle = SNOW;
  ctx.fillRect(x, ground + 10, w, y + h - ground - 10);
  drawFlakes(ctx, x, y, w, h, time);
}

// Crate ------------------------------------------------------------------

function drawCrateBack(ctx: Ctx): void {
  ctx.fillStyle = WOOD_DARK;
  ctx.fillRect(CRATE.left, CRATE.top, CRATE.right - CRATE.left, CRATE.floor - CRATE.top);
}

function drawCrateFront(ctx: Ctx): void {
  const { left, right, top, floor } = CRATE;
  const t = 18;
  ctx.fillStyle = WOOD;
  ctx.fillRect(left - t, top, t, floor - top + t);
  ctx.fillRect(right, top, t, floor - top + t);
  ctx.fillRect(left - t, floor, right - left + t * 2, t);
  ctx.fillStyle = WOOD_DARK;
  for (let y = top + 60; y < floor + t; y += 90) {
    ctx.fillRect(left - t, y, t, 3);
    ctx.fillRect(right, y, t, 3);
  }
  ctx.fillRect(left - t, floor + t / 2, right - left + t * 2, 3);
}

function dangerColor(over: boolean, time: number): string {
  if (!over) return 'rgba(255,255,255,0.35)';
  return Math.floor(time * 4) % 2 === 0 ? '#FF3B3B' : '#FF8A8A';
}

function drawDangerLine(ctx: Ctx, state: MergeState, time: number): void {
  ctx.strokeStyle = dangerColor(overLine(state), time);
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 10]);
  line(ctx, CRATE.left, DANGER_Y, CRATE.right, DANGER_Y);
  ctx.setLineDash([]);
}

// Hanging ball ------------------------------------------------------------

function drawHanging(ctx: Ctx, state: MergeState, time: number): void {
  if (state.phase !== 'play') return;
  const r = RADII[state.current];
  ctx.save();
  ctx.globalAlpha = state.cooldown > 0 ? 0.35 : 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 8]);
  line(ctx, state.aimX, DROP_Y + r, state.aimX, CRATE.floor);
  ctx.setLineDash([]);
  drawPiece(ctx, state.current, state.aimX, DROP_Y, time);
  ctx.restore();
}

// Family ------------------------------------------------------------------

interface Walker {
  dx: number;
  scale: number;
  phase: number;
  color: string;
}

function drawArm(ctx: Ctx, x: number, y: number, side: number, wave: number): void {
  ctx.strokeStyle = WOOD;
  ctx.lineWidth = 3;
  line(ctx, x + side * 30, y, x + side * 52, y - 14 - wave * 14);
}

function drawWalker(ctx: Ctx, w: Walker, x: number, y: number, t: number): void {
  const s = w.scale;
  const bob = Math.abs(Math.sin(t * 6 + w.phase)) * 5;
  const cx = x + w.dx;
  const baseY = y - bob;
  const bodyR = 36 * s;
  const headR = 26 * s;
  const headY = baseY - bodyR * 2 - headR * 0.6;
  drawArm(ctx, cx, baseY - bodyR * 1.3, -1, 0);
  drawArm(ctx, cx, baseY - bodyR * 1.3, 1, Math.sin(t * 8 + w.phase));
  drawSnowBody(ctx, cx, baseY - bodyR, bodyR);
  drawSnowBody(ctx, cx, headY, headR);
  drawEyes(ctx, cx, headY, headR);
  drawNose(ctx, cx, headY, headR);
  drawScarf(ctx, cx, headY, headR, w.color);
  drawHat(ctx, cx, headY, headR, w.color);
}

const WALKERS: readonly Walker[] = [
  { dx: -92, scale: 1, phase: 0, color: ACCENTS[0] },
  { dx: 0, scale: 0.7, phase: 1.5, color: ACCENTS[2] },
  { dx: 92, scale: 1, phase: 3, color: ACCENTS[1] },
];

export function drawFamily(ctx: Ctx, x: number, y: number, t: number): void {
  for (const w of WALKERS) drawWalker(ctx, w, x, y, t);
}

// HUD ---------------------------------------------------------------------

function drawHud(ctx: Ctx, state: MergeState, best: number, time: number): void {
  drawCenteredText(ctx, String(state.score), 270, 60, 64);
  drawCenteredText(ctx, `Best: ${best}`, 270, 110, 24, '#C9D8F0');
  drawPiece(ctx, state.next, 420, 110, time);
  drawCenteredText(ctx, 'Next', 492, 110, 20, '#C9D8F0');
}

export interface MergeView {
  time: number;
  best: number;
  families: { x: number; y: number; t: number }[];
}

function drawBalls(ctx: Ctx, balls: readonly Ball[], time: number): void {
  for (const b of balls) drawPiece(ctx, b.size, b.x, b.y, time);
}

export function renderMerge(ctx: Ctx, state: MergeState, view: MergeView): void {
  drawCrateBack(ctx);
  drawBalls(ctx, state.balls, view.time);
  drawCrateFront(ctx);
  drawDangerLine(ctx, state, view.time);
  drawHanging(ctx, state, view.time);
  for (const f of view.families) drawFamily(ctx, f.x, f.y, f.t);
  drawHud(ctx, state, view.best, view.time);
}
