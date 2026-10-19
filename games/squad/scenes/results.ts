import type { Scene } from '../../../engine/scenes.ts';
import { ease, tweenValue } from '../../../engine/tween.ts';
import { type Game, HEIGHT, WIDTH } from '../game.ts';
import type { Stars } from '../progress.ts';
import { type Button, drawButton, drawCenteredText, drawMenuBackground, drawStar, hitButton } from '../ui.ts';
import { LevelSelectScene } from './levelSelect.ts';
import { PlayScene } from './play.ts';

export class ResultsScene implements Scene {
  private game: Game;
  private index: number;
  private won: boolean;
  private stars: Stars;
  private count: number;
  private t = 0;
  private buttons: { button: Button; action: () => void }[];

  constructor(game: Game, index: number, won: boolean, stars: Stars, count: number) {
    this.game = game;
    this.index = index;
    this.won = won;
    this.stars = stars;
    this.count = count;
    const next = game.levels[index + 1];
    const hasNext = won && !!next?.level;
    const list: { label: string; action: () => void }[] = [];
    if (hasNext) list.push({ label: 'Next', action: () => game.stack.replace(new PlayScene(game, index + 1)) });
    list.push({ label: 'Retry', action: () => game.stack.replace(new PlayScene(game, index)) });
    list.push({ label: 'Menu', action: () => game.stack.replace(new LevelSelectScene(game)) });
    this.buttons = list.map((b, i) => ({ action: b.action, button: { x: WIDTH / 2 - 130, y: 560 + i * 100, w: 260, h: 80, label: b.label, enabled: true } }));
  }

  update(dt: number): void {
    this.t += dt;
    const c = this.game.input.consumeClick();
    if (c) for (const { button, action } of this.buttons) if (hitButton(button, c.x, c.y)) return action();
    if (this.game.input.consumeKey('Enter')) this.buttons[0].action();
  }

  render(ctx: CanvasRenderingContext2D): void {
    drawMenuBackground(ctx, WIDTH, HEIGHT);
    drawCenteredText(ctx, this.won ? 'Victory!' : 'Defeated', WIDTH / 2, 200, 72, this.won ? '#F5C242' : '#E04040');
    for (let i = 0; i < 3; i++) {
      const appear = tweenValue(0, 1, (this.t - 0.3 - i * 0.25) / 0.4, ease.outBack);
      if (appear > 0) drawStar(ctx, WIDTH / 2 + (i - 1) * 110, 340, 44 * appear, i < this.stars);
    }
    drawCenteredText(ctx, `${this.count} soldiers left`, WIDTH / 2, 450, 32);
    for (const { button } of this.buttons) drawButton(ctx, button, button.label === 'Next' ? '#4E9F3D' : '#2F7DE1');
  }
}
