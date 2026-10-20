import type { Scene } from '../../../engine/scenes.ts';
import { drawMuteButton, takeClick } from '../controls.ts';
import { type Game, HEIGHT, WIDTH } from '../game.ts';
import { isUnlocked } from '../progress.ts';
import { type Button, drawButton, drawCenteredText, drawMenuBackground, drawStar, hitButton } from '../ui.ts';
import { ErrorScene } from './error.ts';
import { PlayScene } from './play.ts';

export class LevelSelectScene implements Scene {
  private game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  private buttons(): { button: Button; index: number }[] {
    return this.game.levels.map((entry, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const id = entry.level?.id ?? index + 1;
      const enabled = entry.error !== null || isUnlocked(this.game.progress, id);
      return {
        index,
        button: { x: 70 + col * 210, y: 190 + row * 140, w: 190, h: 110, label: entry.error ? '!' : String(id), enabled },
      };
    });
  }

  update(): void {
    const c = takeClick(this.game);
    if (!c) return;
    for (const { button, index } of this.buttons()) {
      if (!hitButton(button, c.x, c.y)) continue;
      const entry = this.game.levels[index];
      if (entry.level) this.game.stack.replace(new PlayScene(this.game, index));
      else this.game.stack.replace(new ErrorScene(this.game, entry.error ?? 'Unknown error', () => new LevelSelectScene(this.game)));
      return;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    drawMenuBackground(ctx, WIDTH, HEIGHT);
    drawCenteredText(ctx, 'Choose a level', WIDTH / 2, 110, 46);
    for (const { button, index } of this.buttons()) {
      const entry = this.game.levels[index];
      drawButton(ctx, { ...button, h: 80, label: button.label }, entry.error ? '#E04040' : '#2F7DE1');
      const id = entry.level?.id ?? 0;
      const stars = this.game.progress.best[id] ?? 0;
      for (let s = 0; s < 3; s++) drawStar(ctx, button.x + button.w / 2 + (s - 1) * 34, button.y + 98, 13, s < stars);
    }
    drawMuteButton(ctx, this.game.audio.muted);
  }
}
