import { nextFloat } from '../../../engine/rng.ts';
import {
  BASE_WIDTH,
  DEBRIS_GRAVITY,
  DEBRIS_REMOVE_Y,
  DEBRIS_SPIN_MAX,
  PERFECT_TOLERANCE,
  REGROW,
  REGROW_FROM,
  SPEED_FULL_AT,
  SPEED_MAX,
  SPEED_START,
  WIDTH,
} from './constants.ts';
import type { Slab, StackState } from './state.ts';

export interface StackInput {
  drop: boolean;
}

// The only way game state changes. Mutates `state` in place.
export function step(state: StackState, input: StackInput, dt: number): void {
  state.events = [];
  moveDebris(state, dt);
  if (state.phase === 'over') return;

  state.speed = speedFor(state.floors.length);
  slide(state, dt);
  if (input.drop) drop(state);
  state.time += dt;
}

export function speedFor(floors: number): number {
  const t = Math.min(1, floors / SPEED_FULL_AT);
  return SPEED_START + (SPEED_MAX - SPEED_START) * t;
}

// Bounce between -width/2 and WIDTH - width/2, reflecting any overshoot.
function slide(state: StackState, dt: number): void {
  const m = state.moving;
  const lo = -m.width / 2;
  const hi = WIDTH - m.width / 2;
  let x = m.x + m.dir * state.speed * dt;
  while (x > hi || x < lo) {
    if (x > hi) {
      x = 2 * hi - x;
      m.dir = -1;
    } else {
      x = 2 * lo - x;
      m.dir = 1;
    }
  }
  m.x = x;
}

function drop(state: StackState): void {
  const top = state.floors[state.floors.length - 1]!;
  const m = state.moving;
  const left = Math.max(m.x, top.x);
  const right = Math.min(m.x + m.width, top.x + top.width);

  if (right <= left) {
    state.phase = 'over';
    state.events.push({ type: 'miss' });
    addDebris(state, { x: m.x, width: m.width });
    return;
  }

  let placed: Slab;
  if (Math.abs(m.x - top.x) <= PERFECT_TOLERANCE) {
    state.streak++;
    placed = { x: top.x, width: top.width };
    if (state.streak >= REGROW_FROM) {
      const width = Math.min(BASE_WIDTH, top.width + REGROW * BASE_WIDTH);
      placed = { x: top.x - (width - top.width) / 2, width };
    }
    state.events.push({ type: 'perfect', streak: state.streak });
  } else {
    state.streak = 0;
    placed = { x: left, width: right - left };
    const trimmed = m.width - placed.width;
    // The overhang is whichever side of the moving slab sticks out.
    const overhangX = m.x < top.x ? m.x : right;
    addDebris(state, { x: overhangX, width: trimmed });
    state.events.push({ type: 'place', perfect: false, trimmed });
  }

  state.floors.push(placed);
  // Alternate the starting side each floor.
  const fromLeft = state.floors.length % 2 === 1;
  state.moving = {
    x: fromLeft ? -placed.width / 2 : WIDTH - placed.width / 2,
    width: placed.width,
    dir: fromLeft ? 1 : -1,
  };
  state.speed = speedFor(state.floors.length);
}

function addDebris(state: StackState, piece: Slab): void {
  const [r, next] = nextFloat(state.rng);
  state.rng = next;
  state.debris.push({ ...piece, y: 0, vy: 0, spin: (r * 2 - 1) * DEBRIS_SPIN_MAX });
}

function moveDebris(state: StackState, dt: number): void {
  for (const d of state.debris) {
    d.vy += DEBRIS_GRAVITY * dt;
    d.y += d.vy * dt;
  }
  state.debris = state.debris.filter((d) => d.y < DEBRIS_REMOVE_Y);
}
