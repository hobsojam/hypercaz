import { expect, test } from 'vitest';
import { PUZZLES } from '../../games/arrows/levels.ts';
import { removable, createState, type Puzzle } from '../../games/arrows/sim.ts';

// Independent occupancy algorithm: no production cells, blocker or remove calls.
function solve(p: Puzzle, removed: readonly number[] = []): number[] | null {
  const pending = p.arrows.filter(a => !removed.includes(a.id));
  const order: number[] = [];
  const vectors = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
  while (pending.length) {
    const occupied = new Set(pending.flatMap(a => a.path.map(c => `${c.x},${c.y}`)));
    const index = pending.findIndex(a => {
      const [dx, dy] = vectors[a.direction];
      const head = a.path[a.path.length - 1];
      for (let x = head.x + dx, y = head.y + dy; x >= 0 && y >= 0 && x < p.size && y < p.size; x += dx, y += dy) {
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

test('the opening stays straight, then L shapes and two bends are taught before mixed boards', () => {
  const bends = (path: readonly { x: number; y: number }[]) => path.slice(2).filter((p, i) => {
    const a = path[i], b = path[i + 1];
    return p.x - b.x !== b.x - a.x || p.y - b.y !== b.y - a.y;
  }).length;
  expect(PUZZLES.slice(0, 2).flatMap(p => p.arrows).every(a => bends(a.path) === 0)).toBe(true);
  expect(PUZZLES[2].arrows.some(a => bends(a.path) === 1)).toBe(true);
  expect(PUZZLES[3].arrows.some(a => bends(a.path) === 2)).toBe(true);
  for (const p of PUZZLES.slice(2)) expect(p.arrows.some(a => bends(a.path) > 0)).toBe(true);
});
