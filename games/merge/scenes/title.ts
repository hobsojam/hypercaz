import { drawAllGamesButton, titleAction } from '../../../engine/controls.ts';
import type { Scene } from '../../../engine/scenes.ts';
import { drawCenteredText } from '../../../engine/ui.ts';
import { drawMuteButton, takeClick } from '../controls.ts';
import { loadBest, type MergeGame } from '../game.ts';
import { renderMerge } from '../render/draw.ts';
import { CRATE, HEIGHT, RADII, WIDTH } from '../sim/constants.ts';
import { makeBall } from '../sim/physics.ts';
import { createMerge, type MergeState } from '../sim/state.ts';
import { PlayScene } from './play.ts';

const SHOW_SIZE = 7;
export const TITLE_SIZE = 80; // "SNOWMAN" is 7 wide capitals at about 0.75 em each: ~420 px of the 540 column

export class TitleScene implements Scene {
  private readonly game: MergeGame;
  private readonly best: number;
  private readonly demo: MergeState = createMerge(7); // an empty crate with one big snowman, for show
  private t = 0;
  navigate: (url: string) => void = (url) => {
    window.location.href = url;
  };

  constructor(game: MergeGame) {
    this.game = game;
    this.best = loadBest(game.storage);
    this.demo.phase = 'over'; // no hanging ball
    this.demo.balls.push(makeBall(1, SHOW_SIZE, WIDTH / 2, CRATE.floor - RADII[SHOW_SIZE]));
  }

  update(dt: number): void {
    this.t += dt;
    this.game.time += dt;
    const click = takeClick(this.game);
    const action = titleAction(this.game, click);
    if (action === 'games') this.navigate('../');
    else if (action === 'start') this.game.stack.replace(new PlayScene(this.game));
  }

  render(ctx: CanvasRenderingContext2D): void {
    renderMerge(ctx, this.demo, { time: this.game.time, best: this.best, families: [], hud: false });
    // Two lines: the whole name in one line would not fit the column.
    drawCenteredText(ctx, 'SNOWMAN', WIDTH / 2, 120, TITLE_SIZE, '#FFFFFF');
    drawCenteredText(ctx, 'MERGE', WIDTH / 2, 120 + TITLE_SIZE * 0.95, TITLE_SIZE, '#FFFFFF');
    drawCenteredText(ctx, `Best: ${this.best}`, WIDTH / 2, 300, 40, '#F5C242');
    const pulse = 1 + Math.sin(this.t * 4) * 0.04;
    drawCenteredText(ctx, 'Click, press Space or tap to start', WIDTH / 2, HEIGHT - 340, 26 * pulse);
    drawAllGamesButton(ctx);
    drawMuteButton(ctx, this.game.audio.muted);
  }
}
