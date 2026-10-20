import { drawSprite } from '../../../engine/assets.ts';
import type { Scene } from '../../../engine/scenes.ts';
import { BUILD } from '../build.ts';
import { drawMuteButton, hitRect, type Rect, takeClick } from '../controls.ts';
import { type Game, HEIGHT, WIDTH } from '../game.ts';
import { drawCenteredText, drawMenuBackground } from '../ui.ts';
import { LevelSelectScene } from './levelSelect.ts';

// Back to the game picker, top-left opposite the mute button.
const ALL_GAMES_BUTTON: Rect = { x: 8, y: 4, w: 112, h: 40 };

export class TitleScene implements Scene {
  private t = 0;
  private game: Game;
  navigate: (url: string) => void = (url) => {
    window.location.href = url;
  };

  constructor(game: Game) {
    this.game = game;
    game.audio.startMusic('menu');
  }

  update(dt: number): void {
    this.t += dt;
    const click = takeClick(this.game);
    if (click && hitRect(ALL_GAMES_BUTTON, click, 0)) {
      this.navigate('../');
      return;
    }
    if (click || this.game.input.consumeKey('Enter') || this.game.input.consumeKey(' ')) {
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
    drawCenteredText(ctx, `build ${BUILD}`, WIDTH / 2, HEIGHT - 24, 16, '#9AA0B8');
    const b = ALL_GAMES_BUTTON;
    ctx.fillStyle = 'rgba(26,26,46,0.55)';
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, b.h / 2);
    ctx.fill();
    drawCenteredText(ctx, 'All games', b.x + b.w / 2, b.y + b.h / 2, 18);
    drawMuteButton(ctx, this.game.audio.muted);
  }
}
