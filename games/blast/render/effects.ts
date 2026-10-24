// The feel of a placement, kept out of the sim: crates squash as they land,
// cleared lines slide off the bay in a cloud of dust, score pop-ups rise, an
// empty bay flashes and a jam shakes the screen.
import { ParticlePool } from '../../../engine/particles.ts';
import { ease, tweenValue } from '../../../engine/tween.ts';
import { drawCenteredText } from '../../../engine/ui.ts';
import { PIECES } from '../sim/pieces.ts';
import type { Placement } from '../sim/board.ts';
import { drawCrate } from './draw.ts';
import { BAY, CELL } from './layout.ts';

type Ctx = CanvasRenderingContext2D;

const LAND_TIME = 0.16;
const SQUASH = 0.14;
const SWEEP_TIME = 0.35;
const POP_TIME = 0.9;
const POP_RISE = 70;
const FLASH_TIME = 0.6;
const SHAKE_TIME = 0.5;
const SHAKE_PX = 10;
const DUST_GRAVITY = -40; // dust drifts up
const DUST_COLORS = ['#D9D4C7', '#BFB9AA', '#E8E4DA'];

interface Moving {
  col: number;
  row: number;
  color: string;
  t: number;
}

interface Sweep extends Moving {
  dx: number; // the direction it is pushed, one of these is 0
  dy: number;
}

interface Popup {
  text: string;
  x: number;
  y: number;
  big: boolean;
  t: number;
}

const colorOf = (value: number) => PIECES[value - 1]?.color ?? '#999999';
const cellX = (col: number) => BAY.x + col * CELL;
const cellY = (row: number) => BAY.y + row * CELL;

export class Effects {
  private lands: Moving[] = [];
  private sweeps: Sweep[] = [];
  private popups: Popup[] = [];
  private readonly dust = new ParticlePool(240);
  private flashT = 0;
  private shakeT = 0;

  // A short squash on the cells a piece just filled.
  land(cells: { col: number; row: number; value: number }[]): void {
    for (const c of cells) this.lands.push({ col: c.col, row: c.row, color: colorOf(c.value), t: 0 });
  }

  // Cleared crates are pushed off along their line: rows to the right,
  // columns down. More lines at once kick up more dust.
  sweep(cleared: Placement['cleared'], rows: number[], cols: number[]): void {
    const lines = rows.length + cols.length;
    for (const c of cleared) {
      const inRow = rows.includes(c.row);
      this.sweeps.push({ col: c.col, row: c.row, color: colorOf(c.value), t: 0, dx: inRow ? 1 : 0, dy: inRow ? 0 : 1 });
      this.puff(cellX(c.col) + CELL / 2, cellY(c.row) + CELL / 2, 1 + Math.min(3, lines));
    }
    this.lands = this.lands.filter((l) => !cleared.some((c) => c.col === l.col && c.row === l.row));
  }

  private puff(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 90;
      this.dust.emit({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 0.4 + Math.random() * 0.4, color: DUST_COLORS[i % DUST_COLORS.length]!, size: 5 + Math.random() * 7, spin: 0 });
    }
  }

  popup(text: string, x: number, y: number, big: boolean): void {
    this.popups.push({ text, x, y, big, t: 0 });
  }

  flash(): void {
    this.flashT = FLASH_TIME;
  }

  shake(): void {
    this.shakeT = SHAKE_TIME;
  }

  update(dt: number): void {
    for (const l of this.lands) l.t += dt;
    this.lands = this.lands.filter((l) => l.t < LAND_TIME);
    for (const s of this.sweeps) s.t += dt;
    this.sweeps = this.sweeps.filter((s) => s.t < SWEEP_TIME);
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter((p) => p.t < POP_TIME);
    this.dust.update(dt, DUST_GRAVITY);
    this.flashT = Math.max(0, this.flashT - dt);
    this.shakeT = Math.max(0, this.shakeT - dt);
  }

  // Where to draw the scene this frame, while the screen shakes.
  offset(): { x: number; y: number } {
    if (this.shakeT <= 0) return { x: 0, y: 0 };
    const k = (this.shakeT / SHAKE_TIME) * SHAKE_PX;
    return { x: Math.sin(this.shakeT * 70) * k, y: Math.cos(this.shakeT * 55) * k * 0.5 };
  }

  // Cells drawn here rather than by the bay while they squash.
  hidden(): Set<string> {
    return new Set(this.lands.map((l) => `${l.col},${l.row}`));
  }

  draw(ctx: Ctx): void {
    for (const l of this.lands) this.drawLanding(ctx, l);
    for (const s of this.sweeps) {
      const k = s.t / SWEEP_TIME;
      const push = tweenValue(0, BAY.size, k, (t) => t * t);
      drawCrate(ctx, cellX(s.col) + s.dx * push, cellY(s.row) + s.dy * push, CELL, s.color, 1 - k);
    }
    this.dust.forEach((d) => {
      ctx.globalAlpha = Math.max(0, d.life / d.maxLife) * 0.8;
      ctx.fillStyle = d.color;
      ctx.fillRect(d.x - d.size / 2, d.y - d.size / 2, d.size, d.size);
    });
    ctx.globalAlpha = 1;
    if (this.flashT > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(this.flashT / FLASH_TIME) * 0.7})`;
      ctx.fillRect(BAY.x, BAY.y, BAY.size, BAY.size);
    }
    for (const p of this.popups) this.drawPopup(ctx, p);
    ctx.globalAlpha = 1;
  }

  // Wide and flat at first, then back to square.
  private drawLanding(ctx: Ctx, l: Moving): void {
    const k = 1 - tweenValue(0, 1, l.t / LAND_TIME, ease.outCubic);
    const cx = cellX(l.col) + CELL / 2;
    const bottom = cellY(l.row) + CELL;
    ctx.save();
    ctx.translate(cx, bottom);
    ctx.scale(1 + SQUASH * k, 1 - SQUASH * k);
    drawCrate(ctx, -CELL / 2, -CELL, CELL, l.color);
    ctx.restore();
  }

  private drawPopup(ctx: Ctx, p: Popup): void {
    const k = p.t / POP_TIME;
    const pop = tweenValue(0.6, 1, k * 4, ease.outBack);
    ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    drawCenteredText(ctx, p.text, p.x, p.y - k * POP_RISE, (p.big ? 46 : 32) * pop, p.big ? '#FFE066' : '#FFFFFF');
  }
}
