import { expect, it } from 'vitest';
import { fitLetterbox, viewFor } from '../../engine/input.ts';

it('window mode maps clicks straight through', () => {
  expect(viewFor('window', 1280, 800, 540, 960)).toEqual({ offsetX: 0, offsetY: 0, scale: 1 });
});

it('letterbox mode is fitLetterbox', () => {
  expect(viewFor('letterbox', 1280, 800, 540, 960)).toEqual(fitLetterbox(1280, 800, 540, 960));
});
