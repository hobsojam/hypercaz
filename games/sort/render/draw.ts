// Draws a Water Sort scene: the calm blue backdrop, glass tubes of flat
// colour (each layer with its symbol), the tilt-and-flow pour, the HUD and the
// level-clear celebration. Read-only: nothing here changes the board.
import type { Rect } from '../../../engine/controls.ts';
import type { ParticlePool } from '../../../engine/particles.ts';
import { ease } from '../../../engine/tween.ts';
import { drawCenteredText } from '../../../engine/ui.ts';
import { type Board, CAPACITY, isDone, type Tube } from '../sim/board.ts';
import { BOTTOM_BAND, buttonRects, LIFT, symbolsRect } from './layout.ts';

// The hypercaz palette, then four more that stay clear of it.
export const COLORS: readonly string[] = ['#E04040', '#F5C242', '#3CC85A', '#2F7DE1', '#9B59D0', '#FF8A1F', '#FF7AC0', '#3FD9D2', '#ECEFF5', '#9A6B3F'];
export const SYMBOLS = ['circle', 'triangle', 'square', 'diamond', 'star', 'plus', 'heart', 'hexagon', 'cross', 'drop'] as const;
export const GLASS_EDGE = 'rgba(214,232,255,0.75)';
export const SYMBOL_INK = 'rgba(14,20,46,0.62)';
// Blue, purple and brown are too dark for dark ink; they get light ink.
export const SYMBOL_INK_LIGHT = 'rgba(255,255,255,0.78)';
const LIGHT_INK = new Set([3, 4, 9]);

// A pour in flight. The board already holds its result; this only says how
// far through the 0.4 s animation it is, so it can be drawn.
export interface PourAnim {
  from: number;
  to: number;
  color: number;
  moved: number;
  t: number; // 0..1
}
// Within a pour: the tube swings over, the liquid flows, then it swings back.
export const FLOW_START = 0.3;
export const FLOW_END = 0.75;
const TILT = 1.45; // radians at full tilt, nearly level

export interface SceneModel {
  board: Board;
  rects: readonly Rect[];
  view: { w: number; h: number };
  lifted: number | null;
  pour: PourAnim | null;
  symbols: boolean;
  level: number;
  time: number; // seconds, for gentle motion
  stuck: boolean;
  celebrating: number | null; // 0..1 through the celebration, or null
  shake: number; // 0..1, the lifted tube's shake after an illegal pour
  shine?: readonly number[]; // per tube, 1 just done, fading to 0
  canUndo?: boolean;
  particles?: ParticlePool;
}

interface Layer {
  color: number;
  amount: number; // in layers; below 1 while a pour is part-way
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const flowOf = (t: number) => clamp01((t - FLOW_START) / (FLOW_END - FLOW_START));

// `total` layers' worth of one colour, spread over up to `n` layers.
function spread(color: number, total: number, n: number): Layer[] {
  const out: Layer[] = [];
  for (let i = 0; i < n; i++) {
    const amount = clamp01(total - i);
    if (amount > 0.001) out.push({ color, amount });
  }
  return out;
}

const whole = (tube: Tube): Layer[] => tube.map((color) => ({ color, amount: 1 }));

// What each tube shows: the board, except that a pour's liquid is still on
// its way from the source to the target.
function layersFor(board: Board, i: number, pour: PourAnim | null): Layer[] {
  const tube = board.tubes[i]!;
  if (!pour) return whole(tube);
  const f = flowOf(pour.t);
  if (i === pour.from) return [...whole(tube), ...spread(pour.color, pour.moved * (1 - f), pour.moved)];
  if (i === pour.to) return [...whole(tube.slice(0, tube.length - pour.moved)), ...spread(pour.color, pour.moved * f, pour.moved)];
  return whole(tube);
}

// Tube geometry, from its rect.
const headroom = (w: number) => w * 0.4;
const INSET = 3;
const layerH = (w: number, h: number) => (h - headroom(w) - INSET) / CAPACITY;

// The tube's outline, open at the top: straight sides and a round bottom.
function tubePath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, inset: number): void {
  const r = w / 2;
  ctx.moveTo(x + inset, y);
  ctx.lineTo(x + inset, y + h - r);
  ctx.arc(x + r, y + h - r, Math.max(0, r - inset), Math.PI, 0, true);
  ctx.lineTo(x + w - inset, y);
}

