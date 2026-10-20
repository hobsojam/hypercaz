// Draws a StackState. Read-only: nothing here changes the simulation.
import { drawCenteredText } from '../../squad/ui.ts';
import { HEIGHT, WIDTH } from '../game.ts';
import { DEBRIS_GRAVITY } from '../sim/constants.ts';
import type { StackState } from '../sim/state.ts';

export const FLOOR_H = 24; // px per floor
const SKEW = (30 * Math.PI) / 180; // the top face recedes at 30 degrees
const DEPTH_X = FLOOR_H * Math.cos(SKEW);
const DEPTH_Y = FLOOR_H * Math.sin(SKEW);
// Where the top floor's front face starts, from the top of the screen.
export const TOP_Y = 640;
const BASE_HUE = 200;
const HUE_PER_FLOOR = 4;

export interface StackView {
  camera: number; // height of the screen in floors; the top floor sits at TOP_Y
  time: number;
  ring: number; // 0 when idle; (0, 1] while a perfect drop's ring is fading
  showScore?: boolean; // default true
}

const hueOf = (floor: number) => (((BASE_HUE + floor * HUE_PER_FLOOR) % 360) + 360) % 360;

// Top and bottom colours of the sky; its hue follows the tower upward.
export function skyColors(height: number): [string, string] {
  const hue = hueOf(height);
  return [`hsl(${hue} 55% 24%)`, `hsl(${(hue + 40) % 360} 65% 62%)`];
}

// Fills the given area with the sky. The gradient always spans the 540x960
// column, so filling a larger area (the bars around it) continues it smoothly.
export function drawSky(ctx: CanvasRenderingContext2D, height: number, x = 0, y = 0, w = WIDTH, h = HEIGHT): void {
  const [top, bottom] = skyColors(height);
  const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

function drawSlab(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, hue: number): void {
  // Front face.
  ctx.fillStyle = `hsl(${hue} 70% 46%)`;
  ctx.fillRect(x, y, width, FLOOR_H);
  // Top face, a parallelogram receding up and to the right.
  ctx.fillStyle = `hsl(${hue} 80% 68%)`;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x + width + DEPTH_X, y - DEPTH_Y);
  ctx.lineTo(x + DEPTH_X, y - DEPTH_Y);
  ctx.closePath();
  ctx.fill();
  // Side face, darker.
  ctx.fillStyle = `hsl(${hue} 70% 32%)`;
  ctx.beginPath();
  ctx.moveTo(x + width, y);
  ctx.lineTo(x + width + DEPTH_X, y - DEPTH_Y);
  ctx.lineTo(x + width + DEPTH_X, y - DEPTH_Y + FLOOR_H);
  ctx.lineTo(x + width, y + FLOOR_H);
  ctx.closePath();
  ctx.fill();
}

export function renderStack(ctx: CanvasRenderingContext2D, state: StackState, view: StackView): void {
  const { floors } = state;
  const topIndex = floors.length - 1;
  drawSky(ctx, view.camera, -40, -40, WIDTH + 80, HEIGHT + 80);
  const yOf = (floor: number) => TOP_Y - (floor - view.camera) * FLOOR_H;

  for (let i = 0; i < floors.length; i++) {
    const y = yOf(i);
    if (y < -FLOOR_H * 2 || y > HEIGHT) continue;
    drawSlab(ctx, floors[i]!.x, y, floors[i]!.width, hueOf(i));
  }

  const dropY = yOf(floors.length);
  if (state.phase === 'play') drawSlab(ctx, state.moving.x, dropY, state.moving.width, hueOf(floors.length));

  // Sliced-off pieces tumble down from where they were cut. Gravity pulls
  // from rest, so the time since the cut follows from how far they have fallen.
  // After a trim the sim has already pushed the placed slab, so the cut was
  // made on the top floor; after a miss nothing was pushed and the piece is
  // the moving slab itself.
  const cutFloor = state.phase === 'play' ? topIndex : floors.length;
  const cutY = yOf(cutFloor);
  for (const d of state.debris) {
    const t = Math.sqrt((2 * d.y) / DEBRIS_GRAVITY);
    ctx.save();
    ctx.translate(d.x + d.width / 2, cutY + d.y * FLOOR_H + FLOOR_H / 2);
    ctx.rotate(d.spin * t);
    ctx.globalAlpha = Math.max(0, 1 - d.y / 12);
    drawSlab(ctx, -d.width / 2, -FLOOR_H / 2, d.width, hueOf(cutFloor));
    ctx.restore();
  }

  if (view.ring > 0) {
    const top = floors[topIndex]!;
    const grow = 4 + (1 - view.ring) * 44;
    ctx.strokeStyle = `rgba(255,255,255,${view.ring.toFixed(3)})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(top.x - grow, yOf(topIndex) - DEPTH_Y - grow, top.width + DEPTH_X + grow * 2, FLOOR_H + DEPTH_Y + grow * 2, 10 + grow / 2);
    ctx.stroke();
  }

  if (view.showScore ?? true) {
    drawCenteredText(ctx, String(topIndex), WIDTH / 2, 110, 110);
    if (state.streak >= 2 && state.phase === 'play') drawCenteredText(ctx, `Perfect x${state.streak}`, WIDTH / 2, 190, 30, '#FFFFFF');
  }
}
