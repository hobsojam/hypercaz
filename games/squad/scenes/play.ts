import type { Scene } from '../../../engine/scenes.ts';
import { DEFAULT_VIEW, unprojectX } from '../../../engine/perspective.ts';
import { type Game, HEIGHT, WIDTH } from '../game.ts';
import { drawMuteButton, drawPauseButton, hitRect, PAUSE_BUTTON, takeClick } from '../controls.ts';
import { recordResult, saveProgress } from '../progress.ts';
import { BURST_BUTTON, renderGame } from '../render/draw.ts';
import { Effects } from '../render/effects.ts';
import { Introduction } from '../render/introduction.ts';
import { projectPlayfieldPoint } from '../render/projection.ts';
import { SquadView } from '../render/squadView.ts';
import { formationSlots } from '../sim/formation.ts';
import { starsFor } from '../sim/stars.ts';
import { createState, type GameState, type LossEvent } from '../sim/state.ts';
import { step } from '../sim/step.ts';
import { drawCenteredText } from '../ui.ts';
import { ResultsScene } from './results.ts';

const KEY_SPEED = 1.6;
const END_DELAY = 1.2;
// Pointer positions above this belong to the HUD buttons, not steering.
const HUD_BOTTOM = BURST_BUTTON.y + BURST_BUTTON.h + 20;

export class PlayScene implements Scene {
  private game: Game;
  private index: number;
  private state: GameState;
  private squadView = new SquadView();
  private effects: Effects;
  private targetX = 0;
  private lastPointerX: number | null;
  private paused = false;
  private endTimer = 0;
  private finalHit?: LossEvent;
  private introduction?: Introduction;

  constructor(game: Game, index: number) {
    this.game = game;
    this.index = index;
    this.state = createState(game.levels[index].level!, Date.now() >>> 0);
    if (this.state.level.id === 1 && !game.progress.best[1]) this.introduction = new Introduction();
    this.lastPointerX = null; // follow wherever the pointer already is
    this.effects = new Effects(game.audio);
    game.audio.startMusic('gameplay');
  }

  private setPaused(paused: boolean): void {
    this.paused = paused;
    this.game.audio.duckMusic(paused);
  }

  suspend(): void {
    if (!this.paused && this.state.phase !== 'won' && this.state.phase !== 'lost') this.setPaused(true);
  }

  update(dt: number): void {
    const { input } = this.game;
    if (input.consumeKey('Escape')) this.setPaused(!this.paused);
    const click = takeClick(this.game);
    if (this.paused) {
      if (click) this.setPaused(false);
      return;
    }
    if (click && hitRect(PAUSE_BUTTON, click, 6)) {
      this.setPaused(true);
      return;
    }
    const burst = input.consumeKey(' ') || (click !== null && hitRect(BURST_BUTTON, click, 12));

    this.readSteering(dt);
    step(this.state, { targetX: this.targetX, burst }, dt);
    for (const event of this.state.events) if (event.type === 'lose') this.finalHit = event;
    this.introduction?.update(this.state);
    this.squadView.update(formationSlots(this.state.squad.count), dt);
    if (this.state.events.some((e) => e.type === 'bossArrive')) this.game.audio.startMusic('boss');
    this.effects.handle(this.state.events, (x, z) => projectPlayfieldPoint(DEFAULT_VIEW, x, z));
    this.effects.update(dt);

    if (this.state.phase === 'won' || this.state.phase === 'lost') {
      // Stop the music the moment the level is decided, so the jingle plays clean.
      if (this.endTimer === 0) this.game.audio.stopMusic();
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
    } else if (input.pointerX !== null && input.pointerX !== this.lastPointerX && (input.pointerY ?? HEIGHT) > HUD_BOTTOM) {
      this.targetX = unprojectX(DEFAULT_VIEW, input.pointerX, 0);
    }
    this.lastPointerX = input.pointerX;
    this.targetX = Math.max(-1, Math.min(1, this.targetX));
  }

  private finish(): void {
    const { state, game } = this;
    const won = state.phase === 'won';
    const stars = starsFor(state.level, won, state.squad.count);
    game.progress = recordResult(game.progress, state.level.id, stars);
    saveProgress(game.storage, game.progress);
    game.stack.replace(new ResultsScene(game, this.index, won, stars, state.squad.count, this.finalHit));
  }

  render(ctx: CanvasRenderingContext2D): void {
    renderGame(ctx, this.state, {
      persp: DEFAULT_VIEW,
      assets: this.game.assets,
      time: this.state.time,
      squadView: this.squadView,
      shake: this.effects.shake,
      drawEffects: (ctx) => this.effects.draw(ctx),
    });
    if (this.paused) {
      ctx.fillStyle = 'rgba(26,26,46,0.55)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      drawCenteredText(ctx, 'Paused', WIDTH / 2, HEIGHT / 2 - 30, 64);
      drawCenteredText(ctx, this.game.input.touch ? 'Tap to resume' : 'Esc or click to resume', WIDTH / 2, HEIGHT / 2 + 40, 24);
    } else {
      this.introduction?.draw(ctx, this.state, this.game.input.touch);
      drawPauseButton(ctx);
    }
    drawMuteButton(ctx, this.game.audio.muted);
  }
}
