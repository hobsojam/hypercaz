export type Axis = 'H' | 'V';
export interface Car { readonly id: string; readonly axis: Axis; readonly x: number; readonly y: number; readonly length: 2 | 3; readonly target?: boolean }
export interface Puzzle { readonly id: number; readonly name: string; readonly lesson: string; readonly size: number; readonly cars: readonly Car[] }
export interface State { readonly puzzle: Puzzle; readonly positions: number[] }
export interface Move { readonly carId: string; readonly to: number }

export function createState(puzzle: Puzzle): State {
  return { puzzle, positions: puzzle.cars.map(car => car.axis === 'H' ? car.x : car.y) };
}

export function occupied(car: Car, position: number, x: number, y: number): boolean {
  return car.axis === 'H' ? y === car.y && x >= position && x < position + car.length : x === car.x && y >= position && y < position + car.length;
}

function blocked(state: State, except: number, x: number, y: number): boolean {
  return state.puzzle.cars.some((car, i) => i !== except && occupied(car, state.positions[i], x, y));
}

export function legalRange(state: State, index: number): readonly [number, number] {
  const car = state.puzzle.cars[index];
  if (!car) return [0, -1];
  const p = state.positions[index], size = state.puzzle.size;
  let low = p, high = p;
  while (low > 0 && !blocked(state, index, car.axis === 'H' ? low - 1 : car.x, car.axis === 'V' ? low - 1 : car.y)) low--;
  while (high + car.length < size && !blocked(state, index, car.axis === 'H' ? high + car.length : car.x, car.axis === 'V' ? high + car.length : car.y)) high++;
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

export function solve(state: State): readonly Move[] | null {
  const { puzzle } = state, start = [...state.positions], startKey = start.join(',');
  const queue: number[][] = [start], parents = new Map<string, { previous: string | null; step: Move | null }>();
  parents.set(startKey, { previous: null, step: null });
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const positions = queue[cursor], node: State = { puzzle, positions }, key = positions.join(',');
    if (isWon(node)) {
      const answer: Move[] = [];
      for (let current = key; ; ) {
        const link = parents.get(current)!;
        if (!link.previous || !link.step) break;
        answer.push(link.step); current = link.previous;
      }
      return answer.reverse();
    }
    for (let i = 0; i < puzzle.cars.length; i++) {
      const [low, high] = legalRange(node, i);
      for (let to = low; to <= high; to++) {
        if (to === positions[i]) continue;
        const next = [...positions]; next[i] = to;
        const nextKey = next.join(',');
        if (parents.has(nextKey)) continue;
        parents.set(nextKey, { previous: key, step: { carId: puzzle.cars[i].id, to } });
        queue.push(next);
        if (queue.length > 200_000) return null;
      }
    }
  }
  return null;
}

export function validatePuzzle(puzzle: Puzzle): Puzzle {
  const fail = (): never => { throw new Error(`Invalid Car Park puzzle ${puzzle.id}`); };
  if (!Number.isInteger(puzzle.id) || puzzle.id < 1 || !puzzle.name || !puzzle.lesson || puzzle.size !== 6 || puzzle.cars.length < 2) fail();
  if (puzzle.cars.filter(car => car.target).length !== 1) fail();
  const seen = new Set<string>(), ids = new Set<string>();
  for (const car of puzzle.cars) {
    if (!car.id || ids.has(car.id) || (car.axis !== 'H' && car.axis !== 'V') || (car.length !== 2 && car.length !== 3) || !Number.isInteger(car.x) || !Number.isInteger(car.y) || car.x < 0 || car.y < 0 || car.x + (car.axis === 'H' ? car.length : 1) > puzzle.size || car.y + (car.axis === 'V' ? car.length : 1) > puzzle.size || (car.target && (car.axis !== 'H' || car.y !== 2))) fail();
    ids.add(car.id);
    for (let k = 0; k < car.length; k++) {
      const x = car.x + (car.axis === 'H' ? k : 0), y = car.y + (car.axis === 'V' ? k : 0), key = `${x},${y}`;
      if (seen.has(key)) fail();
      seen.add(key);
    }
  }
  const state = createState(puzzle);
  if (isWon(state) || !solve(state)) fail();
  return puzzle;
}
