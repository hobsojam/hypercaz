import { fitLetterbox, toLogical, type Letterbox } from '../../engine/input.ts';
import { HEIGHT, WIDTH } from './sim/constants.ts';

export class Viewport {
  readonly ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private box: Letterbox = { scale: 1, offsetX: 0, offsetY: 0 };
  private dpr = 1;

  constructor(canvas: HTMLCanvasElement, signal: AbortSignal) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser cannot draw the game.');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize(), { signal });
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => this.resize());
      observer.observe(canvas);
      signal.addEventListener('abort', () => observer.disconnect(), { once: true });
    }
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.box = fitLetterbox(w, h, WIDTH, HEIGHT);
  }

  point(event: Pick<PointerEvent, 'clientX' | 'clientY'>) {
    const rect = this.canvas.getBoundingClientRect();
    return toLogical(this.box, event.clientX - rect.left, event.clientY - rect.top);
  }

  draw(paint: (ctx: CanvasRenderingContext2D) => void): void {
    if ((window.devicePixelRatio || 1) !== this.dpr) this.resize();
    const ctx = this.ctx, b = this.box;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#14313C'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.dpr * b.scale, 0, 0, this.dpr * b.scale, this.dpr * b.offsetX, this.dpr * b.offsetY);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, WIDTH, HEIGHT); ctx.clip(); paint(ctx); ctx.restore();
  }
}
