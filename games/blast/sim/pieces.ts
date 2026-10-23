// The crate pieces: fixed shapes in fixed orientations, grouped by how hard
// they are to fit. The dealer weights the groups; within a group every piece
// is equally likely.

export type Group = 'friendly' | 'medium' | 'awkward';

export interface Piece {
  id: string;
  cells: readonly (readonly [col: number, row: number])[]; // normalised: min col and row are 0
  w: number;
  h: number;
  group: Group;
  color: string;
}

// One colour per shape family, so a hand is easy to read.
const SINGLE = '#E04040';
const BAR = '#2F7DE1';
const SQUARE = '#4CAF50';
const SMALL_L = '#F5C242';
const BIG_L = '#FF8A1F';
const T = '#8E5BD6';
const S = '#1FB5A8';
const Z = '#E0569B';

// A shape from a picture: one string per row, '#' is a crate.
function shape(id: string, group: Group, color: string, ...rows: string[]): Piece {
  const cells: [number, number][] = [];
  rows.forEach((line, row) => {
    [...line].forEach((ch, col) => {
      if (ch === '#') cells.push([col, row]);
    });
  });
  const w = Math.max(...cells.map(([c]) => c)) + 1;
  return { id, cells, w, h: rows.length, group, color };
}

export const PIECES: readonly Piece[] = [
  shape('1x1', 'friendly', SINGLE, '#'),
  shape('h2', 'friendly', BAR, '##'),
  shape('v2', 'friendly', BAR, '#', '#'),
  shape('h3', 'friendly', BAR, '###'),
  shape('v3', 'friendly', BAR, '#', '#', '#'),
  shape('sq2', 'friendly', SQUARE, '##', '##'),
  shape('l3a', 'friendly', SMALL_L, '#.', '##'),
  shape('l3b', 'friendly', SMALL_L, '##', '#.'),
  shape('l3c', 'friendly', SMALL_L, '##', '.#'),
  shape('l3d', 'friendly', SMALL_L, '.#', '##'),

  shape('h4', 'medium', BAR, '####'),
  shape('v4', 'medium', BAR, '#', '#', '#', '#'),
  shape('ta', 'medium', T, '###', '.#.'),
  shape('tb', 'medium', T, '.#.', '###'),
  shape('tc', 'medium', T, '#.', '##', '#.'),
  shape('td', 'medium', T, '.#', '##', '.#'),
  shape('sh', 'medium', S, '.##', '##.'),
  shape('sv', 'medium', S, '#.', '##', '.#'),
  shape('zh', 'medium', Z, '##.', '.##'),
  shape('zv', 'medium', Z, '.#', '##', '#.'),

  shape('h5', 'awkward', BAR, '#####'),
  shape('v5', 'awkward', BAR, '#', '#', '#', '#', '#'),
  shape('sq3', 'awkward', SQUARE, '###', '###', '###'),
  shape('l5a', 'awkward', BIG_L, '#..', '#..', '###'),
  shape('l5b', 'awkward', BIG_L, '###', '#..', '#..'),
  shape('l5c', 'awkward', BIG_L, '###', '..#', '..#'),
  shape('l5d', 'awkward', BIG_L, '..#', '..#', '###'),
];

const BY_ID = new Map(PIECES.map((p) => [p.id, p]));

export function pieceById(id: string): Piece {
  const p = BY_ID.get(id);
  if (!p) throw new Error(`Unknown piece: ${id}`);
  return p;
}
