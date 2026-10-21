import { ParticlePool } from '../../../engine/particles.ts';
import type { Scene } from '../../../engine/scenes.ts';
import { drawCenteredText, drawPausedOverlay } from '../../../engine/ui.ts';
import {
  ALL_GAMES_BUTTON,
  drawAllGamesButton,
  drawGameOver,
  gameOverAction,
  drawMuteButton,
  drawPauseButton,
  hitRect,
  OVER_DELAY,
  MUTE_BUTTON,
  PAUSE_BUTTON,
  takeClick,
} from '../controls.ts';
import { loadBest, type MergeGame } from '../game.ts';
import { renderMerge } from '../render/draw.ts';
import { HEIGHT, WIDTH } from '../sim/constants.ts';
import { createMerge, type MergeEvent, type MergeState } from '../sim/state.ts';
import { stepMerge } from '../sim/step.ts';

const AIM_SPEED = 420; // px/s with the arrow keys
const MAX_PITCH_STEPS = 12; // one octave
const POP_LIFE = 0.5;
const PUFF_GRAVITY = 500;
const TEXT_LIFE = 0.8;
const TEXT_RISE = 60; // px over its life
const WAVE_TIME = 1; // seconds a family waves before walking
const WALK_SPEED = 160; // px/s
const FAMILY_LIFE = 4;
const FAMILY_MARGIN = 170; // how far past the edge counts as off screen

// The pop for the nth merge in a chain: a semitone higher each link, to an octave.
export function popPitch(link: number): number {
  return 2 ** (Math.min(link - 1, MAX_PITCH_STEPS) / 12);
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  t: number;
}

interface Family {
  x: number;
  y: number;
  t: number;
  dir: number; // -1 walks left, 1 right
}

export class PlayScene implements Scene {
  private readonly game: MergeGame;
  private readonly state: MergeState;
  private readonly particles = new ParticlePool(120);
  private texts: FloatingText[] = [];
  private families: Family[] = [];
  private paused = false;
  private armed = false; // a press has started a drop; the release makes it
  private lastPointerX: number | null = null;
  private overFor = 0;
  private best: number;
  private newBest = false;
  navigate: (url: string) => void = (url) => {
    window.location.href = url;
  };

  constructor(game: MergeGame) {
    this.game = game;
    this.state = createMerge(Date.now() >>> 0);
    this.best = loadBest(game.storage);
  }

  suspend(): void {
    if (this.state.phase === 'play') this.paused = true;
  }

