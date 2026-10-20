// Mute, pause and "All games" as on-screen buttons, so they work on phones as
// well as from the keyboard (M, Esc). Shared by every game; each game says how
// a mute change is remembered.
import type { GameAudio } from './audio.ts';
import type { Input } from './input.ts';
import { drawCenteredText } from './ui.ts';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// What the controls need from a game.
export interface ControlsGame {
  input: Pick<Input, 'consumeKey' | 'consumeClick'>;
  audio: Pick<GameAudio, 'muted'>;
}

const WIDTH = 540; // the width of the fixed-column games
const SIZE = 40;
const SLOP = 10; // generous hit area for thumbs

// The buttons for a screen of the given width: mute and pause at the top
// right, and "All games" (back to the game picker) top-left opposite them.
export function controlRects(width: number): { mute: Rect; pause: Rect; allGames: Rect } {
  return {
    mute: { x: width - SIZE - 8, y: 4, w: SIZE, h: SIZE },
    pause: { x: width - 2 * SIZE - 14, y: 4, w: SIZE, h: SIZE },
    allGames: { x: 8, y: 4, w: 112, h: 40 },
  };
}
const FIXED = controlRects(WIDTH);
export const MUTE_BUTTON: Rect = FIXED.mute;
export const PAUSE_BUTTON: Rect = FIXED.pause;
export const ALL_GAMES_BUTTON: Rect = FIXED.allGames;

export function hitRect(r: Rect, p: { x: number; y: number }, slop = SLOP): boolean {
  return p.x >= r.x - slop && p.x <= r.x + r.w + slop && p.y >= r.y - slop && p.y <= r.y + r.h + slop;
}

export function hitAllGames(click: { x: number; y: number } | null, rect: Rect = ALL_GAMES_BUTTON): boolean {
  return click !== null && hitRect(rect, click, 0);
}

// What a title screen should do with this frame's click: go back to the
// picker, start the game (also on Enter or Space), or nothing.
export function titleAction(game: ControlsGame & { audio: Pick<GameAudio, 'unlock'> }, click: { x: number; y: number } | null): 'games' | 'start' | null {
  if (hitAllGames(click)) return 'games';
  if (click || game.input.consumeKey('Enter') || game.input.consumeKey(' ')) {
    game.audio.unlock();
    return 'start';
  }
  return null;
}

export function toggleMute(game: ControlsGame, remember: (muted: boolean) => void): void {
  game.audio.muted = !game.audio.muted;
  remember(game.audio.muted);
}

// This frame's click, after the mute button and the M key have had their
// turn: a tap on the mute button is used up and returns null.
export function takeClick(game: ControlsGame, remember: (muted: boolean) => void, width = WIDTH): { x: number; y: number } | null {
  const { input } = game;
  if (input.consumeKey('m')) toggleMute(game, remember);
  const click = input.consumeClick();
  if (click && hitRect(controlRects(width).mute, click, 6)) {
    toggleMute(game, remember);
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

export function drawMuteButton(ctx: CanvasRenderingContext2D, muted: boolean, r: Rect = MUTE_BUTTON): void {
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

export function drawPauseButton(ctx: CanvasRenderingContext2D, r: Rect = PAUSE_BUTTON): void {
  drawDisc(ctx, r);
  ctx.fillStyle = '#FFFFFF';
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  ctx.fillRect(cx - 8, cy - 9, 6, 18);
  ctx.fillRect(cx + 2, cy - 9, 6, 18);
}

export function drawAllGamesButton(ctx: CanvasRenderingContext2D, b: Rect = ALL_GAMES_BUTTON): void {
  ctx.fillStyle = 'rgba(26,26,46,0.55)';
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, b.h / 2);
  ctx.fill();
  drawCenteredText(ctx, 'All games', b.x + b.w / 2, b.y + b.h / 2, 18);
}
