import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { type AssetEntry, frameAt, parseManifest } from '../../engine/assets.ts';

const real = JSON.parse(readFileSync(join(import.meta.dirname, '../../games/squad/assets/manifest.json'), 'utf8'));

test('the game manifest parses', () => {
  const m = parseManifest(real);
  expect(m.entries.length).toBe(19);
  expect(m.entries.map((e) => e.id)).toContain('hazard_barricade');
});

test('a bad entry is named in the error', () => {
  const bad = structuredClone(real);
  bad.entries[2].frames = 0;
  expect(() => parseManifest(bad)).toThrow('manifest: entries[2].frames must be an integer >= 1');
});

test('duplicate ids are rejected', () => {
  const bad = structuredClone(real);
  bad.entries[1].id = bad.entries[0].id;
  expect(() => parseManifest(bad)).toThrow('manifest: entries[1].id "soldier_run" is a duplicate');
});

test('frameAt loops through frames at the entry fps', () => {
  const e = { fps: 10, frames: 4 } as AssetEntry;
  expect(frameAt(e, 0.35)).toBe(3);
  expect(frameAt(e, 0.45)).toBe(0);
  expect(frameAt({ fps: 0, frames: 1 } as AssetEntry, 12)).toBe(0);
});
