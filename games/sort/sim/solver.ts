import { isDone, isWon, pour, topRun, type Board } from './board.ts';

export type Move = { from: number; to: number };

// Same board whatever order identical tubes sit in.
function key(board: Board): string {
  return board.tubes
    .map((t) => t.join(','))
    .sort()
    .join('|');
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
    const { tubes } = b;
    const candidates: { move: Move; next: Board; score: number }[] = [];
    let emptyTried = false;
    for (let to = 0; to < tubes.length; to++) {
      const dest = tubes[to];
      if (dest.length === 0) {
        // Empty tubes are interchangeable, so only try the first.
        if (emptyTried) continue;
        emptyTried = true;
      }
      for (let from = 0; from < tubes.length; from++) {
        const src = tubes[from];
        if (from === to || src.length === 0 || isDone(src)) continue;
        const run = topRun(src);
        // Moving a whole one-colour tube into an empty tube gains nothing.
        if (dest.length === 0 && run && run.count === src.length) continue;
        const r = pour(b, from, to);
        if (!r) continue;
        const after = r.board.tubes[to];
        // Completing a tube first, then moves that empty the source.
        const score = (isDone(after) ? 2 : 0) + (r.board.tubes[from].length === 0 ? 1 : 0);
        candidates.push({ move: { from, to }, next: r.board, score });
      }
    }
    candidates.sort((x, y) => y.score - x.score);
    for (const c of candidates) {
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

