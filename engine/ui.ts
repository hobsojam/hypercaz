// Text drawing shared by every game.

export const FONT = '"Trebuchet MS", "Segoe UI", sans-serif';

export function drawCenteredText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color = '#FFFFFF'): void {
  ctx.font = `bold ${Math.round(size)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size / 5);
  ctx.strokeStyle = '#1A1A2E';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

// The dimmed "Paused" screen.
export function drawPausedOverlay(ctx: CanvasRenderingContext2D, width: number, height: number, touch: boolean): void {
  ctx.fillStyle = 'rgba(26,26,46,0.55)';
  ctx.fillRect(0, 0, width, height);
  drawCenteredText(ctx, 'Paused', width / 2, height / 2 - 30, 64);
  drawCenteredText(ctx, touch ? 'Tap to resume' : 'Esc or click to resume', width / 2, height / 2 + 40, 24);
}
