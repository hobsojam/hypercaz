import { expect, test } from 'vitest';
import { ease, tweenValue } from '../../engine/tween.ts';

test('tweens interpolate and clamp', () => {
  expect(tweenValue(0, 10, 0.5)).toBe(5);
  expect(tweenValue(0, 10, -1)).toBe(0);
  expect(tweenValue(0, 10, 2)).toBe(10);
});

test('easings start at 0 and end at 1', () => {
  for (const e of Object.values(ease)) {
    expect(e(0)).toBeCloseTo(0);
    expect(e(1)).toBeCloseTo(1);
  }
});