  update(dt: number): void {
    const { input } = this.game;
    if (input.consumeKey('Escape') && this.state.phase === 'play') this.paused = !this.paused;
    const click = takeClick(this.game);
    const release = input.consumeRelease();
    if (this.paused) {
      if (click) this.paused = false;
      this.armed = false;
      return;
    }
    this.game.time += dt;
    this.animate(dt);

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
      this.armed = false;
      return;
    }
    const aim = this.aimFor(dt);
    const dropAt = this.dropPoint(click, release);
    const drop = dropAt !== null || input.consumeKey(' ');
    stepMerge(this.state, { aimX: dropAt ?? aim, drop }, dt);
    for (const e of this.state.events) this.react(e);
  }

  // Where the pointer or the arrow keys want the ball, or null to keep it.
  private aimFor(dt: number): number | null {
    const { input } = this.game;
    const px = input.pointerX;
    if (px !== null && px !== this.lastPointerX) {
      this.lastPointerX = px;
      return px;
    }
    const dir = (input.isDown('ArrowRight') ? 1 : 0) - (input.isDown('ArrowLeft') ? 1 : 0);
    return dir === 0 ? null : this.state.aimX + dir * AIM_SPEED * dt;
  }

  // A press arms a drop and its release makes it, at the release point. A
  // press on a button never arms one.
  private dropPoint(click: { x: number; y: number } | null, release: { x: number; y: number } | null): number | null {
    if (click && !this.onButton(click)) this.armed = true;
    if (release && this.armed) {
      this.armed = false;
      return release.x;
    }
    if (this.armed && !this.game.input.held && !release) this.armed = false; // the press was cancelled
    return null;
  }

  private onButton(p: { x: number; y: number }): boolean {
    return hitRect(PAUSE_BUTTON, p, 6) || hitRect(MUTE_BUTTON, p, 6) || hitRect(ALL_GAMES_BUTTON, p, 0);
  }

  private updateOver(dt: number, click: { x: number; y: number } | null): void {
    this.overFor += dt;
    stepMerge(this.state, { aimX: null, drop: false }, dt);
    const action = gameOverAction(this.game, click, this.overFor);
    if (action === 'games') this.navigate('../');
    else if (action === 'again') this.game.stack.replace(new PlayScene(this.game));
  }

  private react(e: MergeEvent): void {
    const { audio } = this.game;
    if (e.type === 'land') {
      audio.play('place');
    } else if (e.type === 'merge') {
      audio.play('pop', popPitch(e.link));
      this.puff(e.x, e.y, e.size);
      this.texts.push({ x: e.x, y: e.y, text: `+${e.points}`, t: 0 });
    } else if (e.type === 'family') {
      audio.play('win');
      this.puff(e.x, e.y, 9);
      this.texts.push({ x: e.x, y: e.y, text: `+${e.points}`, t: 0 });
      this.families.push({ x: e.x, y: e.y, t: 0, dir: e.x < WIDTH / 2 ? -1 : 1 });
    } else if (e.type === 'over') {
      audio.play('lose');
      this.finish();
    }
  }

  // A puff of 8 to 14 white flecks, more for bigger snow.
  private puff(x: number, y: number, size: number): void {
    const n = Math.min(14, 7 + size);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const speed = 90 + (i % 3) * 50;
      this.particles.emit({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 60, life: POP_LIFE, color: '#FFFFFF', size: 6 + (i % 2) * 3, spin: 0 });
    }
  }

  private animate(dt: number): void {
    this.particles.update(dt, PUFF_GRAVITY);
    for (const t of this.texts) t.t += dt;
    this.texts = this.texts.filter((t) => t.t < TEXT_LIFE);
    for (const f of this.families) f.t += dt;
    this.families = this.families.filter((f) => f.t < FAMILY_LIFE);
  }

  private finish(): void {
    const score = this.state.score;
    if (score > this.best) {
      this.best = score;
      this.newBest = true;
      this.game.storage.set('best', score);
    }
  }

  // The family waves in place, then walks to the nearer side and out of view.
  private familyViews(): { x: number; y: number; t: number }[] {
    return this.families.map((f) => {
      const walked = Math.max(0, f.t - WAVE_TIME) * WALK_SPEED;
      return { x: f.x + f.dir * Math.min(walked, FAMILY_MARGIN + WIDTH), y: f.y, t: f.t };
    });
  }

  render(ctx: CanvasRenderingContext2D): void {
    renderMerge(ctx, this.state, { time: this.game.time, best: this.best, families: this.familyViews() });
    this.particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    for (const t of this.texts) {
      ctx.globalAlpha = 1 - t.t / TEXT_LIFE;
      drawCenteredText(ctx, t.text, t.x, t.y - (t.t / TEXT_LIFE) * TEXT_RISE, 30, '#F5C242');
    }
    ctx.globalAlpha = 1;
    if (this.state.phase === 'over') this.renderOver(ctx);
    else if (this.paused) drawPausedOverlay(ctx, WIDTH, HEIGHT, this.game.input.touch);
    else {
      drawAllGamesButton(ctx);
      drawPauseButton(ctx);
    }
    drawMuteButton(ctx, this.game.audio.muted);
  }

  private renderOver(ctx: CanvasRenderingContext2D): void {
    drawGameOver(ctx, WIDTH, HEIGHT, {
      scoreLabel: 'Score',
      score: this.state.score,
      best: this.best,
      newBest: this.newBest,
      showAgain: this.overFor >= OVER_DELAY,
    });
  }
}
