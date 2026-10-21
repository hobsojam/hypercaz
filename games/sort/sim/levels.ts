import { createRng, nextFloat } from '../../../engine/rng.ts';
import { CAPACITY, isDone, type Board, type Tube } from './board.ts';
import { solve } from './solver.ts';

// A 1-spare deal must be solvable within this many nodes, so it is a puzzle to
// think through rather than one only a long search can crack. Measured over
// levels 1..500: deals the solver can finish at all finish within ~400 nodes,
// and the accepted count is identical for any budget from 400 to 60000. 1000
// keeps a margin over that plateau while a failing deal costs little.
export const COMFORT_NODES = 1000;

const MAX_COLORS = 10;
const ONE_SPARE_ATTEMPTS = 50;

export function levelSpec(n: number): { colors: number; spares: number } {
  return {
    colors: Math.min(MAX_COLORS, 3 + Math.floor((n - 1) / 5)),
    spares: n >= 60 && n % 3 === 0 ? 1 : 2,
  };
}

function deal(colors: number, spares: number, rng: number): { board: Board; rng: number } {
  const layers: number[] = [];
  for (let c = 0; c < colors; c++) for (let i = 0; i < CAPACITY; i++) layers.push(c);
  for (let i = layers.length - 1; i > 0; i--) {
    const [v, next] = nextFloat(rng);
    rng = next;
    const j = Math.floor(v * (i + 1));
    [layers[i], layers[j]] = [layers[j], layers[i]];
  }
  const tubes: Tube[] = [];
  for (let t = 0; t < colors; t++) tubes.push(layers.slice(t * CAPACITY, (t + 1) * CAPACITY));
  for (let s = 0; s < spares; s++) tubes.push([]);
  return { board: { tubes }, rng };
}

const valid = (b: Board) => b.tubes.every((t) => !isDone(t) && new Set(t).size !== 1);

export function generateLevel(n: number): Board {
  const { colors, spares } = levelSpec(n);
  let rng = createRng(n);
  if (spares === 1) {
    for (let i = 0; i < ONE_SPARE_ATTEMPTS; i++) {
      const d = deal(colors, 1, rng);
      rng = d.rng;
      if (valid(d.board) && solve(d.board, COMFORT_NODES)) return d.board;
    }
  }
  for (;;) {
    const d = deal(colors, 2, rng);
    rng = d.rng;
    if (valid(d.board) && solve(d.board)) return d.board;
  }
}
