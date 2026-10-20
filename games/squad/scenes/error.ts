import type { Scene } from '../../../engine/scenes.ts';
import { drawMuteButton, takeClick } from '../controls.ts';
import { type Game, HEIGHT, WIDTH } from '../game.ts';
import { type Button, drawButton, drawCenteredText, drawMenuBackground, FONT, hitButton } from '../ui.ts';

export class ErrorScene implements Scene {
  private game: Game;
  private message: string;
  private back: Button = { x: WIDTH / 2 - 110, y: 700, w: 220, h: 72, label: 'Menu', enabled: true };
  private next: () => Scene;

  constructor(game: Game, message: string, next: () => Scene) {
    this.game = game;
    this.message = message;
    this.next = next;
  }

  update(): void {
    const c = takeClick(this.game);
    if ((c && hitButton(this.back, c.x, c.y)) || this.game.input.consumeKey('Escape')) this.game.stack.replace(this.next());
  }

  render(ctx: CanvasRenderingContext2D): void {
    drawMenuBackground(ctx, WIDTH, HEIGHT);
    drawCenteredText(ctx, 'Level problem', WIDTH / 2, 260, 44, '#E04040');
    ctx.fillStyle = '#1A1A2E';
    ctx.font = `16px ${FONT}`;
    ctx.textAlign = 'center';
    wrap(this.message, 40).forEach((line, i) => ctx.fillText(line, WIDTH / 2, 360 + i * 24));
    drawButton(ctx, this.back);
    drawMuteButton(ctx, this.game.audio.muted);
  }
}

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if ((line + ' ' + word).trim().length > width && line) {
      lines.push(line);
      line = word;
    } else line = (line + ' ' + word).trim();
  }
  if (line) lines.push(line);
  return lines;
}
