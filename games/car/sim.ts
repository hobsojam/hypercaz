export type Axis = 'H' | 'V';
export interface Car { readonly id: string; readonly axis: Axis; readonly x: number; readonly y: number; readonly length: 2 | 3; readonly target?: boolean }
export interface Puzzle { readonly id: number; readonly name: string; readonly lesson: string; readonly size: number; readonly cars: readonly Car[] }
export interface State { readonly puzzle: Puzzle; readonly positions: number[] }
export interface Move { readonly carId: string; readonly to: number }
type Parent = { previous: string | null; step: Move | null };

function startingPosition(car: Car): number {
  if (car.axis === 'H') return car.x;
  return car.y;
}

function laneCell(car: Car, position: number): { x: number; y: number } {
  if (car.axis === 'H') return { x: position, y: car.y };
  return { x: car.x, y: position };
}

export function createState(puzzle: Puzzle): State {
  return { puzzle, positions: puzzle.cars.map(startingPosition) };
}

export function occupied(car: Car, position: number, x: number, y: number): boolean {
  if (car.axis === 'H') return y === car.y && x >= position && x < position + car.length;
  return x === car.x && y >= position && y < position + car.length;
}

function blocked(state: State, except: number, x: number, y: number): boolean {
  return state.puzzle.cars.some((car, i) => i !== except && occupied(car, state.positions[i], x, y));
}

export function legalRange(state: State, index: number): readonly [number, number] {
  const car = state.puzzle.cars[index];
  if (!car) return [0, -1];
  const p = state.positions[index], size = state.puzzle.size;
  let low = p, high = p;
  while (low > 0) {
    const cell = laneCell(car, low - 1);
    if (blocked(state, index, cell.x, cell.y)) break;
    low--;
  }
  while (high + car.length < size) {
    const cell = laneCell(car, high + car.length);
    if (blocked(state, index, cell.x, cell.y)) break;
    high++;
  }
  return [low, high];
}

export function move(state: State, index: number, to: number): boolean {
  if (!Number.isInteger(to) || !state.puzzle.cars[index] || to === state.positions[index]) return false;
  const [low, high] = legalRange(state, index);
  if (to < low || to > high) return false;
  state.positions[index] = to;
  return true;
}

export function isWon(state: State): boolean {
  const index = state.puzzle.cars.findIndex(car => car.target);
  return index >= 0 && state.positions[index] + state.puzzle.cars[index].length === state.puzzle.size;
}

function pathTo(key: string, parents: Map<string, Parent>): Move[] {
  const answer: Move[] = [];
  let current = key;
  while (true) {
    const link = parents.get(current)!;
    if (!link.previous || !link.step) break;
    answer.push(link.step);
    current = link.previous;
  }
  return answer.reverse();
}

function enqueueMoves(node: State, key: string, queue: number[][], parents: Map<string, Parent>): boolean {
  for (const [index, car] of node.puzzle.cars.entries()) {
    const [low, high] = legalRange(node, index);
    for (let to = low; to <= high; to++) {
      if (to === node.positions[index]) continue;
      const next = [...node.positions];
      next[index] = to;
      const nextKey = next.join(',');
      if (parents.has(nextKey)) continue;
      parents.set(nextKey, { previous: key, step: { carId: car.id, to } });
      queue.push(next);
      if (queue.length > 200_000) return false;
    }
  }
  return true;
}

export function solve(state: State): readonly Move[] | null {
  const { puzzle } = state, start = [...state.positions];
  const queue: number[][] = [start], parents = new Map<string, Parent>();
  parents.set(start.join(','), { previous: null, step: null });
  for (const positions of queue) {
    const node: State = { puzzle, positions }, key = positions.join(',');
    if (isWon(node)) return pathTo(key, parents);
    if (!enqueueMoves(node, key, queue, parents)) return null;
  }
  return null;
}

function invalidPuzzle(puzzle: Puzzle): never {
  throw new Error(`Invalid Car Park puzzle ${puzzle.id}`);
}

function validCar(car: Car): boolean {
  return Boolean(car.id) && (car.axis === 'H' || car.axis === 'V') &&
    (car.length === 2 || car.length === 3) && Number.isInteger(car.x) && Number.isInteger(car.y) &&
    car.x >= 0 && car.y >= 0 && (!car.target || (car.axis === 'H' && car.y === 2));
}

function addCarCells(puzzle: Puzzle, car: Car, seen: Set<string>): void {
  const start = startingPosition(car);
  const end = laneCell(car, start + car.length - 1);
  if (end.x >= puzzle.size || end.y >= puzzle.size) invalidPuzzle(puzzle);
  for (let offset = 0; offset < car.length; offset++) {
    const { x, y } = laneCell(car, start + offset), key = `${x},${y}`;
    if (seen.has(key)) invalidPuzzle(puzzle);
    seen.add(key);
  }
}

export function validatePuzzle(puzzle: Puzzle): Puzzle {
  if (!Number.isInteger(puzzle.id) || puzzle.id < 1 || !puzzle.name || !puzzle.lesson || puzzle.size !== 6 || puzzle.cars.length < 2) invalidPuzzle(puzzle);
  if (puzzle.cars.filter(car => car.target).length !== 1) invalidPuzzle(puzzle);
  const seen = new Set<string>(), ids = new Set<string>();
  for (const car of puzzle.cars) {
    if (!validCar(car) || ids.has(car.id)) invalidPuzzle(puzzle);
    ids.add(car.id);
    addCarCells(puzzle, car, seen);
  }
  const state = createState(puzzle);
  if (isWon(state) || !solve(state)) invalidPuzzle(puzzle);
  return puzzle;
}
