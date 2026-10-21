import { expect, test } from 'vitest';
import { followingPath, exitDistance } from '../../games/arrows/motion.ts';
import type { Arrow, Cell } from '../../games/arrows/sim.ts';

const arrow: Arrow = { id: 1, direction: 'E', path: [{ x: 1, y: 3 }, { x: 1, y: 2 }, { x: 2, y: 2 }] };
const length = (p: readonly Cell[]) => p.slice(1).reduce((sum, c, i) => sum + Math.hypot(c.x - p[i].x, c.y - p[i].y), 0);

test('the tail walks around the elbow while the head continues forward', () => {
  expect(followingPath(arrow, 0)).toEqual(arrow.path);
  expect(followingPath(arrow, 0.5)).toEqual([{ x: 1, y: 2.5 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 2.5, y: 2 }]);
  expect(followingPath(arrow, 1)).toEqual([{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }]);
  expect(followingPath(arrow, 2)).toEqual([{ x: 2, y: 2 }, { x: 4, y: 2 }]);
});

test('a path with two bends preserves its length and never invents a diagonal shortcut', () => {
  const a: Arrow = { id: 1, direction: 'E', path: [{ x: 0, y: 3 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 2, y: 2 }, { x: 3, y: 2 }] };
  const before = structuredClone(a);
  for (let distance = 0; distance <= 8; distance += 0.125) {
    const points = followingPath(a, distance);
    expect(length(points)).toBeCloseTo(4);
    for (let i = 1; i < points.length; i++) expect(points[i].x === points[i - 1].x || points[i].y === points[i - 1].y).toBe(true);
  }
  expect(a).toEqual(before);
});

test.each(['N', 'E', 'S', 'W'] as const)('%s exits fully, including the tail, before the flight ends', direction => {
  const paths = { N: [{ x: 2, y: 4 }, { x: 2, y: 3 }], E: [{ x: 1, y: 2 }, { x: 2, y: 2 }], S: [{ x: 2, y: 1 }, { x: 2, y: 2 }], W: [{ x: 3, y: 2 }, { x: 2, y: 2 }] };
  const a: Arrow = { id: 1, direction, path: paths[direction] };
  for (const p of followingPath(a, exitDistance(5, a))) expect(p.x < -0.5 || p.y < -0.5 || p.x > 4.5 || p.y > 4.5).toBe(true);
});

test('single-cell arrows travel forward without gaining length', () => {
  expect(followingPath({ id: 1, direction: 'N', path: [{ x: 2, y: 2 }] }, 1.5)).toEqual([{ x: 2, y: 0.5 }]);
});
