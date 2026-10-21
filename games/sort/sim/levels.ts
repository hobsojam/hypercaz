import { createRng, nextFloat } from '../../../engine/rng.ts';
import { CAPACITY, isDone, type Board, type Tube } from './board.ts';
import { solve } from './solver.ts';

const MAX_COLORS = 10; // more shades get hard to tell apart (and slow to solve)
const MAX_FILLED = 26; // with 2 spares, 28 tubes: 4 rows of 7 on a desktop
const SPARES = 2;

// One more filled tube every 2 levels, up to MAX_FILLED by level 47. New
// colours come first; past MAX_COLORS, colours repeat across tubes.
export function levelSpec(n: number): { colors: number; filled: number; spares: number } {
  const filled = Math.min(MAX_FILLED, 3 + Math.floor((n - 1) / 2));
  return { colors: Math.min(MAX_COLORS, filled), filled, spares: SPARES };
}

function deal(colors: number, filled: number, rng: number): { board: Board; rng: number } {
  // Colour c fills floor(filled / colors) tubes' worth, the first few one more.
  const layers: number[] = [];
  for (let t = 0; t < filled; t++) for (let i = 0; i < CAPACITY; i++) layers.push(t % colors);
  for (let i = layers.length - 1; i > 0; i--) {
    const [v, next] = nextFloat(rng);
    rng = next;
    const j = Math.floor(v * (i + 1));
    [layers[i], layers[j]] = [layers[j], layers[i]];
  }
  const tubes: Tube[] = [];
  for (let t = 0; t < filled; t++) tubes.push(layers.slice(t * CAPACITY, (t + 1) * CAPACITY));
  for (let s = 0; s < SPARES; s++) tubes.push([]);
  return { board: { tubes }, rng };
}

const valid = (b: Board) => b.tubes.every((t) => !isDone(t) && new Set(t).size !== 1);

export function generateLevel(n: number): Board {
  const { colors, filled } = levelSpec(n);
  let rng = createRng(n);
  for (;;) {
    const d = deal(colors, filled, rng);
    rng = d.rng;
    if (valid(d.board) && solve(d.board)) return d.board;
  }
}