function polygon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, points: number, inner: number, turn: number): void {
  const steps = inner > 0 ? points * 2 : points;
  for (let i = 0; i < steps; i++) {
    const rad = inner > 0 && i % 2 === 1 ? r * inner : r;
    const a = turn + (i * Math.PI * 2) / steps;
    ctx.lineTo(cx + rad * Math.sin(a), cy - rad * Math.cos(a));
  }
  ctx.closePath();
}

// A plus of arm thickness 2t, turned by `turn` radians.
function plus(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, turn: number): void {
  const t = s * 0.34;
  const pts = [[-t, -s], [t, -s], [t, -t], [s, -t], [s, t], [t, t], [t, s], [-t, s], [-t, t], [-s, t], [-s, -t], [-t, -t]];
  const c = Math.cos(turn);
  const sn = Math.sin(turn);
  for (const [px, py] of pts) ctx.lineTo(cx + px! * c - py! * sn, cy + px! * sn + py! * c);
  ctx.closePath();
}

// One of the ten colour-blind symbols, filled in the current fillStyle.
export function drawSymbol(ctx: CanvasRenderingContext2D, kind: number, cx: number, cy: number, s: number): void {
  ctx.beginPath();
  switch (SYMBOLS[kind % SYMBOLS.length]) {
    case 'circle':
      ctx.arc(cx, cy, s * 0.85, 0, Math.PI * 2);
      break;
    case 'triangle':
      polygon(ctx, cx, cy + s * 0.15, s * 1.1, 3, 0, 0);
      break;
    case 'square':
      ctx.rect(cx - s * 0.75, cy - s * 0.75, s * 1.5, s * 1.5);
      break;
    case 'diamond':
      polygon(ctx, cx, cy, s * 1.05, 4, 0, 0);
      break;
    case 'star':
      polygon(ctx, cx, cy + s * 0.08, s * 1.1, 5, 0.45, 0);
      break;
    case 'plus':
      plus(ctx, cx, cy, s * 0.95, 0);
      break;
    case 'heart':
      ctx.moveTo(cx, cy + s * 0.9);
      ctx.bezierCurveTo(cx - s * 1.4, cy - s * 0.1, cx - s * 0.6, cy - s * 1.2, cx, cy - s * 0.42);
      ctx.bezierCurveTo(cx + s * 0.6, cy - s * 1.2, cx + s * 1.4, cy - s * 0.1, cx, cy + s * 0.9);
      break;
    case 'hexagon':
      polygon(ctx, cx, cy, s * 0.95, 6, 0, Math.PI / 6);
      break;
    case 'cross':
      plus(ctx, cx, cy, s * 0.95, Math.PI / 4);
      break;
    default: // drop
      ctx.moveTo(cx, cy - s * 1.05);
      ctx.arc(cx, cy + s * 0.3, s * 0.65, -Math.PI * 0.18, Math.PI * 1.18);
      ctx.closePath();
  }
  ctx.fill();
}

interface TubeLook {
  symbols: boolean;
  done: boolean;
  shine: number;
}

