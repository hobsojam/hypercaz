import type { Scene } from '../../../engine/scenes.ts';
import { DEFAULT_VIEW, unprojectX } from '../../../engine/perspective.ts';
import { type Game, HEIGHT, WIDTH } from '../game.ts';
import { recordResult, saveProgress } from '../progress.ts';
import { renderGame } from '../render/draw.ts';
import { SquadView } from '../render/squadView.ts';
import { formationSlots } from '../sim/formation.ts';
import { starsFor } from '../sim/stars.ts';
import { createState, type GameState } from '../sim/state.ts';
import { step } from '../sim/step.ts';
import { drawCenteredText } from '../ui.ts';
import { ResultsScene } from './results.ts';

const KEY_SPEED = 1.6;
const END_DELAY = 1.2;

export class PlayScene implements Scene {
  private game: Game;
  private index: number;
  private state: GameState;
  private squadView = new SquadView();
  private targetX = 0;
  private lastPointerX: number | null;
  private paused = false;
  private endTimer = 0;

  constructor(game: Game, index: number) {
    this.game = game;
    this.index = index;
    this.state = createState(game.levels[index].level!, Date.now() >>> 0);
    this.lastPointerX = game.input.pointerX;
  }

  update(dt: number): void {
    const { input } = this.game;
    if (input.consumeKey('Escape')) this.paused = !this.paused;
    if (input.consumeKey('m')) {
      this.game.audio.muted = !this.game.audio.muted;
      this.game.progress = { ...this.game.progress, muted: this.game.audio.muted };
      saveProgress(this.game.storage, this.game.progress);
    }
    if (this.paused) {
      if (input.consumeClick()) this.paused = false;
      return;
    }
    input.consumeClick();

    this.readSteering(dt);
    step(this.state, { targetX: this.targetX }, dt);
    this.squadView.update(formationSlots(this.state.squad.count), dt);
    this.onEvents();

    if (this.state.phase === 'won' || this.state.phase === 'lost') {
      this.endTimer += dt;
      if (this.endTimer >= END_DELAY) this.finish();
    }
  }

  private readSteering(dt: number): void {
    const { input } = this.game;
    const left = input.isDown('ArrowLeft') || input.isDown('a');
    const right = input.isDown('ArrowRight') || input.isDown('d');
    if (left || right) {
      this.targetX += (right ? 1 : 0) * KEY_SPEED * dt - (left ? 1 : 0) * KEY_SPEED * dt;
    } else if (input.pointerX !== null && input.pointerX !== this.lastPointerX) {
      this.targetX = unprojectX(DEFAULT_VIEW, input.pointerX, 0);
    }
    this.lastPointerX = input.pointerX;
    this.targetX = Math.max(-1, Math.min(1, this.targetX));
  }

  // Hook for effects (Task 14).
  protected onEvents(): void {}

  private finish(): void {
    const { state, game } = this;
    const won = state.phase === 'won';
    const stars = starsFor(state.level, won, state.squad.count);
    game.progress = recordResult(game.progress, state.level.id, stars);
    saveProgress(game.storage, game.progress);
    game.stack.replace(new ResultsScene(game, this.index, won, stars, state.squad.count));
  }

  render(ctx: CanvasRenderingContext2D): void {
    renderGame(ctx, this.state, {
      persp: DEFAULT_VIEW,
      assets: this.game.assets,
      time: this.state.time,
      squadView: this.squadView,
      shake: { x: 0, y: 0 },
    });
    if (this.paused) {
      ctx.fillStyle = 'rgba(26,26,46,0.55)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      drawCenteredText(ctx, 'Paused', WIDTH / 2, HEIGHT / 2 - 30, 64);
      drawCenteredText(ctx, 'Esc or click to resume · M to mute', WIDTH / 2, HEIGHT / 2 + 40, 22);
    }
    if (this.game.audio.muted) drawCenteredText(ctx, 'MUTED', WIDTH - 50, 24, 16);
  }
}
