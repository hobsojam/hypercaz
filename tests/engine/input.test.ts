import { expect, test } from 'vitest';
import { fitLetterbox, toLogical } from '../../engine/input.ts';

test('wide window letterboxes the portrait canvas horizontally', () => {
  const lb = fitLetterbox(1920, 1080, 540, 960);
  expect(lb.scale).toBeCloseTo(1.125);
  expect(lb.offsetX).toBeCloseTo(656.25);
  expect(lb.offsetY).toBeCloseTo(0);
  const c = toLogical(lb, 960, 540);
  expect(c.x).toBeCloseTo(270);
  expect(c.y).toBeCloseTo(480);
});

test('mapping stays correct after a resize to a tall window', () => {
  const lb = fitLetterbox(800, 2000, 540, 960);
  const c = toLogical(lb, 400, 1000);
  expect(c.x).toBeCloseTo(270);
  expect(c.y).toBeCloseTo(480);
});