// A tube with its top-left at (x, y).
function drawTube(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, layers: readonly Layer[], look: TubeLook): void {
  // The glass, faintly.
  ctx.beginPath();
  tubePath(ctx, x, y, w, h, 0);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fill();

  // The liquid, clipped to the inside of the glass.
  const lh = layerH(w, h);
  ctx.save();
  ctx.beginPath();
  tubePath(ctx, x, y, w, h, INSET);
  ctx.closePath();
  ctx.clip();
  let bottom = y + h - INSET;
  const marks: { color: number; cy: number }[] = [];
  // One fill per run of a colour, so a finished tube shows no seams.
  const floor = bottom;
  let runBottom = bottom;
  layers.forEach((layer, i) => {
    const top = bottom - layer.amount * lh;
    if (layer.amount >= 0.5) marks.push({ color: layer.color, cy: (top + bottom) / 2 });
    bottom = top;
    if (layers[i + 1]?.color === layer.color) return;
    ctx.fillStyle = COLORS[layer.color % COLORS.length]!;
    // A hair of overlap hides seams; the bottom run reaches the round end.
    ctx.fillRect(x, top, w, runBottom - top + (runBottom === floor ? INSET + 1 : 0.5));
    runBottom = top;
  });
  if (layers.length > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; // the surface catches the light
    ctx.fillRect(x, bottom, w, 2);
  }
  if (look.shine > 0) {
    // A band of light sweeps up the finished tube.
    const span = h - headroom(w);
    const bandY = y + h - (1 - look.shine) * span * 1.4;
    ctx.fillStyle = `rgba(255,255,255,${(0.45 * look.shine).toFixed(3)})`;
    ctx.fillRect(x, bandY - lh * 0.4, w, lh * 0.4);
  }
  if (look.symbols) {
    const s = Math.min(w * 0.2, lh * 0.28);
    for (const m of marks) {
      ctx.fillStyle = LIGHT_INK.has(m.color % COLORS.length) ? SYMBOL_INK_LIGHT : SYMBOL_INK;
      drawSymbol(ctx, m.color, x + w / 2, m.cy, s);
    }
  }
  ctx.restore();

  // A soft streak of reflection down the left side.
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.roundRect(x + w * 0.16, y + w * 0.3, w * 0.11, Math.max(0, h - w * 0.95), w * 0.055);
  ctx.fill();

  if (look.done) {
    ctx.save();
    ctx.shadowColor = 'rgba(255,226,140,0.9)';
    ctx.shadowBlur = 10 + 16 * look.shine;
    ctx.strokeStyle = `rgba(255,232,160,${(0.45 + 0.5 * look.shine).toFixed(3)})`;
    ctx.lineWidth = 3 + 3 * look.shine;
    ctx.beginPath();
    tubePath(ctx, x, y, w, h, 0);
    ctx.stroke();
    ctx.restore();
  }

  // The glass edge and its lip.
  ctx.strokeStyle = GLASS_EDGE;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  tubePath(ctx, x, y, w, h, 0);
  ctx.moveTo(x - 4, y);
  ctx.lineTo(x + w + 4, y);
  ctx.stroke();
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#1A3766');
  g.addColorStop(1, '#0A1430');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, Math.max(w, h) * 0.6);
  glow.addColorStop(0, 'rgba(110,160,240,0.16)');
  glow.addColorStop(1, 'rgba(110,160,240,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
}

// Where the pouring tube is: how far it has swung over, from its place to
// above the target, tilted towards it.
function pourPose(a: Rect, b: Rect, t: number) {
  const dir = a.x >= b.x ? 1 : -1; // +1: the source is right of the target
  let reach = 1;
  if (t < FLOW_START) reach = ease.inOutQuad(t / FLOW_START);
  else if (t > FLOW_END) reach = 1 - ease.inOutQuad((t - FLOW_END) / (1 - FLOW_END));
  // It leaves from its lifted place and comes back to rest.
  const restY = t < FLOW_START ? a.y - a.w * LIFT : a.y;
  const half = a.w / 2;
  // The pivot is the mouth's centre; the lip nearest the target ends up just
  // above the target's mouth.
  const mx = b.x + b.w / 2 + dir * half * Math.cos(TILT);
  const my = b.y - b.w * 0.45 - half * Math.sin(TILT);
  const px = a.x + half + (mx - (a.x + half)) * reach;
  const py = restY + (my - restY) * reach;
  const angle = -dir * TILT * reach;
  const lip = { x: px - dir * half * Math.cos(angle), y: py + half * Math.abs(Math.sin(angle)) };
  return { px, py, angle, lip };
}

function drawPour(ctx: CanvasRenderingContext2D, m: SceneModel, pour: PourAnim): void {
  const a = m.rects[pour.from];
  const b = m.rects[pour.to];
  if (!a || !b) return;
  const pose = pourPose(a, b, pour.t);
  const f = flowOf(pour.t);
  if (f > 0 && f < 1) {
    // The stream, from the lip down to the liquid in the target.
    const filled = layersFor(m.board, pour.to, pour).reduce((s, l) => s + l.amount, 0);
    const surface = b.y + b.h - INSET - filled * layerH(b.w, b.h);
    const sw = b.w * 0.16 * Math.min(1, f * 6, (1 - f) * 6);
    ctx.fillStyle = COLORS[pour.color % COLORS.length]!;
    ctx.beginPath();
    ctx.roundRect(pose.lip.x - sw / 2, pose.lip.y, sw, Math.max(0, surface - pose.lip.y), sw / 2);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(pose.px, pose.py);
  ctx.rotate(pose.angle);
  drawTube(ctx, -a.w / 2, 0, a.w, a.h, layersFor(m.board, pour.from, pour), { symbols: m.symbols, done: false, shine: 0 });
  ctx.restore();
}

function drawButton(ctx: CanvasRenderingContext2D, r: Rect, label: string, enabled: boolean, glow: number): void {
  ctx.fillStyle = `rgba(255,255,255,${(0.1 + 0.14 * glow).toFixed(3)})`;
  ctx.strokeStyle = enabled ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, r.h / 2);
  ctx.fill();
  ctx.stroke();
  drawCenteredText(ctx, label, r.x + r.w / 2, r.y + r.h / 2 + 1, 20, enabled ? '#FFFFFF' : 'rgba(255,255,255,0.4)');
}

