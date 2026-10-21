import type { Scene } from '../../../engine/scenes.ts';
import { drawPausedOverlay } from '../../../engine/ui.ts';
import {
  drawGameOver,
  gameOverAction,
  drawMuteButton,
  drawPauseButton,
  hitRect,
  PAUSE_BUTTON,
  takeClick,
} from '../controls.ts';
import { HEIGHT, loadBest, type StackGame, WIDTH } from '../game.ts';
import { renderStack } from '../render/draw.ts';
import { createStack, type StackState } from '../sim/state.ts';
import { step } from '../sim/step.ts';

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MAX_SEMITONES = 24; // two octaves
const RING_TIME = 0.5; // seconds
const KICK_TIME = 0.25;
const KICK_PX = 9;
const CAMERA_RATE = 5; // per second

// The note for the nth perfect drop in a row: one step up the major scale each
// time, as a multiplier on the base frequency.
export function perfectPitch(streak: number): number {
  const i = Math.max(0, streak - 1);
  const semitones = Math.min(MAX_SEMITONES, Math.floor(i / 7) * 12 + MAJOR_SCALE[i % 7]!);
  return 2 ** (semitones / 12);
}

export class PlayScene implements Scene {
  private game: StackGame;
  private state: StackState;
  private camera = 0;
  private ring = 0; // seconds left
  private kick = 0; // seconds left
  private paused = false;
  private overFor = 0;
  private best: number;
  private newBest = false;
  private time = 0;
  navigate: (url: string) => void = (url) => {
    window.location.href = url;
  };

  constructor(game: StackGame) {
    this.game = game;
    this.state = createStack(Date.now() >>> 0);
    this.best = loadBest(game.storage);
    game.sky = 0;
  }

  suspend(): void {
    if (this.state.phase === 'play') this.paused = true;
  }

  update(dt: number): void {
    const { input, audio } = this.game;
    if (input.consumeKey('Escape') && this.state.phase === 'play') this.paused = !this.paused;
    const click = takeClick(this.game);
    if (this.paused) {
      if (click) this.paused = false;
      return;
    }
    this.time += dt;

    if (this.state.phase === 'over') {
      this.overFor += dt;
      step(this.state, { drop: false }, dt); // the debris keeps falling
      this.follow(dt);
      const action = gameOverAction(this.game, click, this.overFor);
      if (action === 'games') this.navigate('../');
      else if (action === 'again') this.game.stack.replace(new PlayScene(this.game));
      return;
    }

    if (click && hitRect(PAUSE_BUTTON, click, 6)) {
      this.paused = true;
      return;
    }
    const drop = input.consumeKey(' ') || click !== null;
    step(this.state, { drop }, dt);
    for (const e of this.state.events) {
      if (e.type === 'perfect') {
        audio.play('perfect', perfectPitch(e.streak));
        this.ring = RING_TIME;
        this.kick = KICK_TIME;
      } else if (e.type === 'place') {
        audio.play('place');
      } else {
        audio.play('lose');
        this.finish();
      }
    }
    this.follow(dt);
  }

  // The camera glides up to the top of the tower.
  private follow(dt: number): void {
    this.ring = Math.max(0, this.ring - dt);
    this.kick = Math.max(0, this.kick - dt);
    const target = this.state.floors.length - 1;
    this.camera += (target - this.camera) * Math.min(1, dt * CAMERA_RATE);
    this.game.sky = this.camera;
  }

  private finish(): void {
    const score = this.state.floors.length - 1;
    if (score > this.best) {
      this.best = score;
      this.newBest = true;
      this.game.storage.set('best', score);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(0, (this.kick / KICK_TIME) * KICK_PX);
    renderStack(ctx, this.state, { camera: this.camera, time: this.time, ring: this.ring / RING_TIME });
    ctx.restore();
    const score = this.state.floors.length - 1;
    if (this.state.phase === 'over') {
      drawGameOver(ctx, WIDTH, HEIGHT, { scoreLabel: 'Floors', score, best: this.best, newBest: this.newBest, showAgain: true });
    } else if (this.paused) {
      drawPausedOverlay(ctx, WIDTH, HEIGHT, this.game.input.touch);
    } else {
      drawPauseButton(ctx);
    }
    drawMuteButton(ctx, this.game.audio.muted);
  }
}
