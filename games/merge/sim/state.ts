import { createRng, nextFloat } from '../../../engine/rng.ts';
import { CRATE, DANGER_Y, DROP_WEIGHTS, RADII, SETTLE_AGE, WIDTH } from './constants.ts';
import type { Ball } from './physics.ts';

export type MergeEvent =
  | { type: 'drop'; size: number }
  | { type: 'land'; size: number }
  | { type: 'merge'; size: number; x: number; y: number; link: number; points: number }
  | { type: 'family'; x: number; y: number; link: number; points: number }
  | { type: 'over' };

export interface MergeState {
  balls: Ball[];
  nextId: number;
  aimX: number;
  current: number; // size of the hanging ball, 1..4
  next: number; // size shown as next, 1..4
  cooldown: number; // seconds until the next drop is allowed
  chain: number; // merges since the last drop
  score: number;
  danger: number; // seconds settled snow has been above DANGER_Y
  phase: 'play' | 'over';
  events: MergeEvent[]; // this call's events; cleared at the start of each stepMerge
  rng: number;
  carry: number; // leftover sim time below one STEP
}

export function createMerge(seed: number): MergeState {
  const [current, afterCurrent] = rollSize(createRng(seed));
  const [next, rng] = rollSize(afterCurrent);
  return {
    balls: [],
    nextId: 1,
    aimX: WIDTH / 2,
    current,
    next,
    cooldown: 0,
    chain: 0,
    score: 0,
    danger: 0,
    phase: 'play',
    events: [],
    rng,
    carry: 0,
  };
}

// Picks a drop size 1..4 by the odds in DROP_WEIGHTS.
export function rollSize(rng: number): [size: number, rng: number] {
  const [r, next] = nextFloat(rng);
  const total = DROP_WEIGHTS.reduce((sum, w) => sum + w, 0);
  let pick = r * total;
  for (let i = 0; i < DROP_WEIGHTS.length - 1; i++) {
    pick -= DROP_WEIGHTS[i];
    if (pick < 0) return [i + 1, next];
  }
  return [DROP_WEIGHTS.length, next];
}

export function clampAim(x: number, size: number): number {
  const r = RADII[size];
  return Math.min(CRATE.right - r, Math.max(CRATE.left + r, x));
}

// Snow counts as over the line only once it has had time to settle, so a
// fresh drop or a ball bounced up by a merge does not.
export function overLine(state: MergeState): boolean {
  return state.balls.some((b) => b.age >= SETTLE_AGE && b.y - RADII[b.size] < DANGER_Y);
}
