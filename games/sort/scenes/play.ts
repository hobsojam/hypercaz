import { ParticlePool } from '../../../engine/particles.ts';
import type { Scene } from '../../../engine/scenes.ts';
import { drawPausedOverlay } from '../../../engine/ui.ts';
import { controlRects, drawAllGamesButton, drawMuteButton, drawPauseButton, hitAllGames, hitRect, type Rect, takeClick } from '../controls.ts';
import type { SortGame } from '../game.ts';
import { COLORS, drawScene, drawSymbolsButton, FLOW_END, type PourAnim } from '../render/draw.ts';
import { buttonRects, layoutTubes, LIFT, symbolsRect, tubeAt } from '../render/layout.ts';
import { type Board, hasLegalMove, isDone, isWon, pour } from '../sim/board.ts';
import { generateLevel } from '../sim/levels.ts';

const POUR_TIME = 0.4; // seconds; visual only, the board changes at once
const SHAKE_TIME = 0.3;
const SHINE_TIME = 0.9;
const CELEBRATE_TIME = 1.5;
const GRAVITY = 900; // px/s^2, for the confetti

// What waits for the poured liquid to land: a finished tube's chime and
// shine, and the level-clear flourish.
interface Landing {
  done: number | null;
  won: boolean;
}

export class PlayScene implements Scene {
  readonly level: number;
  private game: SortGame;
  private start: Board;
  private current: Board;
  private history: Board[] = [];
  private liftedTube: number | null = null;
  private anim: PourAnim | null = null;
  private landing: Landing | null = null;
  private shake = 0; // seconds left
  private shine: number[] = []; // seconds left, per tube
  private celebrate: number | null = null; // seconds into the celebration
  private particles = new ParticlePool(160);
  private time = 0;
  private finished = false; // replaced by the next level
  paused = false;
  navigate: (url: string) => void = (url) => {
    window.location.href = url;
  };

  constructor(game: SortGame, level: number) {
    this.game = game;
    this.level = level;
    this.start = generateLevel(level);
    this.current = this.start;
  }

  get board(): Board {
    return this.current;
  }
  get lifted(): number | null {
    return this.liftedTube;
  }
  get shaking(): boolean {
    return this.shake > 0;
  }
  get celebrating(): boolean {
    return this.celebrate !== null;
  }
  // No legal pour anywhere: say so gently. Pointless pours still count.
  get stuck(): boolean {
    return !isWon(this.current) && !hasLegalMove(this.current);
  }

  suspend(): void {
    this.paused = true;
  }

  private rects(): Rect[] {
    const { w, h } = this.game.view;
    return layoutTubes(this.current.tubes.length, w, h);
  }

  update(dt: number): void {
    if (this.finished) return;
    const { input } = this.game;
    if (input.consumeKey('Escape') && this.celebrate === null) this.paused = !this.paused;
    const click = takeClick(this.game);
    if (this.paused) {
      if (click) this.paused = false;
      return;
    }
    this.time += dt;
    this.animate(dt);
    if (input.consumeKey('s')) this.toggleSymbols();
    const { w, h } = this.game.view;
    const controls = controlRects(w);
    if (hitAllGames(click, controls.allGames)) {
      this.navigate('../');
      return;
    }
    if (this.celebrate !== null) {
      // Undo and restart can't take the win back; a click skips ahead.
      for (const k of ['z', 'backspace', 'r']) input.consumeKey(k);
      if (click || this.celebrate >= CELEBRATE_TIME) this.next();
      return;
    }
    if (input.consumeKey('z') || input.consumeKey('Backspace')) this.undo();
    if (input.consumeKey('r')) this.restart();
    if (!click) return;
    if (hitRect(controls.pause, click, 6)) {
      this.paused = true;
      return;
    }
    if (hitRect(symbolsRect(w), click, 6)) {
      this.toggleSymbols();
      return;
    }
    const buttons = buttonRects(w, h);
    if (hitRect(buttons.undo, click, 4)) return this.undo();
    if (hitRect(buttons.restart, click, 4)) return this.restart();
    this.clickTube(this.hitTube(click));
  }

  // The tube under the pointer; a lifted tube is hit where it is drawn, too.
  private hitTube(p: { x: number; y: number }): number | null {
    const rects = this.rects();
    const i = this.liftedTube;
    if (i !== null && rects[i]) {
      const r = rects[i];
      const rise = r.w * LIFT;
      rects[i] = { ...r, y: r.y - rise, h: r.h + rise };
    }
    return tubeAt(rects, p.x, p.y);
  }

