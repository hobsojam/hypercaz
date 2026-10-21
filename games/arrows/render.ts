import { drawAllGamesButton, drawMuteButton, drawPauseButton } from '../../engine/controls.ts';
import { FONT } from '../../engine/ui.ts';
import { HEIGHT, WIDTH } from './game.ts';
import { PUZZLES } from './levels.ts';
import { boardFor, buttonsFor, type Button } from './layout.ts';
import type { Session } from './session.ts';
import { followingPath, exitDistance } from './motion.ts';
import { cells, exitRay, VECTORS, type Arrow, type Cell } from './sim.ts';

const INK = '#173d48', TEAL = '#287f84', GOLD = '#edae36', PAPER = '#fff9e8';
const COLORS = { N: '#92552e', E: '#287f84', S: '#735b9c', W: '#336ca0' } as const;
function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color = INK, maxWidth = WIDTH): void {
  ctx.font = `bold ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(value, x, y, maxWidth);
}
function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, radius = 18): void {
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
}
function lesson(ctx: CanvasRenderingContext2D, value: string): void {
  const words = value.split(' '); let line = '', y = 752;
  for (const word of words) {
    if ((line + word).length > 44) { text(ctx, line.trim(), 270, y, 20); line = ''; y += 26; }
    line += word + ' ';
  }
  text(ctx, line.trim(), 270, y, 20);
}

function strokePath(ctx: CanvasRenderingContext2D, points: readonly Cell[]): void {
  ctx.beginPath(); ctx.moveTo(points[0].x + 0.5, points[0].y + 0.5);
  for (const p of points.slice(1)) ctx.lineTo(p.x + 0.5, p.y + 0.5);
  ctx.stroke();
}

function drawArrow(ctx: CanvasRenderingContext2D, arrow: Arrow, cell: number, origin: Cell, highlighted: boolean, blocked: boolean, distance = 0): void {
  const points = followingPath(arrow, distance), tail = points[0], head = points.at(-1)!, v = VECTORS[arrow.direction];
  let tangent = v;
  if (points.length > 1) tangent = { x: Math.sign(points[1].x - tail.x), y: Math.sign(points[1].y - tail.y) };
  const ribbon = [{ x: tail.x - tangent.x * 0.1, y: tail.y - tangent.y * 0.1 }, ...points, { x: head.x + v.x * 0.1, y: head.y + v.y * 0.1 }];
  ctx.save(); ctx.translate(origin.x, origin.y); ctx.scale(cell, cell);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (highlighted) { ctx.strokeStyle = GOLD; ctx.lineWidth = 0.72; strokePath(ctx, ribbon); }
  ctx.strokeStyle = blocked ? '#bc484b' : COLORS[arrow.direction]; ctx.lineWidth = 0.56; strokePath(ctx, ribbon);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.065;
  strokePath(ctx, [ribbon[0], ...points, { x: head.x + v.x * 0.18, y: head.y + v.y * 0.18 }]);
  const normal = { x: -v.y, y: v.x };
  strokePath(ctx, [
    { x: head.x + v.x * 0.02 + normal.x * 0.14, y: head.y + v.y * 0.02 + normal.y * 0.14 },
    { x: head.x + v.x * 0.18, y: head.y + v.y * 0.18 },
    { x: head.x + v.x * 0.02 - normal.x * 0.14, y: head.y + v.y * 0.02 - normal.y * 0.14 },
  ]);
  ctx.restore();
}

function blockedPath(ctx: CanvasRenderingContext2D, s: Session): void {
  if (!s.feedback) return;
  const p = s.state.puzzle, b = boardFor(p);
  const arrow = p.arrows.find(a => a.id === s.feedback!.id)!, target = p.arrows.find(a => a.id === s.feedback!.blocker)!;
  const head = cells(arrow).at(-1)!;
  const end = exitRay(p, arrow).find(c => cells(target).some(t => t.x === c.x && t.y === c.y));
  if (!end) return;
  ctx.strokeStyle = '#bc484b'; ctx.lineWidth = 4; ctx.setLineDash([7, 7]);
  ctx.beginPath(); ctx.moveTo(b.x + (head.x + 0.5) * b.cell, b.y + (head.y + 0.5) * b.cell);
  ctx.lineTo(b.x + (end.x + 0.5) * b.cell, b.y + (end.y + 0.5) * b.cell); ctx.stroke(); ctx.setLineDash([]);
}

function drawFlight(ctx: CanvasRenderingContext2D, s: Session): void {
  if (!s.flight) return;
  const p = s.state.puzzle, b = boardFor(p), { arrow, age, duration } = s.flight;
  const t = Math.min(1, age / duration), distance = exitDistance(p.size, arrow) * t * t;
  drawArrow(ctx, arrow, b.cell, b, false, false, distance);
}

function drawBoard(ctx: CanvasRenderingContext2D, s: Session): void {
  const p = s.state.puzzle, b = boardFor(p);
  panel(ctx, b.x - 8, b.y - 8, b.w + 16, b.h + 16, '#ffffff', 24);
  for (let y = 0; y < p.size; y++) for (let x = 0; x < p.size; x++) {
    ctx.fillStyle = '#d9e4dc'; ctx.beginPath(); ctx.arc(b.x + (x + 0.5) * b.cell, b.y + (y + 0.5) * b.cell, 2.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.save(); ctx.beginPath(); ctx.rect(b.x, b.y, b.w, b.h); ctx.clip();
  blockedPath(ctx, s);
  for (const arrow of p.arrows) {
    if (!s.state.remaining.has(arrow.id)) continue;
    const blocked = arrow.id === s.feedback?.id;
    let shake = 0;
    if (blocked && s.feedback) shake = Math.sin(s.feedback.age * 50) * 5 * (1 - s.feedback.age / 0.9);
    drawArrow(ctx, arrow, b.cell, { x: b.x + shake, y: b.y }, arrow.id === s.hintId || arrow.id === s.feedback?.blocker, blocked);
  }
  drawFlight(ctx, s);
  ctx.restore();
  if (s.cursorVisible && s.screen === 'play') {
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
    ctx.strokeRect(b.x + s.focus.x * b.cell + 3, b.y + s.focus.y * b.cell + 3, b.cell - 6, b.cell - 6); ctx.setLineDash([]);
  }
}

function drawButton(ctx: CanvasRenderingContext2D, b: Button, s: Session): void {
  if (b.id.startsWith('puzzle:')) {
    const index = Number(b.id.slice(7)), done = s.completed.has(PUZZLES[index].id), selected = s.menuIndex === index;
    panel(ctx, b.x, b.y + 4, b.w, b.h, '#d4ded5');
    panel(ctx, b.x, b.y, b.w, b.h, selected ? '#d5eee5' : '#ffffff');
    if (selected) { ctx.strokeStyle = TEAL; ctx.lineWidth = 3; ctx.strokeRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6); }
    text(ctx, String(index + 1).padStart(2, '0'), b.x + b.w / 2, b.y + 27, 27, TEAL);
    text(ctx, b.label, b.x + b.w / 2, b.y + 60, 17, INK, b.w - 14);
    text(ctx, done ? '✓ Cleared' : 'Ready', b.x + b.w / 2, b.y + 87, 15, TEAL);
    return;
  }
  panel(ctx, b.x, b.y + 4, b.w, b.h, '#b8cec3');
  panel(ctx, b.x, b.y, b.w, b.h, b.enabled ? TEAL : '#9eb7ad');
  text(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2, 23, '#ffffff');
}

function result(ctx: CanvasRenderingContext2D, s: Session): void {
  ctx.fillStyle = '#173d4877'; ctx.fillRect(0, 60, WIDTH, HEIGHT - 60);
  panel(ctx, 48, 312, 444, 358, PAPER, 26);
  text(ctx, '✦  ✦  ✦', 270, 367, 42, GOLD);
  text(ctx, 'Board clear!', 270, 428, 43);
  text(ctx, 'Every arrow found its way out.', 270, 479, 23);
  text(ctx, `${s.completed.size} of ${PUZZLES.length} puzzles cleared`, 270, 520, 21, TEAL);
}

export function render(ctx: CanvasRenderingContext2D, s: Session): void {
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  text(ctx, 'ARROW ESCAPE', 270, 105, 37);
  if (s.screen === 'levels') {
    text(ctx, 'Choose a puzzle', 270, 158, 27);
    text(ctx, `${s.completed.size} / ${PUZZLES.length} cleared · Play any puzzle`, 270, 195, 20, TEAL);
  } else {
    text(ctx, `${String(s.index + 1).padStart(2, '0')}  ${s.state.puzzle.name}`, 270, 154, 26);
    text(ctx, `${s.state.remaining.size} arrows left`, 270, 194, 21, TEAL);
    drawBoard(ctx, s);
    let message = s.state.puzzle.lesson;
    if (s.feedback) message = 'Blocked. Clear the highlighted arrow ahead first.';
    else if (s.hintId !== null) message = 'The glowing arrow has a clear path. Give it a tap.';
    else if (s.screen === 'won') message = 'Take your time. There is always another way out.';
    lesson(ctx, message);
    if (s.screen === 'won') result(ctx, s);
  }
  if (s.paused) {
    ctx.fillStyle = '#173d48bb'; ctx.fillRect(0, 60, WIDTH, HEIGHT - 60);
    text(ctx, 'Paused', 270, 435, 54, '#ffffff');
    text(ctx, 'Take a breath. The arrows can wait.', 270, 488, 23, '#ffffff');
  }
  for (const b of buttonsFor(s)) drawButton(ctx, b, s);
  text(ctx, 'Tap an arrow with a clear path to the edge.', 270, 919, 18, TEAL);
  text(ctx, 'Arrows + Enter · H hint · R retry · L puzzles', 270, 946, 15, TEAL);
  drawAllGamesButton(ctx); drawMuteButton(ctx, s.muted);
  if (s.screen === 'play') drawPauseButton(ctx);
}
