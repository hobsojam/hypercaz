import { join } from 'node:path';
import { expect, test } from 'vitest';
import { checkAssets } from '../../scripts/check-assets.ts';

const fx = (d: string) => join(import.meta.dirname, '../fixtures/assets', d);

test('the real assets dir passes before any art exists', () => {
  expect(checkAssets(join(import.meta.dirname, '../../games/squad/assets'))).toEqual([]);
});

test('matching PNG and SVG files pass', () => {
  expect(checkAssets(fx('good'))).toEqual([]);
});

test('wrong dimensions are reported', () => {
  expect(checkAssets(fx('wrong'))).toEqual(['soldier_run.png: expected 256x80, got 128x80']);
});

test('missing files are reported', () => {
  expect(checkAssets(fx('missing'))).toEqual(['missing file: soldier_run.png']);
});

test('unlisted files are reported', () => {
  expect(checkAssets(fx('extra'))).toEqual(['unlisted file: extra.png']);
});
