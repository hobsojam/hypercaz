import { expect, test } from 'vitest';
import { starsFor } from '../../../games/squad/sim/stars.ts';
import { makeLevel } from '../fixtures.ts';

test('stars from result and final count', () => {
  const level = makeLevel({ stars: [15, 30] });
  expect(starsFor(level, false, 99)).toBe(0);
  expect(starsFor(level, true, 1)).toBe(1);
  expect(starsFor(level, true, 15)).toBe(2);
  expect(starsFor(level, true, 30)).toBe(3);
});