function drawHud(ctx: CanvasRenderingContext2D, m: SceneModel): void {
  const { w, h } = m.view;
  // Between the corner buttons when there is room, else just below them.
  const roomy = symbolsRect(w).x - w / 2 > 90;
  drawCenteredText(ctx, `Level ${m.level}`, w / 2, roomy ? 24 : 58, roomy ? 28 : 20);
  const { undo, restart } = buttonRects(w, h);
  const glow = m.stuck ? 0.5 + 0.5 * Math.sin(m.time * 3) : 0;
  if (m.stuck) {
    // A gentle card around the buttons, never over the tubes.
    const cw = Math.min(320, w - 16);
    ctx.fillStyle = 'rgba(8,14,36,0.78)';
    ctx.strokeStyle = 'rgba(255,231,168,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect((w - cw) / 2, h - BOTTOM_BAND - 4, cw, BOTTOM_BAND - 2, 18);
    ctx.fill();
    ctx.stroke();
    drawCenteredText(ctx, 'No moves left', w / 2, undo.y - 16, 18, '#FFE7A8');
  }
  drawButton(ctx, undo, 'Undo', m.canUndo ?? true, glow);
  drawButton(ctx, restart, 'Restart', true, glow);
}

function drawCelebration(ctx: CanvasRenderingContext2D, m: SceneModel, c: number): void {
  const { w, h } = m.view;
  m.particles?.forEach((p) => {
    ctx.globalAlpha = clamp01(p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  });
  ctx.globalAlpha = 1;
  const appear = clamp01(c / 0.2);
  ctx.fillStyle = `rgba(8,14,36,${(0.55 * appear).toFixed(3)})`;
  ctx.fillRect(0, h / 2 - 54, w, 108);
  const text = `Level ${m.level} clear!`;
  const size = Math.min(56, (w * 0.85) / (text.length * 0.6)) * (0.6 + 0.4 * ease.outBack(appear));
  drawCenteredText(ctx, text, w / 2, h / 2, size, '#FFE7A8');
}

export function drawScene(ctx: CanvasRenderingContext2D, m: SceneModel): void {
  drawBackground(ctx, m.view.w, m.view.h);
  const { pour } = m;
  m.board.tubes.forEach((tube, i) => {
    const r = m.rects[i];
    if (!r || i === pour?.from) return;
    const lifted = i === m.lifted;
    const dx = lifted ? Math.sin(m.time * 55) * 5 * m.shake : 0;
    const dy = lifted ? -r.w * LIFT : 0;
    const settled = i !== pour?.to;
    const look = { symbols: m.symbols, done: settled && isDone(tube), shine: settled ? (m.shine?.[i] ?? 0) : 0 };
    drawTube(ctx, r.x + dx, r.y + dy, r.w, r.h, layersFor(m.board, i, pour), look);
  });
  if (pour) drawPour(ctx, m, pour);
  drawHud(ctx, m);
  if (m.celebrating !== null) drawCelebration(ctx, m, m.celebrating);
}

// The symbols on/off button: a cluster of circle, triangle and square, dimmed
// and struck through when off.
export function drawSymbolsButton(ctx: CanvasRenderingContext2D, r: Rect, on: boolean): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const u = r.w * 0.17;
  ctx.fillStyle = 'rgba(26,26,46,0.55)';
  ctx.beginPath();
  ctx.arc(cx, cy, r.w / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = on ? '#FFFFFF' : 'rgba(255,255,255,0.4)';
  drawSymbol(ctx, SYMBOLS.indexOf('circle'), cx - u * 1.1, cy - u * 0.9, u);
  drawSymbol(ctx, SYMBOLS.indexOf('square'), cx + u * 1.1, cy - u * 0.9, u);
  drawSymbol(ctx, SYMBOLS.indexOf('triangle'), cx, cy + u * 1.1, u);
  if (!on) {
    ctx.strokeStyle = '#FF6B6B';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy + 10);
    ctx.lineTo(cx + 10, cy - 10);
    ctx.stroke();
  }
}
