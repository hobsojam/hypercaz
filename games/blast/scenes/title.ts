import { drawAllGamesButton, titleAction } from '../../../engine/controls.ts';
import type { Scene } from '../../../engine/scenes.ts';
import { drawCenteredText } from '../../../engine/ui.ts';
import { drawMuteButton, takeClick } from '../controls.ts';
import { type BlastGame, HEIGHT, loadBest, WIDTH } from '../game.ts';
import { renderBlast } from '../render/draw.ts';
import { emptyBoard, place } from '../sim/board.ts';
import { pieceById } from '../sim/pieces.ts';
import { type BlastState, createBlast } from '../sim/state.ts';
import { PlayScene } from './play.ts';

// A few crates on the bay behind the title, for show.
function demo(): BlastState {
  const state = createBlast(7);
  const crates: [string, number, number][] = [['v3', 0, 0], ['l5d', 5, 0], ['h2', 1, 0], ['tb', 1, 6], ['sq2', 6, 6], ['zh', 3, 5], ['1x1', 7, 3]];
  state.board = crates.reduce((b, [id, col, row]) => place(b, pieceById(id), col, row).board, emptyBoard());
  state.hand = [];
  return state;
}

export class TitleScene implements Scene {
  private t = 0;
  private readonly game: BlastGame;
  private readonly best: number;
  private readonly demo = demo();
  navigate: (url: string) => void = (url) => {
    window.location.href = url;
  };

  constructor(game: BlastGame) {
    this.game = game;
    this.best = loadBest(game.storage);
  }

  update(dt: number): void {
    this.t += dt;
    this.game.time += dt;
    const action = titleAction(this.game, takeClick(this.game));
    if (action === 'games') this.navigate('../');
    else if (action === 'start') this.game.stack.replace(new PlayScene(this.game));
  }

  render(ctx: CanvasRenderingContext2D): void {
    renderBlast(ctx, this.demo, { best: this.best, time: this.t, drag: null, hidden: new Set(), showHud: false });
    drawCenteredText(ctx, 'CRATE BLAST', WIDTH / 2, 400, 76);
    drawCenteredText(ctx, `Best: ${this.best}`, WIDTH / 2, 490, 40, '#F5C242');
    const pulse = 1 + Math.sin(this.t * 4) * 0.04;
    drawCenteredText(ctx, 'Click, press Space or tap to start', WIDTH / 2, HEIGHT - 150, 26 * pulse);
    drawAllGamesButton(ctx);
    drawMuteButton(ctx, this.game.audio.muted);
  }
}
