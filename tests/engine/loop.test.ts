import { expect, test } from 'vitest';
import { advance, STEP } from '../../engine/loop.ts';

test('a long stall is clamped to at most 15 steps', () => {
  expect(advance(0, 10).steps).toBe(15);
});

test('one frame of 1/60 s is one step', () => {
  const r = advance(0, 1 / 60);
  expect(r.steps).toBe(1);
  expect(r.alpha).toBeGreaterThanOrEqual(0);
  expect(r.alpha).toBeLessThan(1);
});

test('leftover time carries into the next frame', () => {
  const r = advance(0, STEP * 1.5);
  expect(r.steps).toBe(1);
  expect(r.acc).toBeCloseTo(STEP * 0.5);
  expect(r.alpha).toBeCloseTo(0.5);
});
