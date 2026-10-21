import { expect, test } from 'vitest';
import { PUZZLES } from '../../games/car/levels.ts';
import type { Car, Puzzle } from '../../games/car/sim.ts';

// Independent breadth-first check using rectangle intersection, including
// every intermediate position so a car cannot pass through another car.
function bounds(car: Car, position: number) {
  return car.axis === 'H'
    ? { left: position, right: position + car.length, top: car.y, bottom: car.y + 1 }
    : { left: car.x, right: car.x + 1, top: position, bottom: position + car.length };
}
function overlap(a: ReturnType<typeof bounds>, b: ReturnType<typeof bounds>): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
function independentDistance(puzzle: Puzzle): number | null {
  const start = puzzle.cars.map(c => c.axis === 'H' ? c.x : c.y);
  const queue: { positions: number[]; distance: number }[] = [{ positions: start, distance: 0 }];
  const seen = new Set([start.join(',')]);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const { positions, distance } = queue[cursor];
    const target = puzzle.cars.findIndex(c => c.target);
    if (positions[target] + puzzle.cars[target].length === puzzle.size) return distance;
    for (let i = 0; i < puzzle.cars.length; i++) {
      const car = puzzle.cars[i];
      for (const direction of [-1, 1]) {
        for (let to = positions[i] + direction; to >= 0 && to + car.length <= puzzle.size; to += direction) {
          const candidate = bounds(car, to);
          if (puzzle.cars.some((other, j) => j !== i && overlap(candidate, bounds(other, positions[j])))) break;
          const next = [...positions]; next[i] = to;
          const key = next.join(',');
          if (!seen.has(key)) { seen.add(key); queue.push({ positions: next, distance: distance + 1 }); }
        }
      }
    }
  }
  return null;
}

test('six distinct fixed boards have progressive, independently checked solutions', () => {
  expect(PUZZLES.map(p => p.id)).toEqual([1, 2, 3, 4, 5, 6]);
  expect(PUZZLES.map(independentDistance)).toEqual([2, 3, 3, 4, 4, 5]);
});
