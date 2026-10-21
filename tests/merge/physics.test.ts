import { expect, test } from 'vitest';
import {
  CRATE,
  DROP_Y,
  ITERATIONS,
  MAX_PUSH,
  RADII,
  STEP,
} from '../../games/merge/sim/constants.ts';
import { type Ball, makeBall, speed, stepPhysics } from '../../games/merge/sim/physics.ts';

const STEPS_PER_SECOND = Math.round(1 / STEP);

function run(balls: Ball[], seconds: number, each?: (balls: Ball[]) => void): void {
  for (let i = 0; i < seconds * STEPS_PER_SECOND; i++) {
    stepPhysics(balls);
    each?.(balls);
  }
}

// 40 balls, sizes cycling 1..5, one every 0.25 s at x positions cycling across
// the crate, then 12 s to settle.
function dropPile(each?: (balls: Ball[]) => void): Ball[] {
  const balls: Ball[] = [];
  const xs = [100, 380, 200, 300, 140, 440, 250, 330];
  for (let i = 0; i < 40; i++) {
    balls.push(makeBall(i, (i % 5) + 1, xs[i % xs.length], DROP_Y));
    run(balls, 0.25, each);
  }
  run(balls, 12, each);
  return balls;
}

function overlap(a: Ball, b: Ball): number {
  return RADII[a.size] + RADII[b.size] - Math.hypot(a.x - b.x, a.y - b.y);
}

test('a ball dropped into an empty crate rests on the floor', () => {
  const ball = makeBall(1, 3, 270, DROP_Y);
  run([ball], 3);
  expect(Math.abs(ball.y - (CRATE.floor - RADII[3]))).toBeLessThan(0.5);
  expect(speed(ball)).toBeLessThan(1);
  expect(ball.landed).toBe(true);
});

test('a pile settles and stops jittering', () => {
  const balls = dropPile();
  for (const b of balls) expect(speed(b)).toBeLessThan(5);
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      expect(overlap(balls[i], balls[j])).toBeLessThanOrEqual(1.5);
    }
  }
  const before = balls.map((b) => ({ x: b.x, y: b.y }));
  run(balls, 1);
  balls.forEach((b, i) => {
    expect(Math.hypot(b.x - before[i].x, b.y - before[i].y)).toBeLessThan(0.5);
  });
});

test('balls never leave the crate walls or floor', () => {
  let escapes = 0;
  dropPile((balls) => {
    for (const b of balls) {
      const r = RADII[b.size];
      if (b.x - r < CRATE.left - 0.01) escapes++;
      if (b.x + r > CRATE.right + 0.01) escapes++;
      if (b.y + r > CRATE.floor + 0.01) escapes++;
    }
  });
  expect(escapes).toBe(0);
});

test('a big overlap is pushed apart gently', () => {
  const big = makeBall(1, 9, 270, CRATE.floor - RADII[9]);
  // The small ball sits on top of the big one, overlapping it by 60 px.
  const small = makeBall(2, 1, 270, big.y - (RADII[9] + RADII[1] - 60));
  const balls = [big, small];
  const start = balls.map((b) => ({ x: b.x, y: b.y }));
  stepPhysics(balls);
  balls.forEach((b, i) => {
    expect(Math.hypot(b.x - start[i].x, b.y - start[i].y)).toBeLessThanOrEqual(
      MAX_PUSH * ITERATIONS + 2,
    );
  });
  run(balls, 2);
  expect(small.y - RADII[1]).toBeGreaterThan(CRATE.top - 100);
  expect(overlap(big, small)).toBeLessThanOrEqual(1);
});

test('a falling ball knocks a resting one aside', () => {
  const resting = makeBall(1, 3, 270, CRATE.floor - RADII[3]);
  const falling = makeBall(2, 3, 270 + 8, DROP_Y);
  run([resting, falling], 1);
  expect(Math.abs(resting.x - 270)).toBeGreaterThan(10);
});

test('the same balls give the same result', () => {
  expect(JSON.stringify(dropPile())).toBe(JSON.stringify(dropPile()));
});
