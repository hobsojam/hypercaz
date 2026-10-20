// Water Sort rules: tubes hold colour indices from the bottom up, and a pour
// moves the top run of one colour onto the same colour or into an empty tube.

export const CAPACITY = 4;

export type Tube = readonly number[];

export interface Board {
  readonly tubes: readonly Tube[];
}

export function topRun(tube: Tube): { color: number; count: number } | null {
  if (tube.length === 0) return null;
  const color = tube.at(-1)!;
  let count = 1;
  while (count < tube.length && tube[tube.length - 1 - count] === color) count++;
  return { color, count };
}

export function pour(board: Board, from: number, to: number): { board: Board; moved: number } | null {
  const { tubes } = board;
  if (from === to || !tubes[from] || !tubes[to]) return null;
  const run = topRun(tubes[from]);
  if (!run) return null;
  const dest = tubes[to];
  const destTop = dest.at(-1);
  if (dest.length > 0 && destTop !== run.color) return null;
  const moved = Math.min(run.count, CAPACITY - dest.length);
  if (moved <= 0) return null;
  const next = tubes.map((t, i) => {
    if (i === from) return t.slice(0, t.length - moved);
    if (i === to) return [...t, ...new Array<number>(moved).fill(run.color)];
    return t;
  });
  return { board: { tubes: next }, moved };
}

export function isDone(tube: Tube): boolean {
  return tube.length === CAPACITY && tube.every((c) => c === tube[0]);
}

export function isWon(board: Board): boolean {
  return board.tubes.every((t) => t.length === 0 || isDone(t));
}

// Any legal pour counts, even a pointless one like a full tube into an empty one.
export function hasLegalMove(board: Board): boolean {
  const n = board.tubes.length;
  for (let from = 0; from < n; from++) {
    for (let to = 0; to < n; to++) if (pour(board, from, to)) return true;
  }
  return false;
}

export function colorCounts(board: Board): Map<number, number> {
  const counts = new Map<number, number>();
  for (const tube of board.tubes) for (const c of tube) counts.set(c, (counts.get(c) ?? 0) + 1);
  return counts;
}
