import type { Scene } from '../../../engine/scenes.ts';
import { drawPausedOverlay } from '../../../engine/ui.ts';
import {
  ALL_GAMES_BUTTON,
  drawAllGamesButton,
  drawGameOver,
  drawMuteButton,
  drawPauseButton,
  gameOverAction,
  hitRect,
  MUTE_BUTTON,
  OVER_DELAY,
  PAUSE_BUTTON,
  takeClick,
} from '../controls.ts';
import { type BlastGame, HEIGHT, loadBest, WIDTH } from '../game.ts';
import { type BlastView, renderBlast } from '../render/draw.ts';
import { Effects } from '../render/effects.ts';
import { BAY, CELL, pieceOrigin, snapCell, trayHit } from '../render/layout.ts';
import { fits, place, SIZE } from '../sim/board.ts';
import { type BlastEvent, type BlastState, createBlast, placePiece } from '../sim/state.ts';

const JAM_TIME = 0.8; // the jam moment before the result screen
const PITCH_STEP = 0.08; // the clear sound rises this much per streak step
const ARROWS: Record<string, [number, number]> = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] };

type Point = { x: number; y: number };

// A piece held by the pointer follows it; one held by the keyboard sits on a
// bay cell that the arrows move.
type Held = { slot: number; by: 'pointer'; x: number; y: number } | { slot: number; by: 'keys'; col: number; row: number };

export class PlayScene implements Scene {
  private readonly game: BlastGame;
  private readonly state: BlastState;
  private readonly effects = new Effects();
  private drag: Held | null = null;
  private preview: { key: string; view: Pick<NonNullable<BlastView['drag']>, 'ghost' | 'glow'> } | null = null;
  private paused = false;
  private overFor = 0;
  private best: number;
  private newBest = false;
  navigate: (url: string) => void = (url) => {
    window.location.href = url;
  };

  constructor(game: BlastGame, seed = Date.now() >>> 0) {
    this.game = game;
    this.state = createBlast(seed);
    this.best = loadBest(game.storage);
  }

  suspend(): void {
    this.drag = null;
    if (this.state.phase === 'play') this.paused = true;
  }

  update(dt: number): void {
    const { input } = this.game;
    if (input.consumeKey('Escape') && this.state.phase === 'play') {
      if (this.drag) this.drag = null;
      else this.paused = !this.paused;
    }
    const click = takeClick(this.game);
    const release = input.consumeRelease();
    if (this.paused) {
      if (click) this.paused = false;
      this.drag = null;
      return;
    }
    this.game.time += dt;
    this.effects.update(dt);
    if (this.state.phase === 'over') {
      this.updateOver(dt, click);
      return;
    }
    if (click && hitRect(ALL_GAMES_BUTTON, click, 0)) {
      this.navigate('../');
      return;
    }
    if (click && hitRect(PAUSE_BUTTON, click, 6)) {
      this.paused = true;
      this.drag = null;
      return;
    }
    this.pointer(click, release);
    this.keys();
  }

  // A press on a tray piece picks it up, and its release drops it where it
  // snaps. A release that does not fit, or a cancelled press, puts it back.
  private pointer(click: Point | null, release: Point | null): void {
    const { input } = this.game;
    if (click && !this.onButton(click)) {
      const slot = trayHit(this.state, click);
      if (slot !== null) this.drag = { slot, by: 'pointer', x: click.x, y: click.y };
    }
    const held = this.drag;
    if (held?.by !== 'pointer') return;
    if (release) {
      this.drag = null;
      this.dropAt(held.slot, release.x, release.y);
    } else if (input.held) {
      held.x = input.pointerX ?? held.x;
      held.y = input.pointerY ?? held.y;
    } else {
      this.drag = null;
    }
  }

  private dropAt(slot: number, x: number, y: number): void {
    const piece = this.state.hand[slot];
    if (!piece) return;
    const { col, row } = snapCell(piece, x, y, this.game.input.touch);
    this.tryPlace(slot, col, row);
  }

  // 1, 2 and 3 pick up a tray piece onto the bay's top-left; arrows move it
  // and keep it on the bay; Enter or Space drops it.
  private keys(): void {
    const { input } = this.game;
    for (let slot = 0; slot < 3; slot++) {
      if (input.consumeKey(String(slot + 1)) && this.state.hand[slot]) this.drag = { slot, by: 'keys', col: 0, row: 0 };
    }
    const held = this.drag;
    if (held?.by !== 'keys') return;
    const piece = this.state.hand[held.slot]!;
    for (const [key, [dc, dr]] of Object.entries(ARROWS)) {
      if (!input.consumeKey(key)) continue;
      held.col = Math.max(0, Math.min(SIZE - piece.w, held.col + dc));
      held.row = Math.max(0, Math.min(SIZE - piece.h, held.row + dr));
    }
    if (input.consumeKey('Enter') || input.consumeKey(' ')) this.tryPlace(held.slot, held.col, held.row);
  }

