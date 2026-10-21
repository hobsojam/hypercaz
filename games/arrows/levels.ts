import { validatePuzzle, type Direction, type Puzzle } from './sim.ts';

type Placement = readonly [x: number, y: number, direction: Direction, length: number];
function puzzle(id: number, name: string, lesson: string, size: number, placements: readonly Placement[]): Puzzle {
  return validatePuzzle({ id, name, lesson, size, arrows: placements.map(([x, y, direction, length], i) => ({ id: i + 1, x, y, direction, length })) });
}

export const PUZZLES: readonly Puzzle[] = [
  puzzle(1, "First Exit", "Find the arrow with a clear path to the edge.", 4, [
    [1, 1, 'E', 1], [2, 1, 'N', 1], [2, 0, 'E', 1],
  ]),
  puzzle(2, "Follow the Shaft", "The whole shaft blocks a path, not just the tip.", 4, [
    [0, 2, 'E', 2], [2, 2, 'N', 2], [2, 0, 'E', 2], [0, 0, 'S', 1],
  ]),
  puzzle(3, "Four Directions", "Arrows leave in the direction they point.", 5, [
    [4, 2, 'S', 3], [4, 0, 'W', 3], [3, 1, 'W', 2], [1, 1, 'S', 2],
    [1, 4, 'E', 1], [1, 3, 'S', 1], [2, 3, 'S', 1],
  ]),
  puzzle(4, "Around the Corner", "Clear one path to open another.", 5, [
    [2, 4, 'W', 2], [3, 2, 'N', 1], [4, 0, 'S', 2], [0, 1, 'S', 2],
    [3, 3, 'W', 1], [1, 3, 'N', 1], [4, 3, 'S', 1], [4, 4, 'W', 2],
    [1, 0, 'E', 2],
  ]),
  puzzle(5, "Crossroads", "Look along each arrow all the way to the edge.", 6, [
    [3, 4, 'S', 2], [3, 3, 'W', 3], [0, 0, 'E', 3], [2, 1, 'N', 1],
    [1, 1, 'S', 2], [4, 2, 'S', 2], [0, 3, 'N', 2], [3, 2, 'W', 2],
    [5, 3, 'W', 1], [1, 5, 'E', 2], [4, 1, 'N', 2],
  ]),
  puzzle(6, "Make Some Space", "Any arrow with a clear path is safe to remove.", 6, [
    [0, 4, 'N', 2], [1, 4, 'E', 1], [2, 1, 'N', 1], [4, 1, 'S', 3],
    [4, 4, 'E', 1], [1, 5, 'N', 1], [0, 1, 'W', 1], [4, 5, 'W', 3],
    [5, 3, 'N', 2], [4, 0, 'S', 1], [3, 3, 'E', 1], [2, 4, 'E', 2],
    [5, 4, 'N', 1],
  ]),
  puzzle(7, "Threads", "Try tracing a path from its tip outward.", 6, [
    [5, 3, 'N', 3], [1, 3, 'W', 1], [3, 3, 'W', 2], [1, 0, 'S', 3],
    [0, 5, 'W', 1], [5, 0, 'W', 2], [1, 4, 'E', 2], [5, 5, 'W', 2],
    [0, 0, 'S', 2], [2, 2, 'N', 2], [4, 4, 'S', 1], [3, 1, 'N', 2],
    [3, 5, 'N', 2], [0, 4, 'E', 1],
  ]),
  puzzle(8, "The Weave", "Work from the open edges toward the middle.", 7, [
    [0, 4, 'E', 3], [1, 6, 'S', 1], [3, 5, 'E', 2], [6, 4, 'S', 2],
    [6, 6, 'W', 2], [2, 1, 'E', 2], [5, 5, 'N', 2], [1, 5, 'E', 2],
    [0, 0, 'S', 2], [0, 2, 'S', 2], [4, 0, 'S', 3], [2, 3, 'N', 2],
    [6, 0, 'N', 1], [3, 4, 'E', 1], [4, 3, 'S', 2], [6, 3, 'S', 1],
    [3, 0, 'E', 1],
  ]),
  puzzle(9, "Side Streets", "A long shaft can block several paths.", 7, [
    [3, 4, 'N', 2], [1, 5, 'N', 3], [5, 0, 'S', 3], [0, 2, 'S', 3],
    [3, 0, 'W', 2], [4, 3, 'S', 2], [6, 5, 'W', 2], [6, 6, 'W', 3],
    [6, 0, 'S', 1], [2, 5, 'S', 1], [2, 1, 'E', 3], [4, 2, 'W', 2],
    [0, 1, 'N', 2], [2, 6, 'W', 2], [0, 6, 'S', 1], [1, 2, 'N', 3],
    [6, 4, 'W', 1], [4, 5, 'W', 2], [2, 4, 'W', 1],
  ]),
  puzzle(10, "Intersections", "Use Hint whenever you want a fresh starting point.", 8, [
    [3, 5, 'N', 3], [3, 7, 'N', 2], [4, 1, 'W', 2], [1, 2, 'N', 2],
    [7, 2, 'W', 3], [7, 3, 'W', 1], [1, 3, 'S', 1], [5, 6, 'N', 2],
    [1, 7, 'E', 1], [7, 0, 'S', 2], [6, 0, 'W', 3], [6, 3, 'W', 2],
    [4, 7, 'E', 1], [2, 5, 'N', 2], [2, 0, 'W', 2], [1, 6, 'W', 1],
    [1, 5, 'S', 1], [0, 3, 'S', 2], [0, 5, 'S', 3], [4, 2, 'W', 2],
    [7, 5, 'W', 1], [7, 6, 'S', 2],
  ]),
  puzzle(11, "Open the Centre", "Find an exit, then see what it opens.", 8, [
    [3, 1, 'E', 3], [3, 4, 'N', 3], [2, 7, 'N', 3], [6, 4, 'S', 3],
    [4, 3, 'S', 2], [5, 5, 'W', 2], [2, 0, 'W', 3], [6, 2, 'N', 3],
    [0, 3, 'N', 3], [5, 6, 'N', 1], [0, 5, 'N', 2], [5, 2, 'E', 1],
    [1, 6, 'W', 2], [7, 1, 'S', 2], [1, 2, 'E', 2], [5, 7, 'W', 3],
    [3, 5, 'S', 2], [2, 4, 'N', 2], [6, 3, 'E', 1], [3, 0, 'E', 2],
    [7, 3, 'S', 3], [4, 2, 'E', 1], [7, 6, 'S', 2], [1, 5, 'S', 1],
    [5, 3, 'W', 1],
  ]),
  puzzle(12, "The Great Escape", "One clear path can unravel the whole board.", 8, [
    [5, 4, 'W', 1], [7, 5, 'W', 3], [3, 5, 'N', 2], [5, 2, 'N', 2],
    [0, 0, 'S', 2], [7, 1, 'S', 3], [0, 6, 'E', 3], [7, 0, 'E', 1],
    [3, 7, 'N', 1], [4, 0, 'E', 3], [2, 4, 'S', 2], [1, 3, 'N', 3],
    [6, 4, 'E', 1], [4, 1, 'W', 3], [4, 3, 'E', 2], [6, 7, 'E', 1],
    [4, 4, 'W', 1], [7, 7, 'S', 1], [7, 4, 'S', 1], [1, 5, 'S', 1],
    [1, 0, 'E', 2], [6, 3, 'E', 1], [4, 6, 'E', 3], [3, 3, 'N', 1],
    [5, 7, 'W', 1], [4, 7, 'W', 1], [4, 5, 'S', 1],
  ]),
];
