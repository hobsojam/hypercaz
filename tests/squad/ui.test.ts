import { expect, test } from 'vitest';
import { hitButton } from '../../games/squad/ui.ts';

test('button hit testing is inclusive at the edges', () => {
  const b = { x: 10, y: 20, w: 100, h: 50, label: 'Go', enabled: true };
  expect(hitButton(b, 10, 20)).toBe(true);
  expect(hitButton(b, 110, 70)).toBe(true);
  expect(hitButton(b, 9.9, 40)).toBe(false);
  expect(hitButton(b, 50, 70.1)).toBe(false);
});

test('disabled buttons are never hit', () => {
  expect(hitButton({ x: 0, y: 0, w: 10, h: 10, label: '', enabled: false }, 5, 5)).toBe(false);
});