  private tryPlace(slot: number, col: number, row: number): void {
    const piece = this.state.hand[slot];
    if (!piece || !placePiece(this.state, slot, col, row)) return;
    this.drag = null;
    this.preview = null; // the board and hand changed
    // The crates still standing squash as they land; cleared ones sweep away.
    const landed = piece.cells.map(([c, r]) => ({ col: col + c, row: row + r, value: this.state.board[(row + r) * SIZE + col + c]! }));
    this.effects.land(landed.filter((c) => c.value !== 0));
    for (const e of this.state.events) this.react(e);
  }

  private onButton(p: Point): boolean {
    return hitRect(PAUSE_BUTTON, p, 6) || hitRect(MUTE_BUTTON, p, 6) || hitRect(ALL_GAMES_BUTTON, p, 0);
  }

  private react(e: BlastEvent): void {
    const { audio } = this.game;
    if (e.type === 'place') {
      audio.play('place');
    } else if (e.type === 'clear') {
      this.effects.sweep(e.cleared, e.rows, e.cols);
      const lines = e.rows.length + e.cols.length;
      const at = centre(e.cleared);
      this.effects.popup(e.streak >= 2 ? `+${e.points} ×${e.streak}` : `+${e.points}`, at.x, at.y, lines >= 2);
      audio.play('clear', 1 + PITCH_STEP * (e.streak - 1));
    } else if (e.type === 'empty') {
      this.effects.flash();
      this.effects.popup(`EMPTY BAY! +${e.points}`, WIDTH / 2, BAY.y + BAY.size / 2, true);
      audio.play('win');
    } else if (e.type === 'jam') {
      this.effects.shake();
      audio.play('fail');
      this.finish();
    }
  }

  private updateOver(dt: number, click: Point | null): void {
    this.overFor += dt;
    if (this.overFor < JAM_TIME) return;
    const action = gameOverAction(this.game, click, this.overFor - JAM_TIME);
    if (action === 'games') this.navigate('../');
    else if (action === 'again') this.game.stack.replace(new PlayScene(this.game));
  }

  private finish(): void {
    if (this.state.score > this.best) {
      this.best = this.state.score;
      this.newBest = true;
      this.game.storage.set('best', this.state.score);
    }
  }

  // What the renderer needs to draw the held piece: where it is, and where it
  // would land with the lines it would complete. Recomputed only when the
  // snapped cell changes.
  private dragView(): BlastView['drag'] {
    const held = this.drag;
    const piece = held ? this.state.hand[held.slot] : null;
    if (!held || !piece) return null;
    const cell = held.by === 'keys' ? { col: held.col, row: held.row } : snapCell(piece, held.x, held.y, this.game.input.touch);
    const key = `${held.slot}:${cell.col},${cell.row}`;
    if (this.preview?.key !== key) {
      const ok = fits(this.state.board, piece, cell.col, cell.row);
      const placed = ok ? place(this.state.board, piece, cell.col, cell.row) : null;
      this.preview = { key, view: { ghost: ok ? cell : null, glow: { rows: placed?.rows ?? [], cols: placed?.cols ?? [] } } };
    }
    const origin = held.by === 'keys' ? { x: BAY.x + held.col * CELL, y: BAY.y + held.row * CELL } : pieceOrigin(piece, held.x, held.y, this.game.input.touch);
    return { slot: held.slot, ...origin, ...this.preview.view };
  }

  render(ctx: CanvasRenderingContext2D): void {
    const shake = this.effects.offset();
    ctx.save();
    ctx.translate(shake.x, shake.y);
    renderBlast(ctx, this.state, { best: this.best, time: this.game.time, drag: this.dragView(), hidden: this.effects.hidden() });
    this.effects.draw(ctx);
    ctx.restore();
    if (this.state.phase === 'over' && this.overFor >= JAM_TIME) {
      drawGameOver(ctx, WIDTH, HEIGHT, { scoreLabel: 'Score', score: this.state.score, best: this.best, newBest: this.newBest, showAgain: this.overFor - JAM_TIME >= OVER_DELAY });
    } else if (this.paused) {
      drawPausedOverlay(ctx, WIDTH, HEIGHT, this.game.input.touch);
    } else {
      drawAllGamesButton(ctx);
      drawPauseButton(ctx);
    }
    drawMuteButton(ctx, this.game.audio.muted);
  }
}

// The middle of the cleared cells, kept clear of the column's edges, for the
// score pop-up.
function centre(cells: { col: number; row: number }[]): Point {
  const n = Math.max(1, cells.length);
  const col = cells.reduce((s, c) => s + c.col, 0) / n;
  const row = cells.reduce((s, c) => s + c.row, 0) / n;
  return { x: Math.max(110, Math.min(WIDTH - 110, BAY.x + (col + 0.5) * CELL)), y: BAY.y + (row + 0.5) * CELL };
}
