// Mute and pause as on-screen buttons in the top-right corner, so they work
// on phones as well as from the keyboard (M, Esc). Stack's own small copy of
// Squad Shooter's controls.
import { drawCenteredText } from '../squad/ui.ts';
import { type StackGame, WIDTH } from './game.ts';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const SIZE = 40;
const SLOP = 10; // generous hit area for thumbs
export const MUTE_BUTTON: Rect = { x: WIDTH - SIZE - 8, y: 4, w: SIZE, h: SIZE };
export const PAUSE_BUTTON: Rect = { x: WIDTH - 2 * SIZE - 14, y: 4, w: SIZE, h: SIZE };
// Back to the game picker, top-left opposite the mute button.
export const ALL_GAMES_BUTTON: Rect = { x: 8, y: 4, w: 112, h: 40 };

export function hitRect(r: Rect, p: { x: number; y: number }, slop = SLOP): boolean {
  return p.x >= r.x - slop && p.x <= r.x + r.w + slop && p.y >= r.y - slop && p.y <= r.y + r.h + slop;
}

export function toggleMute(game: StackGame): void {
  game.audio.muted = !game.audio.muted;
  game.storage.set('muted', game.audio.muted);
}

// This frame's click, after the mute button and the M key have had their
// turn: a tap on the mute button is used up and returns null.
export function takeClick(game: StackGame): { x: number; y: number } | null {
  const { input } = game;
  if (input.consumeKey('m')) toggleMute(game);
  const click = input.consumeClick();
  if (click && hitRect(MUTE_BUTTON, click, 6)) {
    toggleMute(game);
    return null;
  }
  return click;
}

function drawDisc(ctx: CanvasRenderingContext2D, r: Rect): void {
  ctx.fillStyle = 'rgba(26,26,46,0.55)';
  ctx.beginPath();
  ctx.arc(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, 0, Math.PI * 2);
  ctx.fill();
}

export function drawMuteButton(ctx: CanvasRenderingContext2D, muted: boolean): void {
  const r = MUTE_BUTTON;
  drawDisc(ctx, r);
  const cx = r.x + r.w / 2 - 4;
  const cy = r.y + r.h / 2;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(cx - 9, cy - 5);
  ctx.lineTo(cx - 3, cy - 5);
  ctx.lineTo(cx + 4, cy - 11);
  ctx.lineTo(cx + 4, cy + 11);
  ctx.lineTo(cx - 3, cy + 5);
  ctx.lineTo(cx - 9, cy + 5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = muted ? '#FF6B6B' : '#FFFFFF';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (muted) {
    ctx.moveTo(cx + 8, cy - 6);
    ctx.lineTo(cx + 16, cy + 6);
    ctx.moveTo(cx + 16, cy - 6);
    ctx.lineTo(cx + 8, cy + 6);
  } else {
    ctx.arc(cx + 5, cy, 7, -Math.PI / 4, Math.PI / 4);
    ctx.moveTo(cx + 5 + 12 * Math.cos(-Math.PI / 4), cy + 12 * Math.sin(-Math.PI / 4));
    ctx.arc(cx + 5, cy, 12, -Math.PI / 4, Math.PI / 4);
  }
  ctx.stroke();
}

export function drawPauseButton(ctx: CanvasRenderingContext2D): void {
  const r = PAUSE_BUTTON;
  drawDisc(ctx, r);
  ctx.fillStyle = '#FFFFFF';
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  ctx.fillRect(cx - 8, cy - 9, 6, 18);
  ctx.fillRect(cx + 2, cy - 9, 6, 18);
}

export function drawAllGamesButton(ctx: CanvasRenderingContext2D): void {
  const b = ALL_GAMES_BUTTON;
  ctx.fillStyle = 'rgba(26,26,46,0.55)';
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, b.h / 2);
  ctx.fill();
  drawCenteredText(ctx, 'All games', b.x + b.w / 2, b.y + b.h / 2, 18);
}
