import { expect, test } from 'vitest';
import { formationHalfWidth, formationSlots } from '../../../games/squad/sim/formation.ts';

test('empty and single squads', () => {
  expect(formationSlots(0)).toEqual([]);
  expect(formationSlots(1)).toEqual([{ dx: 0, dz: 0 }]);
});

test('small squads form a single front row', () => {
  expect(formationSlots(5).every((s) => s.dz === 0)).toBe(true);
});

test('squads grow deep rather than wide: row 2 starts at 8 soldiers, centred behind', () => {
  const s = formationSlots(8);
  expect(s.filter((x) => x.dz === 0)).toHaveLength(7);
  expect(s[7].dx).toBeCloseTo(0);
  expect(s[7].dz).toBeCloseTo(-0.6);
});

test('huge squads are capped at 150 drawn and stay within the width cap', () => {
  const big = formationSlots(5000);
  expect(big).toHaveLength(150);
  expect(Math.max(...big.map((s) => Math.abs(s.dx)))).toBeLessThanOrEqual(0.21 + 1e-9);
});

test('half width has a minimum for a lone soldier', () => {
  expect(formationHalfWidth(formationSlots(1))).toBe(0.03);
  expect(formationHalfWidth(formationSlots(7))).toBeCloseTo(0.21);
  expect(formationHalfWidth(formationSlots(500))).toBeCloseTo(0.21);
});
