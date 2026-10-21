export type Direction = 'N' | 'E' | 'S' | 'W';
export interface Cell { readonly x: number; readonly y: number }
export interface Arrow { readonly id: number; readonly direction: Direction; readonly path: readonly Cell[] }
export interface Puzzle {
  readonly id: number;
  readonly name: string;
  readonly lesson: string;
  readonly size: number;
  readonly arrows: readonly Arrow[];
}
export interface State { readonly puzzle: Puzzle; readonly remaining: Set<number> }
export const VECTORS: Readonly<Record<Direction, Cell>> = {
  N: { x: 0, y: -1 }, E: { x: 1, y: 0 }, S: { x: 0, y: 1 }, W: { x: -1, y: 0 },
};

export function cells(arrow: Arrow): readonly Cell[] { return arrow.path; }

export function exitRay(puzzle: Puzzle, arrow: Arrow): readonly Cell[] {
  const head = arrow.path.at(-1)!, v = VECTORS[arrow.direction], ray: Cell[] = [];
  for (let x = head.x + v.x, y = head.y + v.y; x >= 0 && y >= 0 && x < puzzle.size && y < puzzle.size; x += v.x, y += v.y) ray.push({ x, y });
  return ray;
}

export function blocker(puzzle: Puzzle, remaining: ReadonlySet<number>, id: number): Arrow | null {
  const arrow = puzzle.arrows.find(a => a.id === id);
  if (!arrow || !remaining.has(id)) return null;
  for (const cell of exitRay(puzzle, arrow)) {
    const hit = puzzle.arrows.find(a => a.id !== id && remaining.has(a.id) && a.path.some(c => c.x === cell.x && c.y === cell.y));
    if (hit) return hit;
  }
  return null;
}

export function removable(puzzle: Puzzle, remaining: ReadonlySet<number>): readonly Arrow[] {
  return puzzle.arrows.filter(a => remaining.has(a.id) && !blocker(puzzle, remaining, a.id));
}

export function createState(puzzle: Puzzle): State {
  return { puzzle, remaining: new Set(puzzle.arrows.map(a => a.id)) };
}

export function remove(state: State, id: number): 'removed' | 'blocked' | 'ignored' {
  if (!state.remaining.has(id)) return 'ignored';
  if (blocker(state.puzzle, state.remaining, id)) return 'blocked';
  state.remaining.delete(id);
  return 'removed';
}

function validatePath(puzzle: Puzzle, arrow: Arrow, fail: () => never): void {
  const path = arrow.path;
  for (let i = 1; i < path.length; i++) {
    if (Math.abs(path[i].x - path[i - 1].x) + Math.abs(path[i].y - path[i - 1].y) !== 1) fail();
  }
  if (path.length > 1) {
    const head = path.at(-1)!, neck = path.at(-2)!, v = VECTORS[arrow.direction];
    if (head.x - neck.x !== v.x || head.y - neck.y !== v.y) fail();
  }
  if (exitRay(puzzle, arrow).some(c => path.some(p => p.x === c.x && p.y === c.y))) fail();
}

function validateArrows(puzzle: Puzzle, fail: () => never): void {
  const occupied = new Set<string>(), ids = new Set<number>();
  for (const arrow of puzzle.arrows) {
    if (!Number.isInteger(arrow.id) || ids.has(arrow.id) || !Object.hasOwn(VECTORS, arrow.direction) || !Array.isArray(arrow.path) || !arrow.path.length || arrow.path.length > puzzle.size * puzzle.size) fail();
    ids.add(arrow.id);
    validatePath(puzzle, arrow, fail);
    for (const c of cells(arrow)) {
      const key = `${c.x},${c.y}`;
      if (!Number.isInteger(c.x) || !Number.isInteger(c.y) || c.x < 0 || c.y < 0 || c.x >= puzzle.size || c.y >= puzzle.size || occupied.has(key)) fail();
      occupied.add(key);
    }
  }
}

export function validatePuzzle(puzzle: Puzzle): Puzzle {
  const fail = (): never => { throw new Error(`Invalid Arrow Escape puzzle ${puzzle.id}`); };
  if (!Number.isInteger(puzzle.id) || puzzle.id < 1 || !puzzle.name || !puzzle.lesson || !Number.isInteger(puzzle.size) || puzzle.size < 4 || puzzle.size > 8 || !puzzle.arrows.length) fail();
  validateArrows(puzzle, fail);
  const state = createState(puzzle);
  while (state.remaining.size) {
    const free = removable(puzzle, state.remaining);
    if (!free.length) fail();
    for (const arrow of free) state.remaining.delete(arrow.id);
  }
  return puzzle;
}
