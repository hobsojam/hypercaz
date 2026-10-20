import { drawSprite } from '../../../engine/assets.ts';
import type { Scene } from '../../../engine/scenes.ts';
import { drawMuteButton, takeClick } from '../controls.ts';
import { type Game, HEIGHT, WIDTH } from '../game.ts';
import { drawCenteredText, drawMenuBackground } from '../ui.ts';
import { LevelSelectScene } from './levelSelect.ts';

export class TitleScene implements Scene {
  private t = 0;
  private game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  update(dt: number): void {
    this.t += dt;
    if (takeClick(this.game) || this.game.input.consumeKey('Enter') || this.game.input.consumeKey(' ')) {
      this.game.audio.unlock();
      this.game.stack.replace(new LevelSelectScene(this.game));
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    drawMenuBackground(ctx, WIDTH, HEIGHT);
    drawCenteredText(ctx, 'SQUAD', WIDTH / 2, 230, 92, '#2F7DE1');
    drawCenteredText(ctx, 'SHOOTER', WIDTH / 2, 320, 72, '#F5C242');
    for (let i = 0; i < 7; i++) {
      const x = WIDTH / 2 + (i - 3) * 44;
      drawSprite(ctx, this.game.assets, 'soldier_run', this.t + i * 0.1, x, 640 + Math.abs(i - 3) * 8, 1.4);
    }
    const pulse = 1 + Math.sin(this.t * 4) * 0.06;
    drawCenteredText(ctx, this.game.input.touch ? 'Tap to start' : 'Click to start', WIDTH / 2, 780, 36 * pulse);
    drawMuteButton(ctx, this.game.audio.muted);
  }
}
