import { expect, test } from 'vitest';
import { DEFAULT_VIEW, project, unprojectX } from '../../engine/perspective.ts';

test('squad line centre maps to screen centre at scale 1', () => {
  expect(project(DEFAULT_VIEW, 0, 0)).toEqual({ sx: 270, sy: 800, scale: 1 });
});

test('at z = focal everything is half scale', () => {
  const p = project(DEFAULT_VIEW, 1, 20);
  expect(p.scale).toBeCloseTo(0.5);
  expect(p.sx).toBeCloseTo(385);
  expect(p.sy).toBeCloseTo(510);
});

test('unprojectX inverts project', () => {
  expect(unprojectX(DEFAULT_VIEW, project(DEFAULT_VIEW, 0.3, 10).sx, 10)).toBeCloseTo(0.3);
});

test('z far behind the camera is clamped to stay finite', () => {
  const p = project(DEFAULT_VIEW, 0, -50);
  expect(Number.isFinite(p.scale)).toBe(true);
  expect(p.scale).toBeGreaterThan(0);
});
