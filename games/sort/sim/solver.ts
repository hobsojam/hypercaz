import { isDone, isWon, pour, topRun, type Board, type Tube } from './board.ts';

export type Move = { from: number; to: number };

// Same board whatever order identical tubes sit in.
function key(board: Board): string {
  return board.tubes
    .map((t) => t.join(','))
    .sort((a, b) => a.localeCompare(b))
    .join('|');
}

interface Candidate {
  move: Move;
  next: Board;
  score: number;
}

// Moving a whole one-colour tube into an empty tube gains nothing.
function pointless(src: Tube, dest: Tube): boolean {
  const run = topRun(src);
  return dest.length === 0 && run?.count === src.length;
}

// Completing a tube first, then moves that empty the source.
function scoreOf(next: Board, from: number, to: number): number {
  return (isDone(next.tubes[to]) ? 2 : 0) + (next.tubes[from].length === 0 ? 1 : 0);
}

function candidatesFor(b: Board, to: number): Candidate[] {
  const out: Candidate[] = [];
  const dest = b.tubes[to];
  b.tubes.forEach((src, from) => {
    if (from === to || src.length === 0 || isDone(src) || pointless(src, dest)) return;
    const r = pour(b, from, to);
    if (r) out.push({ move: { from, to }, next: r.board, score: scoreOf(r.board, from, to) });
  });
  return out;
}

// Every legal pour, best first. Empty tubes are interchangeable, so only the
// first one is tried as a destination.
function candidates(b: Board): Candidate[] {
  const firstEmpty = b.tubes.findIndex((t) => t.length === 0);
  const all: Candidate[] = [];
  for (let to = 0; to < b.tubes.length; to++) {
    if (b.tubes[to].length === 0 && to !== firstEmpty) continue;
    all.push(...candidatesFor(b, to));
  }
  return all.sort((x, y) => y.score - x.score);
}

// Depth-first search. Returns a winning move list, or null if none was found
// within maxNodes expanded boards (so null means "not found", not "impossible").
export function solve(board: Board, maxNodes = 200_000): Move[] | null {
  const seen = new Set<string>();
  let nodes = 0;
  const path: Move[] = [];

  function search(b: Board): boolean {
    if (isWon(b)) return true;
    if (++nodes > maxNodes) return false;
    for (const c of candidates(b)) {
      const k = key(c.next);
      if (seen.has(k)) continue;
      seen.add(k);
      path.push(c.move);
      if (search(c.next)) return true;
      path.pop();
      if (nodes > maxNodes) return false;
    }
    return false;
  }

  seen.add(key(board));
  return search(board) ? path : null;
}
