export type Direction = 'N' | 'E' | 'S' | 'W';
export interface Cell { readonly x: number; readonly y: number }
export interface Arrow extends Cell { readonly id: number; readonly direction: Direction; readonly length: number }
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

export function cells(arrow: Arrow): readonly Cell[] {
  const v = VECTORS[arrow.direction];
  return Array.from({ length: arrow.length }, (_, i) => ({ x: arrow.x + i * v.x, y: arrow.y + i * v.y }));
}

export function blocker(puzzle: Puzzle, remaining: ReadonlySet<number>, id: number): Arrow | null {
  const arrow = puzzle.arrows.find(a => a.id === id);
  if (!arrow || !remaining.has(id)) return null;
  const v = VECTORS[arrow.direction];
  for (let x = arrow.x + v.x * arrow.length, y = arrow.y + v.y * arrow.length; x >= 0 && y >= 0 && x < puzzle.size && y < puzzle.size; x += v.x, y += v.y) {
    const hit = puzzle.arrows.find(a => a.id !== id && remaining.has(a.id) && cells(a).some(c => c.x === x && c.y === y));
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

function validateArrows(puzzle: Puzzle, fail: () => never): void {
  const occupied = new Set<string>(), ids = new Set<number>();
  for (const arrow of puzzle.arrows) {
    if (!Number.isInteger(arrow.id) || ids.has(arrow.id) || !Object.hasOwn(VECTORS, arrow.direction) || !Number.isInteger(arrow.length) || arrow.length < 1 || arrow.length > puzzle.size) fail();
    ids.add(arrow.id);
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
