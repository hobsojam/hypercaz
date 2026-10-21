import { validatePuzzle, type Axis, type Car, type Puzzle } from './sim.ts';

type Shape = readonly [id: string, axis: Axis, x: number, y: number, length: 2 | 3];
function puzzle(id: number, name: string, lesson: string, shapes: readonly Shape[]): Puzzle {
  const cars: Car[] = shapes.map(([carId, axis, x, y, length]) => ({ id: carId, axis, x, y, length, target: carId === 'T' }));
  return validatePuzzle({ id, name, lesson, size: 6, cars });
}

export const PUZZLES: readonly Puzzle[] = [
  puzzle(1, 'First Drive', 'Slide the tall car away, then drive red to the exit.', [
    ['T', 'H', 0, 2, 2], ['A', 'V', 3, 1, 2],
  ]),
  puzzle(2, 'Two Gates', 'Both cars in the red lane need a parking space.', [
    ['T', 'H', 0, 2, 2], ['A', 'V', 3, 1, 2], ['B', 'V', 4, 2, 2],
  ]),
  puzzle(3, 'Make Room', 'Move a car beside the blocker to open a way out.', [
    ['T', 'H', 0, 2, 2], ['A', 'V', 3, 1, 2], ['B', 'H', 2, 0, 2],
    ['C', 'H', 2, 3, 2], ['D', 'V', 1, 3, 2], ['E', 'V', 4, 3, 2],
  ]),
  puzzle(4, 'Lower Lane', 'Clear room below the long car before moving it.', [
    ['T', 'H', 0, 2, 2], ['A', 'V', 3, 1, 3],
    ['B', 'H', 2, 4, 2], ['C', 'H', 2, 5, 2],
  ]),
  puzzle(5, 'Side Street', 'One sideways move can free more than one blocker.', [
    ['T', 'H', 0, 2, 2], ['A', 'V', 3, 1, 2], ['B', 'V', 4, 1, 2],
    ['C', 'H', 2, 0, 3], ['D', 'H', 2, 3, 3],
  ]),
  puzzle(6, 'The Open Road', 'Preserve space below both long cars.', [
    ['T', 'H', 0, 2, 2], ['A', 'V', 3, 0, 3], ['B', 'V', 4, 1, 3],
    ['C', 'H', 2, 4, 3], ['D', 'H', 2, 5, 3],
  ]),
];