  private clickTube(i: number | null): void {
    const from = this.liftedTube;
    if (i === null || i === from) {
      this.liftedTube = null;
      return;
    }
    if (from === null) {
      if (this.current.tubes[i]!.length > 0) this.liftedTube = i;
      return;
    }
    const result = pour(this.current, from, i);
    if (!result) {
      this.shake = SHAKE_TIME;
      return;
    }
    this.land(); // a pour still in flight finishes at once
    const before = this.current;
    this.history.push(before);
    this.current = result.board;
    this.liftedTube = null;
    this.shake = 0;
    const color = before.tubes[from]!.at(-1)!;
    this.anim = { from, to: i, color, moved: result.moved, t: 0 };
    const finished = isDone(result.board.tubes[i]!) && !isDone(before.tubes[i]!);
    const won = isWon(result.board);
    this.landing = { done: finished ? i : null, won };
    this.game.audio.play('pour');
    if (won) {
      this.game.storage.set('level', this.level + 1);
      this.celebrate = 0;
    }
  }

  // The liquid has landed: chime, shine and celebrate.
  private land(): void {
    const landing = this.landing;
    this.anim = null;
    this.landing = null;
    if (!landing) return;
    const { audio } = this.game;
    if (landing.done !== null) {
      audio.play('fill');
      this.shine[landing.done] = SHINE_TIME;
    }
    if (landing.won) {
      audio.play('clear');
      this.burst();
    }
  }

  private animate(dt: number): void {
    this.shake = Math.max(0, this.shake - dt);
    this.shine = this.shine.map((s) => Math.max(0, s - dt));
    if (this.celebrate !== null) this.celebrate += dt;
    this.particles.update(dt, GRAVITY);
    if (!this.anim) return;
    this.anim.t = Math.min(1, this.anim.t + dt / POUR_TIME);
    if (this.landing && this.anim.t >= FLOW_END) {
      const anim = this.anim;
      this.land();
      this.anim = anim; // keep drawing the swing back
    }
    if (this.anim.t >= 1) this.anim = null;
  }

  // Confetti in the level's colours, from the top of every tube.
  private burst(): void {
    const colors = new Set(this.current.tubes.flat());
    const palette = [...colors].map((c) => COLORS[c % COLORS.length]!);
    this.rects().forEach((r, i) => {
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
        const speed = 260 + Math.random() * 260;
        this.particles.emit({
          x: r.x + r.w / 2,
          y: r.y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          life: 1 + Math.random() * 0.5,
          color: palette[(i + k) % palette.length] ?? '#FFFFFF',
          size: 5 + Math.random() * 4,
          spin: 0,
        });
      }
    });
  }

  private undo(): void {
    const prev = this.history.pop();
    if (!prev) return;
    this.reset(prev);
  }

  private restart(): void {
    this.history = [];
    this.reset(this.start);
  }

  private reset(board: Board): void {
    this.current = board;
    this.anim = null;
    this.landing = null;
    this.liftedTube = null;
    this.shake = 0;
    this.shine = [];
  }

  private toggleSymbols(): void {
    this.game.symbols = !this.game.symbols;
    this.game.storage.set('symbols', this.game.symbols);
  }

  private next(): void {
    this.land(); // a skip never swallows the landing: the clear sound and confetti still happen
    this.finished = true; // only once, whatever else arrives
    this.game.stack.replace(new PlayScene(this.game, this.level + 1));
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { w, h } = this.game.view;
    drawScene(ctx, {
      board: this.current,
      rects: this.rects(),
      view: this.game.view,
      lifted: this.liftedTube,
      pour: this.anim,
      symbols: this.game.symbols,
      level: this.level,
      time: this.time,
      stuck: this.stuck,
      celebrating: this.celebrate === null ? null : Math.min(1, this.celebrate / CELEBRATE_TIME),
      shake: this.shake / SHAKE_TIME,
      shine: this.shine.map((s) => s / SHINE_TIME),
      canUndo: this.history.length > 0,
      particles: this.particles,
    });
    const controls = controlRects(w);
    drawAllGamesButton(ctx, controls.allGames);
    if (this.paused) {
      drawPausedOverlay(ctx, w, h, this.game.input.touch);
    } else {
      drawSymbolsButton(ctx, symbolsRect(w), this.game.symbols);
      drawPauseButton(ctx, controls.pause);
    }
    drawMuteButton(ctx, this.game.audio.muted, controls.mute);
  }
}
