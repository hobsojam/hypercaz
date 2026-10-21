import {
  COOLDOWN,
  CRATE,
  DROP_Y,
  FAMILY_POINTS,
  MAX_FRAME,
  MAX_SIZE,
  OVER_TIME,
  POINTS,
  RADII,
  STEP,
} from './constants.ts';
import { type Ball, makeBall, stepPhysics, touching } from './physics.ts';
import { clampAim, type MergeState, overLine, rollSize } from './state.ts';

export interface MergeInput {
  aimX: number | null; // pointer x in logical px, or null to keep the last aim
  drop: boolean;
}

// The only way game state changes. Mutates `state` in place, running whole
// physics STEPs and carrying the remainder to the next call.
export function stepMerge(state: MergeState, input: MergeInput, dt: number): void {
  state.events = [];
  if (state.phase === 'over') return;

  state.aimX = clampAim(input.aimX ?? state.aimX, state.current);
  if (input.drop && state.cooldown <= 0) drop(state);

  state.carry += Math.min(dt, MAX_FRAME);
  while (state.carry >= STEP && state.phase === 'play') {
    state.carry -= STEP;
    tick(state);
  }
}

function drop(state: MergeState): void {
  state.balls.push(makeBall(state.nextId++, state.current, state.aimX, DROP_Y));
  state.events.push({ type: 'drop', size: state.current });
  state.current = state.next;
  [state.next, state.rng] = rollSize(state.rng);
  state.aimX = clampAim(state.aimX, state.current);
  state.cooldown = COOLDOWN;
  state.chain = 0;
}

function tick(state: MergeState): void {
  const airborne = state.balls.filter((b) => !b.landed);
  stepPhysics(state.balls);
  for (const b of airborne) {
    if (b.landed) state.events.push({ type: 'land', size: b.size });
  }
  mergeTouching(state);
  state.cooldown = Math.max(0, state.cooldown - STEP);
  state.danger = overLine(state) ? state.danger + STEP : 0;
  if (state.danger >= OVER_TIME) {
    state.phase = 'over';
    state.events.push({ type: 'over' });
  }
}

// Merges every touching same-size pair, lowest ids first, each ball at most
// once per step. A merged ball can chain with its neighbours on the next step.
function mergeTouching(state: MergeState): void {
  const pairs = touchingPairs(state.balls);
  if (pairs.length === 0) return;
  const used = new Set<Ball>();
  const made: Ball[] = [];
  for (const [a, b] of pairs) {
    if (used.has(a) || used.has(b)) continue;
    used.add(a);
    used.add(b);
    const ball = mergePair(state, a, b);
    if (ball) made.push(ball);
  }
  state.balls = state.balls.filter((b) => !used.has(b)).concat(made);
}

// Same-size touching pairs, sorted by (min id, max id).
function touchingPairs(balls: readonly Ball[]): [Ball, Ball][] {
  const pairs: [Ball, Ball][] = [];
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const [a, b] = balls[i].id < balls[j].id ? [balls[i], balls[j]] : [balls[j], balls[i]];
      if (a.size === b.size && touching(a, b)) pairs.push([a, b]);
    }
  }
  return pairs.sort(([a1, b1], [a2, b2]) => a1.id - a2.id || b1.id - b2.id);
}

// Scores a pair and returns the ball it becomes, or null when two snowmen
// leave the crate as a family.
function mergePair(state: MergeState, a: Ball, b: Ball): Ball | null {
  state.chain++;
  const link = state.chain;
  const x = (a.x + b.x) / 2;
  const y = (a.y + b.y) / 2;
  if (a.size === MAX_SIZE) {
    const points = FAMILY_POINTS * link;
    state.score += points;
    state.events.push({ type: 'family', x, y, link, points });
    return null;
  }
  const size = a.size + 1;
  const ball = mergedBall(state.nextId++, size, a, b);
  const points = POINTS[size] * link;
  state.score += points;
  state.events.push({ type: 'merge', size, x: ball.x, y: ball.y, link, points });
  return ball;
}

// The bigger ball sits where the pair met with their average velocity, nudged
// inside the walls and floor it may now overhang.
function mergedBall(id: number, size: number, a: Ball, b: Ball): Ball {
  const r = RADII[size];
  const x = clampAim((a.x + b.x) / 2, size);
  const y = Math.min(CRATE.floor - r, (a.y + b.y) / 2);
  const ball = makeBall(id, size, x, y);
  ball.px = x - (a.x - a.px + b.x - b.px) / 2;
  ball.py = y - (a.y - a.py + b.y - b.py) / 2;
  ball.age = Math.max(a.age, b.age);
  ball.landed = true;
  return ball;
}
