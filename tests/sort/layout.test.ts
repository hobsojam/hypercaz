import { describe, expect, test } from 'vitest';
import { buttonRects, layoutTubes, tubeAt } from '../../games/sort/render/layout.ts';

const TOP = 70;
const BOTTOM = 90;
const overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe.each([
  [1280, 800],
  [390, 844],
])('at %ix%i', (w, h) => {
  test.each([5, 12])('%i tubes fit between the bands without overlapping', (count) => {
    const rects = layoutTubes(count, w, h);
    expect(rects).toHaveLength(count);
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(w);
      expect(r.y).toBeGreaterThanOrEqual(TOP);
      expect(r.y + r.h).toBeLessThanOrEqual(h - BOTTOM);
      expect(r.w).toBeGreaterThanOrEqual(44);
      expect(r.w).toBeLessThanOrEqual(80);
      expect(r.h / r.w).toBeCloseTo(3.6, 1);
    }
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(overlap(rects[i]!, rects[j]!)).toBe(false);
  });

  test('the undo and restart buttons sit in the bottom band, side by side at the centre', () => {
    const { undo, restart } = buttonRects(w, h);
    expect(undo.y).toBeGreaterThanOrEqual(h - BOTTOM);
    expect(undo.y + undo.h).toBeLessThanOrEqual(h);
    expect(undo.x + undo.w).toBeLessThanOrEqual(restart.x);
    expect((undo.x + restart.x + restart.w) / 2).toBeCloseTo(w / 2, 5);
  });
});

test('on desktop, 5 tubes form one centred row of full-size tubes', () => {
  const rects = layoutTubes(5, 1280, 800);
  expect(new Set(rects.map((r) => r.y)).size).toBe(1);
  expect(rects[0]!.w).toBe(80);
  const left = rects[0]!.x;
  const right = 1280 - (rects[4]!.x + rects[4]!.w);
  expect(left).toBeCloseTo(right, 5);
  expect(rects[1]!.x - (rects[0]!.x + rects[0]!.w)).toBeCloseTo(0.6 * 80, 5);
});

test('on desktop, 12 tubes still form one row', () => {
  expect(new Set(layoutTubes(12, 1280, 800).map((r) => r.y)).size).toBe(1);
});

test('on an upright phone, 5 tubes wrap into two rows of full-size tubes rather than one row of small ones', () => {
  const rects = layoutTubes(5, 390, 844);
  expect(new Set(rects.map((r) => r.y)).size).toBe(2);
  expect(rects[0]!.w).toBe(80);
});

test('a wide but short window keeps one row while the tubes can be 44 px wide', () => {
  const rects = layoutTubes(12, 900, 420);
  expect(new Set(rects.map((r) => r.y)).size).toBe(1);
  expect(rects[0]!.w).toBeGreaterThanOrEqual(44);
});

test('on an upright phone, 12 tubes wrap into centred rows', () => {
  const rects = layoutTubes(12, 390, 844);
  const rows = [...new Set(rects.map((r) => r.y))];
  expect(rows.length).toBe(3);
  for (const y of rows) {
    const row = rects.filter((r) => r.y === y);
    const left = row[0]!.x;
    const right = 390 - (row.at(-1)!.x + row.at(-1)!.w);
    expect(left).toBeCloseTo(right, 5);
  }
});

test('tubes are left to right, then row by row', () => {
  const rects = layoutTubes(12, 390, 844);
  for (let i = 1; i < rects.length; i++) {
    const a = rects[i - 1]!;
    const b = rects[i]!;
    expect(b.y > a.y || (b.y === a.y && b.x > a.x)).toBe(true);
  }
});

describe('tubeAt', () => {
  const rects = layoutTubes(5, 1280, 800);
  test('hits a tube at its centre', () => {
    rects.forEach((r, i) => expect(tubeAt(rects, r.x + r.w / 2, r.y + r.h / 2)).toBe(i));
  });
  test('is generous by 10 px', () => {
    const r = rects[2]!;
    expect(tubeAt(rects, r.x - 9, r.y + r.h / 2)).toBe(2);
    expect(tubeAt(rects, r.x + r.w / 2, r.y + r.h + 9)).toBe(2);
  });
  test('misses the middle of a gap and empty space', () => {
    const a = rects[1]!;
    const b = rects[2]!;
    expect(tubeAt(rects, (a.x + a.w + b.x) / 2, a.y + a.h / 2)).toBeNull();
    expect(tubeAt(rects, 640, 30)).toBeNull();
    expect(tubeAt(rects, 20, 400)).toBeNull();
  });
});
