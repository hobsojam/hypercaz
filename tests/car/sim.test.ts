import { expect, test } from 'vitest';
import { createState, legalRange, move, isWon, solve, validatePuzzle, type Puzzle } from '../../games/car/sim.ts';

const puzzle: Puzzle = {
  id: 1, name: 'Make Room', lesson: 'Move the blue car first.', size: 6,
  cars: [
    { id: 'T', axis: 'H', x: 0, y: 2, length: 2, target: true },
    { id: 'A', axis: 'V', x: 3, y: 1, length: 2 },
    { id: 'B', axis: 'H', x: 2, y: 0, length: 2 },
  ],
};

test('cars slide only through clear cells along their axis and stay inside the lot', () => {
  const s = createState(puzzle);
  expect(legalRange(s, 0)).toEqual([0, 1]);
  expect(move(s, 0, 4)).toBe(false);
  expect(move(s, 0, -1)).toBe(false);
  expect(move(s, 1, 0)).toBe(false); // B covers its destination
  expect(move(s, 2, 0)).toBe(true);
  expect(legalRange(s, 1)).toEqual([0, 4]);
  expect(move(s, 1, 0)).toBe(true);
  expect(move(s, 0, 4)).toBe(true);
  expect(isWon(s)).toBe(true);
});

test('a hint solves the current arrangement and does not mutate it', () => {
  const s = createState(puzzle), original = [...s.positions];
  const answer = solve(s);
  expect(answer?.length).toBeGreaterThan(0);
  expect(s.positions).toEqual(original);
  for (const step of answer ?? []) {
    const i = puzzle.cars.findIndex(c => c.id === step.carId);
    expect(move(s, i, step.to)).toBe(true);
  }
  expect(isWon(s)).toBe(true);
});

test('validation rejects overlap, missing target and a solved starting layout', () => {
  expect(validatePuzzle(puzzle)).toBe(puzzle);
  expect(() => validatePuzzle({ ...puzzle, cars: puzzle.cars.slice(1) })).toThrow();
  expect(() => validatePuzzle({ ...puzzle, cars: [...puzzle.cars, { id: 'C', axis: 'H', x: 1, y: 2, length: 2 }] })).toThrow();
  expect(() => validatePuzzle({ ...puzzle, cars: [{ ...puzzle.cars[0], x: 4 }, ...puzzle.cars.slice(1)] })).toThrow();
});
