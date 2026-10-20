// Shared drawing helpers and hit testing for menu screens.
import { drawCenteredText, FONT } from '../../engine/ui.ts';

export { drawCenteredText, FONT };

export interface Button {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  enabled: boolean;
}

export function hitButton(b: Button, px: number, py: number): boolean {
  return b.enabled && px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
}

export function drawButton(ctx: CanvasRenderingContext2D, b: Button, color = '#2F7DE1'): void {
  ctx.fillStyle = b.enabled ? color : '#8A8D96';
  ctx.strokeStyle = '#1A1A2E';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, 16);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.roundRect(b.x + 6, b.y + 5, b.w - 12, b.h * 0.38, 10);
  ctx.fill();
  drawCenteredText(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2 + 1, Math.min(30, b.h * 0.45), '#FFFFFF');
}

export function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, filled: boolean): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#F5C242' : 'rgba(26,26,46,0.35)';
  ctx.fill();
  ctx.lineWidth = Math.max(2, r / 6);
  ctx.strokeStyle = '#1A1A2E';
  ctx.stroke();
}

export function drawMenuBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#8FD3FF');
  g.addColorStop(0.55, '#D8F1FF');
  g.addColorStop(0.55, '#6CBF4B');
  g.addColorStop(1, '#4E9F3D');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
