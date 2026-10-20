import { drawSprite, type AssetStore } from '../../engine/assets.ts';
import { buttonsFor, type Button } from './controls.ts';
import { LEVELS } from './levels.ts';
import type { Session } from './session.ts';
import { BALL_RADIUS, BOARD, HEIGHT, LAUNCHER, WIDTH } from './sim/constants.ts';
import { starsFor } from './sim/game.ts';
import type { Point, Rect } from './sim/geometry.ts';

const INK = '#173D48', TEAL = '#247D82', GOLD = '#F5B941';
const FONT = '"Trebuchet MS", "Segoe UI", sans-serif';

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size = 20, color = INK, align: CanvasTextAlign = 'center'): void {
  ctx.font = `bold ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}
function box(ctx: CanvasRenderingContext2D, r: Rect, fill: string, radius = 16): void {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, radius); ctx.fill();
}
function circle(ctx: CanvasRenderingContext2D, p: Point, radius: number, color: string): void {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill();
}
function star(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, filled: boolean): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? radius * 0.45 : radius;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath(); ctx.fillStyle = filled ? GOLD : '#D2DDCF'; ctx.fill();
}

export function render(ctx: CanvasRenderingContext2D, session: Session, assets: AssetStore): void {
  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT); bg.addColorStop(0, '#FFF8DF'); bg.addColorStop(1, '#E3EEDC');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  if (session.screen === 'levels') drawLevels(ctx, session);
  else {
    drawHeader(ctx, session);
    drawCourtyard(ctx, session, assets);
    if (session.paused || session.state.phase === 'won' || session.state.phase === 'lost') drawResult(ctx, session);
    drawLesson(ctx, session);
  }
  for (const button of buttonsFor(session)) if (!button.id.startsWith('level:')) drawButton(ctx, button);
}

function drawHeader(ctx: CanvasRenderingContext2D, s: Session): void {
  text(ctx, 'RICOCHET', 28, 34, 29, INK, 'left');
  text(ctx, 'RESCUE', 28, 65, 25, TEAL, 'left');
  box(ctx, { x: 28, y: 94, w: 484, h: 62 }, '#FFFFFF');
  text(ctx, `${s.state.level.id}. ${s.state.level.name}`, 44, 113, 18, INK, 'left');
  const remaining = s.state.level.shots - s.state.shotsUsed;
  text(ctx, `${remaining} shot${remaining === 1 ? '' : 's'} left`, 496, 113, 17, TEAL, 'right');
  text(ctx, `${s.state.cages.filter(c => c.rescued).length} / ${s.state.cages.length} rescued`, 44, 140, 16, TEAL, 'left');
  text(ctx, `PAR ${s.state.level.par}`, 496, 140, 15, '#89703E', 'right');
}

function drawCourtyard(ctx: CanvasRenderingContext2D, s: Session, assets: AssetStore): void {
  box(ctx, { ...BOARD, y: BOARD.y + 7 }, '#B8CAB3', 12);
  box(ctx, BOARD, '#DCE9D0', 10);
  for (let x = 48; x < 510; x += 28) for (let y = 192; y < 780; y += 28) circle(ctx, { x, y }, 1.2, '#C2D5B7');
  ctx.strokeStyle = '#6C9479'; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(BOARD.x, BOARD.y, BOARD.w, BOARD.h, 10); ctx.stroke();
  drawGuide(ctx, s.guide);
  for (const wall of s.state.level.walls) {
    box(ctx, { ...wall, y: wall.y + 5 }, '#477579', 5);
    box(ctx, wall, '#6A9D9C', 5);
    box(ctx, { x: wall.x + 3, y: wall.y + 2, w: wall.w - 6, h: Math.min(6, wall.h / 3) }, '#9CC1B5', 3);
  }
  for (const cage of s.state.cages) {
    if (cage.rescued) {
      circle(ctx, cage, 27, '#B9D8A4');
      const celebrating = s.effects.some(e => e.kind === 'rescue' && e.x === cage.x && e.y === cage.y);
      if (!celebrating) drawSprite(ctx, assets, 'soldier_run', s.time, cage.x, cage.y + 23, 1.2);
    } else {
      circle(ctx, { x: cage.x, y: cage.y + 22 }, 24, '#BECEA8');
      drawSprite(ctx, assets, 'cage', 0, cage.x, cage.y + 31, 1.1, { frame: 0 });
    }
  }
  drawLauncher(ctx, s.angle);
  if (s.state.ball) {
    const ball = s.state.ball;
    circle(ctx, { x: ball.x, y: ball.y + 3 }, BALL_RADIUS + 2, '#ADC5A0');
    circle(ctx, ball, BALL_RADIUS + 2, TEAL); circle(ctx, ball, BALL_RADIUS - 1, '#FFFFFF');
  }
  drawEffects(ctx, s, assets);
}

function drawGuide(ctx: CanvasRenderingContext2D, points: readonly Point[]): void {
  if (!points.length) return;
  ctx.save(); ctx.strokeStyle = '#527C80'; ctx.lineWidth = 3; ctx.setLineDash([3, 10]); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
  for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.stroke(); ctx.restore();
  for (const p of points.slice(1)) circle(ctx, p, 4, GOLD);
}

function drawLauncher(ctx: CanvasRenderingContext2D, angle: number): void {
  box(ctx, { x: LAUNCHER.x - 44, y: LAUNCHER.y - 11, w: 88, h: 34 }, '#426B72', 13);
  ctx.strokeStyle = '#286F9A'; ctx.lineWidth = 22; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(LAUNCHER.x, LAUNCHER.y);
  ctx.lineTo(LAUNCHER.x + Math.cos(angle) * 31, LAUNCHER.y + Math.sin(angle) * 31); ctx.stroke();
  circle(ctx, LAUNCHER, 21, '#2F8FC3'); circle(ctx, LAUNCHER, 10, '#D2F0FA');
}

function drawEffects(ctx: CanvasRenderingContext2D, s: Session, assets: AssetStore): void {
  for (const e of s.effects) {
    ctx.save(); ctx.globalAlpha = 1 - e.age / 0.8;
    if (e.kind === 'bank') {
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x, e.y, 5 + e.age * 25, 0, Math.PI * 2); ctx.stroke();
    } else {
      drawSprite(ctx, assets, 'cage_broken', 0, e.x, e.y + 31, 1.1);
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6, d = 12 + e.age * 65;
        circle(ctx, { x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d }, 3, i % 2 ? GOLD : '#FFFFFF');
      }
      drawSprite(ctx, assets, 'soldier_run', s.time, e.x, e.y + 23 - Math.sin(e.age / 0.8 * Math.PI) * 28, 1.2);
      text(ctx, 'RESCUED!', e.x, e.y - 48 - e.age * 20, 15, TEAL);
    }
    ctx.restore();
  }
}

function drawResult(ctx: CanvasRenderingContext2D, s: Session): void {
  ctx.fillStyle = 'rgba(23,61,72,0.35)'; ctx.fillRect(BOARD.x, BOARD.y, BOARD.w, BOARD.h);
  box(ctx, { x: 66, y: 296, w: 408, h: 354 }, '#FFFCEF', 24);
  if (s.paused) {
    text(ctx, 'Take a breather', 270, 382, 32);
    text(ctx, 'Your shot will wait.', 270, 438, 21, TEAL);
    return;
  }
  if (s.state.phase === 'won') {
    text(ctx, 'Everyone is free!', 270, 350, 31);
    const stars = starsFor(s.state);
    for (let i = 0; i < 3; i++) star(ctx, 270 + (i - 1) * 64, 420, 27, i < stars);
    text(ctx, `${s.state.shotsUsed} shot${s.state.shotsUsed === 1 ? '' : 's'} · par ${s.state.level.par}`, 270, 484, 23, TEAL);
    text(ctx, stars === 3 ? 'All three stars earned.' : 'Try fewer shots for more stars.', 270, 520, 17);
  } else {
    text(ctx, 'Try a new angle', 270, 380, 31);
    text(ctx, `${s.state.cages.filter(c => c.rescued).length} / ${s.state.cages.length} friends rescued`, 270, 438, 23, TEAL);
    text(ctx, 'Retry gives you a fresh set of shots.', 270, 482, 17);
  }
}

function drawButton(ctx: CanvasRenderingContext2D, b: Button): void {
  ctx.save(); ctx.globalAlpha = b.enabled ? 1 : 0.42;
  box(ctx, { ...b, y: b.y + 4 }, '#1A5D64');
  box(ctx, b, b.id === 'next' ? '#247D82' : '#3B8990');
  text(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2, b.id === 'mute' ? 12 : 21, '#FFFFFF');
  ctx.restore();
}

function drawLesson(ctx: CanvasRenderingContext2D, s: Session): void {
  const words = s.state.level.lesson.split(' '); const lines: string[] = []; let line = '';
  ctx.font = `bold 17px ${FONT}`;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > 480) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  lines.slice(0, 2).forEach((value, i) => text(ctx, value, 270, 908 + i * 23, 17, TEAL));
  text(ctx, 'Ball returns at the bottom or after 8 banks.', 270, 951, 12, '#647D72');
}

function drawLevels(ctx: CanvasRenderingContext2D, s: Session): void {
  text(ctx, 'Choose a puzzle', 270, 112, 36);
  text(ctx, 'Eight little rescues. Every puzzle is open.', 270, 157, 18, TEAL);
  const buttons = buttonsFor(s).filter(b => b.id.startsWith('level:'));
  for (const [i, b] of buttons.entries()) {
    box(ctx, { ...b, y: b.y + 5 }, '#B5CBB4');
    box(ctx, b, s.menuIndex === i ? '#D0E6D2' : '#FFFCEF');
    text(ctx, String(i + 1), b.x + 25, b.y + 25, 18, TEAL);
    text(ctx, b.label, b.x + b.w / 2, b.y + 57, 21);
    for (let n = 0; n < 3; n++) star(ctx, b.x + b.w / 2 + (n - 1) * 32, b.y + 98, 12, n < (s.best[LEVELS[i].id] ?? 0));
  }
  text(ctx, 'Arrow keys to choose · Enter to open', 270, 928, 17, TEAL);
}
