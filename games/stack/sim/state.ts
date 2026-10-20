import { createRng } from '../../../engine/rng.ts';
import { BASE_WIDTH, SPEED_START, WIDTH } from './constants.ts';

export interface Slab {
  x: number; // left edge, logical px
  width: number;
}

export interface Debris {
  x: number; // left edge, logical px
  width: number;
  floor: number; // the row it was cut from, which fixes its colour and where it falls from
  y: number; // floors below where the slab was dropped (positive is down)
  vy: number; // floors per second
  spin: number; // radians per second
}

export type StackEvent =
  | { type: 'place'; perfect: false; trimmed: number }
  | { type: 'perfect'; streak: number }
  | { type: 'miss' };

export interface StackState {
  floors: Slab[]; // bottom to top
  moving: Slab & { dir: 1 | -1 };
  speed: number;
  streak: number; // perfects in a row
  phase: 'play' | 'over';
  time: number;
  events: StackEvent[];
  debris: Debris[];
  rng: number;
}

export function createStack(seed: number): StackState {
  const base: Slab = { x: (WIDTH - BASE_WIDTH) / 2, width: BASE_WIDTH };
  return {
    floors: [base],
    moving: { x: -base.width / 2, width: base.width, dir: 1 },
    speed: SPEED_START,
    streak: 0,
    phase: 'play',
    time: 0,
    events: [],
    debris: [],
    rng: createRng(seed),
  };
}
