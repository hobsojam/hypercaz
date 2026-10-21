import { drawAllGamesButton, drawMuteButton, drawPauseButton } from '../../engine/controls.ts';
import { FONT } from '../../engine/ui.ts';
import { HEIGHT, WIDTH } from './game.ts';
import { BOARD, buttonsFor, type Button } from './layout.ts';
import { PUZZLES } from './levels.ts';
import type { Session } from './session.ts';
import type { Car } from './sim.ts';

const INK = '#183d40', TEAL = '#217c78', PAPER = '#edf5f2', GOLD = '#ffd166';
const CAR_COLORS = ['#e95a52', '#367aa5', '#a56ca6', '#e2a647', '#44a488', '#8173b6', '#c4716d'];
export interface Preview { readonly index: number; readonly position: number }
function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color = INK, maxWidth = WIDTH): void {
  ctx.font = `bold ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(value, x, y, maxWidth);
}
function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, radius = 18): void {
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
}
function carBody(ctx: CanvasRenderingContext2D, car: Car, position: number, color: string, selected: boolean, hintDirection: number): void {
  const { cell } = BOARD;
  const x = BOARD.x + (car.axis === 'H' ? position : car.x) * cell + 4;
  const y = BOARD.y + (car.axis === 'V' ? position : car.y) * cell + 4;
  const w = (car.axis === 'H' ? car.length : 1) * cell - 8;
  const h = (car.axis === 'V' ? car.length : 1) * cell - 8;
  ctx.fillStyle = '#113b40'; ctx.beginPath(); ctx.roundRect(x + 2, y + 5, w, h, 13); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, 13); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.32)'; ctx.beginPath();
  if (car.axis === 'H') ctx.roundRect(x + w - 34, y + 10, 20, h - 20, 6);
  else ctx.roundRect(x + 10, y + h - 34, w - 20, 20, 6);
  ctx.fill();
  if (selected || hintDirection) {
    ctx.strokeStyle = hintDirection ? GOLD : '#ffffff'; ctx.lineWidth = hintDirection ? 6 : 4;
    ctx.beginPath(); ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 12); ctx.stroke();
  }
  text(ctx, car.target ? '→' : car.id, x + w / 2, y + h / 2, car.target ? 36 : 25, '#ffffff');
  if (hintDirection) {
    const arrow = car.axis === 'H' ? (hintDirection > 0 ? '→' : '←') : (hintDirection > 0 ? '↓' : '↑');
    const ax = car.axis === 'H' ? x + (hintDirection > 0 ? w - 20 : 20) : x + w / 2;
    const ay = car.axis === 'V' ? y + (hintDirection > 0 ? h - 20 : 20) : y + h / 2;
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ax, ay, 13, 0, Math.PI * 2); ctx.fill();
    text(ctx, arrow, ax, ay, 20, GOLD);
  }
}
function drawBoard(ctx: CanvasRenderingContext2D, s: Session, preview: Preview | null): void {
  const { x, y, cell, size } = BOARD;
  panel(ctx, x - 9, y - 9, size * cell + 18, size * cell + 18, '#d0e2dc', 16);
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
    panel(ctx, x + col * cell + 1, y + row * cell + 1, cell - 2, cell - 2, (row + col) % 2 ? '#f6faf5' : '#e7f1ec', 3);
  }
  panel(ctx, x + size * cell - 2, y + 2 * cell + 10, 54, cell - 20, '#f8d6a0', 10);
  text(ctx, 'EXIT', x + size * cell + 23, y + 2.5 * cell, 15, '#8c5529');
  for (let i = 0; i < s.state.puzzle.cars.length; i++) {
    const car = s.state.puzzle.cars[i];
    const position = preview?.index === i ? preview.position : s.state.positions[i];
    const hintDirection = s.hintMove?.carId === car.id ? Math.sign(s.hintMove.to - s.state.positions[i]) : 0;
    carBody(ctx, car, position, CAR_COLORS[i % CAR_COLORS.length], s.selected === i, hintDirection);
  }
  if (s.cursorVisible && s.screen === 'play') {
    ctx.strokeStyle = GOLD; ctx.lineWidth = 3;
    ctx.strokeRect(x + s.focus.x * cell + 5, y + s.focus.y * cell + 5, cell - 10, cell - 10);
  }
}
function drawButton(ctx: CanvasRenderingContext2D, button: Button, s: Session): void {
  const active = button.enabled;
  panel(ctx, button.x, button.y + 4, button.w, button.h, active ? '#145e64' : '#b6cbc8', 14);
  panel(ctx, button.x, button.y, button.w, button.h, active ? TEAL : '#cad9d6', 14);
  text(ctx, button.label, button.x + button.w / 2, button.y + button.h / 2, button.id.startsWith('puzzle:') ? 21 : 19, active ? '#ffffff' : '#5f7775', button.w - 12);
  if (button.id.startsWith('puzzle:') && s.completed.has(PUZZLES[Number(button.id.slice(7))].id)) text(ctx, '✓', button.x + button.w - 20, button.y + 17, 20, '#ffffff');
}
function lesson(ctx: CanvasRenderingContext2D, value: string): void {
  const words = value.split(' '); let line = '', y = 738;
  for (const word of words) {
    if ((line + word).length > 42) { text(ctx, line.trim(), 270, y, 19); line = ''; y += 24; }
    line += word + ' ';
  }
  text(ctx, line.trim(), 270, y, 19);
}
export function render(ctx: CanvasRenderingContext2D, s: Session, preview: Preview | null = null): void {
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  text(ctx, 'CAR PARK', 270, 136, 38);
  text(ctx, `${s.index + 1}  ${s.state.puzzle.name}`, 270, 188, 27);
  if (s.screen === 'levels') {
    text(ctx, 'Choose a puzzle', 270, 207, 22, TEAL);
    for (const button of buttonsFor(s)) drawButton(ctx, button, s);
  } else {
    text(ctx, s.screen === 'won' ? 'EXIT REACHED!' : 'DRIVE RED TO THE EXIT', 270, 220, 19, TEAL);
    drawBoard(ctx, s, preview);
    if (s.screen === 'won') {
      panel(ctx, 70, 692, 400, 56, '#fff3c8');
      text(ctx, 'The lane is clear!', 270, 720, 31, TEAL);
    } else lesson(ctx, s.hintMove || s.hintUnavailable ? s.status : s.state.puzzle.lesson);
    for (const button of buttonsFor(s)) drawButton(ctx, button, s);
  }
  if (s.paused) {
    ctx.fillStyle = '#173d48bb'; ctx.fillRect(0, 60, WIDTH, HEIGHT - 60);
    text(ctx, 'Paused', 270, 435, 54, '#ffffff');
    text(ctx, 'Take your time. The cars can wait.', 270, 488, 22, '#ffffff');
    for (const button of buttonsFor(s)) drawButton(ctx, button, s);
  }
  text(ctx, 'Drag cars along their lane. Red drives right.', 270, 917, 17, TEAL);
  text(ctx, 'Arrows + Enter · H hint · U undo · R reset · L puzzles', 270, 945, 14, TEAL);
  drawAllGamesButton(ctx); drawMuteButton(ctx, s.muted);
  if (s.screen === 'play') drawPauseButton(ctx);
}
