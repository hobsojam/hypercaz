import { expect, test } from 'vitest';
import { PUZZLES } from '../../games/arrows/levels.ts';
import { removable, createState, type Puzzle } from '../../games/arrows/sim.ts';

// Independent occupancy algorithm: no production cells, blocker or remove calls.
function solve(p: Puzzle, removed: readonly number[] = []): number[] | null {
  const pending = p.arrows.filter(a => !removed.includes(a.id));
  const order: number[] = [];
  const vectors = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
  while (pending.length) {
    const occupied = new Set(pending.flatMap(a => {
      const [dx, dy] = vectors[a.direction];
      return Array.from({ length: a.length }, (_, i) => `${a.x + i * dx},${a.y + i * dy}`);
    }));
    const index = pending.findIndex(a => {
      const [dx, dy] = vectors[a.direction];
      for (let x = a.x + a.length * dx, y = a.y + a.length * dy; x >= 0 && y >= 0 && x < p.size && y < p.size; x += dx, y += dy) {
        if (occupied.has(`${x},${y}`)) return false;
      }
      return true;
    });
    if (index < 0) return null;
    order.push(pending.splice(index, 1)[0].id);
  }
  return order;
}

test('twelve distinct fixed puzzles introduce denser boards and long arrows', () => {
  expect(PUZZLES.map(p => p.id)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  expect(PUZZLES[0].arrows.length).toBe(3);
  expect(PUZZLES.at(-1)!.arrows.length).toBeGreaterThan(20);
  expect(new Set(PUZZLES.flatMap(p => p.arrows.map(a => a.direction))).size).toBe(4);
});

test.each(Array.from({ length: 12 }, (_, i) => i))('puzzle %i has an independent solution and any legal first move preserves solvability', index => {
  const p = PUZZLES[index];
  expect(solve(p)).toHaveLength(p.arrows.length);
  for (const first of removable(p, createState(p).remaining)) expect(solve(p, [first.id])).toHaveLength(p.arrows.length - 1);
});
