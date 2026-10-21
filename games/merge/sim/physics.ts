// Position-based Verlet circles in the crate. Pure and deterministic: the same
// balls in the same order always give the same result.

import {
  CRATE,
  DAMPING,
  GRAVITY,
  ITERATIONS,
  MAX_PUSH,
  RADII,
  RESTITUTION,
  STEP,
} from './constants.ts';

export interface Ball {
  id: number;
  size: number;
  x: number;
  y: number;
  px: number; // previous position; velocity is (x - px, y - py) per step
  py: number;
  age: number;
  landed: boolean;
}

export function makeBall(id: number, size: number, x: number, y: number): Ball {
  return { id, size, x, y, px: x, py: y, age: 0, landed: false };
}

export function speed(b: Ball): number {
  return Math.hypot(b.x - b.px, b.y - b.py) / STEP;
}

export function touching(a: Ball, b: Ball): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= RADII[a.size] + RADII[b.size] + 1;
}

export function stepPhysics(balls: Ball[]): void {
  const freeSpeeds = balls.map(integrate);
  for (let pass = 0; pass < ITERATIONS; pass++) {
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) separate(balls[i], balls[j]);
    }
    for (const b of balls) clampToCrate(b);
  }
  balls.forEach((b, i) => limitSpeed(b, freeSpeeds[i]));
}

// Moves a ball one step under its own velocity and gravity, returning that
// free-flight speed in px per step.
function integrate(b: Ball): number {
  const vx = (b.x - b.px) * DAMPING;
  const vy = (b.y - b.py) * DAMPING;
  b.px = b.x;
  b.py = b.y;
  b.x += vx;
  b.y += vy + GRAVITY * STEP * STEP;
  b.age += STEP;
  return Math.hypot(b.x - b.px, b.y - b.py);
}

// Collisions may slow or turn a ball but never speed it up: overlap pushed
// out this step moves the ball without becoming velocity, so a merged ball
// shoulders its neighbours aside instead of launching them.
function limitSpeed(b: Ball, freeSpeed: number): void {
  const vx = b.x - b.px;
  const vy = b.y - b.py;
  const v = Math.hypot(vx, vy);
  if (v <= freeSpeed) return;
  const scale = freeSpeed / v;
  b.px = b.x - vx * scale;
  b.py = b.y - vy * scale;
}

// Pushes an overlapping pair apart along the centre line, the lighter ball
// (mass ∝ r²) moving more, each move capped at MAX_PUSH.
function separate(a: Ball, b: Ball): void {
  const ra = RADII[a.size];
  const rb = RADII[b.size];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const overlap = ra + rb - dist;
  if (overlap <= 0) return;
  a.landed = true;
  b.landed = true;
  // Coincident centres have no centre line: split along x, smaller id to the left.
  const coincident = dist === 0;
  const sign = a.id < b.id ? 1 : -1;
  const nx = coincident ? sign : dx / dist;
  const ny = coincident ? 0 : dy / dist;
  const ma = ra * ra;
  const mb = rb * rb;
  const moveA = Math.min(MAX_PUSH, (overlap * mb) / (ma + mb));
  const moveB = Math.min(MAX_PUSH, (overlap * ma) / (ma + mb));
  a.x -= nx * moveA;
  a.y -= ny * moveA;
  b.x += nx * moveB;
  b.y += ny * moveB;
}

// Clamps a ball inside the walls and above the floor, keeping RESTITUTION of
// any speed it had into the surface as a bounce back out.
function clampToCrate(b: Ball): void {
  const r = RADII[b.size];
  const left = CRATE.left + r;
  const right = CRATE.right - r;
  const floor = CRATE.floor - r;
  if (b.x < left) {
    b.x = left;
    b.px = bounce(b.x, b.px, -1);
  } else if (b.x > right) {
    b.x = right;
    b.px = bounce(b.x, b.px, 1);
  }
  if (b.y >= floor) {
    b.y = floor;
    b.py = bounce(b.y, b.py, 1);
    b.landed = true;
  }
}

// Returns the previous position that reflects motion heading into a surface
// (outward is the direction into it: -1 or 1), scaled by RESTITUTION.
function bounce(pos: number, prev: number, outward: number): number {
  const v = pos - prev;
  if (v * outward <= 0) return prev;
  return pos + v * RESTITUTION;
}
