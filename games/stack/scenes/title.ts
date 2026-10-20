import type { Scene } from '../../../engine/scenes.ts';
import { drawCenteredText } from '../../squad/ui.ts';
import { ALL_GAMES_BUTTON, drawAllGamesButton, drawMuteButton, hitRect, takeClick } from '../controls.ts';
import { HEIGHT, loadBest, type StackGame, WIDTH } from '../game.ts';
import { renderStack } from '../render/draw.ts';
import { createStack, type StackState } from '../sim/state.ts';
import { step } from '../sim/step.ts';
import { PlayScene } from './play.ts';

export class TitleScene implements Scene {
  private t = 0;
  private game: StackGame;
  private demo: StackState = createStack(7); // a slab sliding over the base, for show
  navigate: (url: string) => void = (url) => {
    window.location.href = url;
  };

  constructor(game: StackGame) {
    this.game = game;
    game.sky = 0;
  }

  update(dt: number): void {
    this.t += dt;
    step(this.demo, { drop: false }, dt);
    const click = takeClick(this.game);
    if (click && hitRect(ALL_GAMES_BUTTON, click, 0)) {
      this.navigate('../');
      return;
    }
    if (click || this.game.input.consumeKey('Enter') || this.game.input.consumeKey(' ')) {
      this.game.audio.unlock();
      this.game.stack.replace(new PlayScene(this.game));
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    renderStack(ctx, this.demo, { camera: 0, time: this.t, ring: 0, showScore: false });
    drawCenteredText(ctx, 'STACK', WIDTH / 2, 230, 120, '#FFFFFF');
    drawCenteredText(ctx, `Best: ${loadBest(this.game.storage)}`, WIDTH / 2, 340, 40, '#F5C242');
    const pulse = 1 + Math.sin(this.t * 4) * 0.04;
    drawCenteredText(ctx, 'Click, press Space or tap to start', WIDTH / 2, HEIGHT - 120, 26 * pulse);
    drawAllGamesButton(ctx);
    drawMuteButton(ctx, this.game.audio.muted);
  }
}
