import type { Cage, Level } from '../levels.ts';
import { BALL_RADIUS, BOARD, CAGE_RADIUS, LAUNCHER, MAX_ANGLE, MAX_BANKS, MIN_ANGLE, SHOT_SPEED } from './constants.ts';
import { expand, sweepCircle, sweepRect, type Collision, type Point } from './geometry.ts';

export interface Ball extends Point { vx: number; vy: number; banks: number }
export type Phase = 'aiming' | 'flying' | 'won' | 'lost';
export type GameEvent =
  | { type: 'shot' | 'bank' | 'rescue'; x: number; y: number }
  | { type: 'return' | 'won' | 'lost' };
export interface State {
  level: Level;
  phase: Phase;
  shotsUsed: number;
  cages: (Cage & { rescued: boolean })[];
  ball: Ball | null;
  events: GameEvent[];
}
interface Impact extends Collision { kind: 'wall' | 'drain' | 'cage'; cage?: number }
const EPS = 1e-7;

export function createState(level: Level): State {
  return { level, phase: 'aiming', shotsUsed: 0, cages: level.cages.map(c => ({ ...c, rescued: false })), ball: null, events: [] };
}

export function shoot(state: State, angle: number): boolean {
  if (state.phase !== 'aiming' || !Number.isFinite(angle) || angle < MIN_ANGLE || angle > MAX_ANGLE) return false;
  state.shotsUsed++;
  state.ball = { ...LAUNCHER, vx: Math.cos(angle) * SHOT_SPEED, vy: Math.sin(angle) * SHOT_SPEED, banks: 0 };
  state.phase = 'flying';
  state.events = [{ type: 'shot', ...LAUNCHER }];
  return true;
}

function nextImpact(state: State, limit: number): Impact | null {
  const ball = state.ball!;
  const v = { x: ball.vx, y: ball.vy };
  const hits: Impact[] = [];
  const boundary = (time: number, nx: number, ny: number, kind: 'wall' | 'drain' = 'wall') => {
    if (time >= -EPS && time <= limit + EPS) hits.push({ time: Math.max(0, time), nx, ny, kind });
  };
  if (ball.vx < -EPS) boundary((BOARD.x + BALL_RADIUS - ball.x) / ball.vx, 1, 0);
  if (ball.vx > EPS) boundary((BOARD.x + BOARD.w - BALL_RADIUS - ball.x) / ball.vx, -1, 0);
  if (ball.vy < -EPS) boundary((BOARD.y + BALL_RADIUS - ball.y) / ball.vy, 0, 1);
  if (ball.vy > EPS) boundary((BOARD.y + BOARD.h - BALL_RADIUS - ball.y) / ball.vy, 0, -1, 'drain');
  for (const wall of state.level.walls) {
    const hit = sweepRect(ball, v, expand(wall, BALL_RADIUS), limit);
    if (hit) hits.push({ ...hit, kind: 'wall' });
  }
  state.cages.forEach((cage, i) => {
    if (cage.rescued) return;
    const hit = sweepCircle(ball, v, cage, CAGE_RADIUS + BALL_RADIUS, limit);
    if (hit) hits.push({ ...hit, kind: 'cage', cage: i });
  });
  hits.sort((a, b) => a.time - b.time);
  const first = hits[0];
  if (!first) return null;
  if (first.kind === 'wall') for (const hit of hits) {
    if (hit.kind === 'wall' && Math.abs(hit.time - first.time) <= EPS) {
      first.nx ||= hit.nx;
      first.ny ||= hit.ny;
    }
  }
  return first;
}

function returnBall(state: State): void {
  state.ball = null;
  state.phase = state.shotsUsed >= state.level.shots ? 'lost' : 'aiming';
  state.events.push({ type: 'return' });
  if (state.phase === 'lost') state.events.push({ type: 'lost' });
}

function resolve(state: State, hit: Impact): void {
  const ball = state.ball!;
  if (hit.kind === 'drain') return returnBall(state);
  if (hit.kind === 'cage') {
    const cage = state.cages[hit.cage!];
    cage.rescued = true;
    state.events.push({ type: 'rescue', x: cage.x, y: cage.y });
    if (state.cages.every(c => c.rescued)) {
      state.phase = 'won';
      state.ball = null;
      state.events.push({ type: 'won' });
    }
    return;
  }
  if (hit.nx) ball.vx = -ball.vx;
  if (hit.ny) ball.vy = -ball.vy;
  // Nudge outward to avoid repeatedly hitting the same zero-time surface.
  ball.x += hit.nx * EPS * 10;
  ball.y += hit.ny * EPS * 10;
  ball.banks++;
  state.events.push({ type: 'bank', x: ball.x, y: ball.y });
  if (ball.banks >= MAX_BANKS) returnBall(state);
}

export function step(state: State, dt: number): void {
  state.events = [];
  if (state.phase !== 'flying' || !Number.isFinite(dt) || dt <= 0) return;
  let remaining = dt;
  for (let i = 0; i < 64 && state.ball && remaining > EPS; i++) {
    const hit = nextImpact(state, remaining);
    const time = hit ? hit.time : remaining;
    state.ball.x += state.ball.vx * time;
    state.ball.y += state.ball.vy * time;
    remaining -= time;
    if (!hit) return;
    resolve(state, hit);
  }
}

export function preview(state: State, angle: number): Point[] {
  const copy: State = { ...state, cages: state.cages.map(c => ({ ...c })), events: [], ball: null };
  if (!shoot(copy, angle)) return [];
  const points: Point[] = [{ ...LAUNCHER }];
  for (let i = 0; i < 64 && copy.ball; i++) {
    const hit = nextImpact(copy, 100);
    if (!hit) break;
    copy.ball.x += copy.ball.vx * hit.time;
    copy.ball.y += copy.ball.vy * hit.time;
    points.push({ x: copy.ball.x, y: copy.ball.y });
    resolve(copy, hit);
    if (copy.ball && copy.ball.banks > 2) break;
  }
  return points;
}

export function starsFor(state: State): 0 | 1 | 2 | 3 {
  if (state.phase !== 'won') return 0;
  if (state.shotsUsed <= state.level.par) return 3;
  return state.shotsUsed === state.level.par + 1 ? 2 : 1;
}
