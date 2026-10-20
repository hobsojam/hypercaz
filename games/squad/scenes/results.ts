import type { Scene } from '../../../engine/scenes.ts';
import { ease, tweenValue } from '../../../engine/tween.ts';
import { type Game, HEIGHT, WIDTH } from '../game.ts';
import type { LossCause, LossEvent } from '../sim/state.ts';
import type { Stars } from '../progress.ts';
import { drawMuteButton, takeClick } from '../controls.ts';
import { type Button, drawButton, drawCenteredText, drawMenuBackground, drawStar, hitButton } from '../ui.ts';
import { LevelSelectScene } from './levelSelect.ts';
import { PlayScene } from './play.ts';

const LOSS_FEEDBACK: Record<LossCause, { name: string; tip: string }> = {
  enemy: { name: 'Crowd', tip: 'Aim into the crowd; use Rapid Fire.' },
  heavy: { name: 'Heavy', tip: 'Focus fire on heavies before contact.' },
  gate: { name: 'Negative gate', tip: 'Shoot the gate positive or steer clear.' },
  blade: { name: 'Blade', tip: 'Steer clear of the blade lane.' },
  fire: { name: 'Fire', tip: 'Steer clear of the fire lane.' },
  barricade: { name: 'Barricade', tip: 'Steer around the barricade.' },
  bossShot: { name: 'Boss shot', tip: 'Move lanes when the boss winds up.' },
  bossContact: { name: 'Boss contact', tip: 'Recruit more; save Rapid Fire for the boss.' },
};

export class ResultsScene implements Scene {
  private game: Game;
  private index: number;
  private won: boolean;
  private stars: Stars;
  private count: number;
  private finalHit?: LossEvent;
  private t = 0;
  private buttons: { button: Button; action: () => void }[];

  constructor(game: Game, index: number, won: boolean, stars: Stars, count: number, finalHit?: LossEvent) {
    this.game = game;
    game.audio.startMusic('menu');
    this.index = index;
    this.won = won;
    this.stars = stars;
    this.count = count;
    this.finalHit = finalHit;
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
    const c = takeClick(this.game);
    if (c) for (const { button, action } of this.buttons) if (hitButton(button, c.x, c.y)) return action();
    if (this.game.input.consumeKey('Enter')) this.buttons[0].action();
  }

  render(ctx: CanvasRenderingContext2D): void {
    drawMenuBackground(ctx, WIDTH, HEIGHT);
    drawCenteredText(ctx, this.won ? 'Victory!' : 'Defeated', WIDTH / 2, 200, 72, this.won ? '#F5C242' : '#E04040');
    for (let i = 0; i < 3; i++) {
      const appear = tweenValue(0, 1, (this.t - 0.3 - i * 0.25) / 0.4, ease.outBack);
      if (appear > 0) drawStar(ctx, WIDTH / 2 + (i - 1) * 110, 320, 44 * appear, i < this.stars);
    }
    drawCenteredText(ctx, `${this.count} soldiers left`, WIDTH / 2, 410, 32);
    if (!this.won) {
      const feedback = this.finalHit?.cause ? LOSS_FEEDBACK[this.finalHit.cause] : undefined;
      if (feedback && this.finalHit) {
        drawCenteredText(ctx, `Final hit: ${feedback.name} −${this.finalHit.amount}`, WIDTH / 2, 454, 26, '#FF6B6B');
        drawCenteredText(ctx, feedback.tip, WIDTH / 2, 490, 21);
      } else {
        drawCenteredText(ctx, 'Aim at rescues to rebuild your squad.', WIDTH / 2, 490, 22);
      }
      drawCenteredText(ctx, 'Win to earn your first star.', WIDTH / 2, 526, 22, '#F5C242');
    } else if (this.stars < 3) {
      const next = this.stars + 1;
      const target = this.game.levels[this.index].level!.stars[this.stars - 1];
      const gap = Math.max(0, target - this.count);
      drawCenteredText(ctx, `${gap} more soldier${gap === 1 ? '' : 's'} for ${next} stars`, WIDTH / 2, 478, 27, '#F5C242');
      drawCenteredText(ctx, `Finish with ${target} soldiers.`, WIDTH / 2, 518, 22);
    } else {
      drawCenteredText(ctx, 'All 3 stars earned!', WIDTH / 2, 490, 30, '#F5C242');
    }
    for (const { button } of this.buttons) drawButton(ctx, button, button.label === 'Next' ? '#4E9F3D' : '#2F7DE1');
    drawMuteButton(ctx, this.game.audio.muted);
  }
}
