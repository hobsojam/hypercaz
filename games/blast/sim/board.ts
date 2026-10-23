// The 8x8 loading bay. A cell is 0 when empty, otherwise the PIECES index + 1
// of the piece that filled it, so the renderer knows its colour.
import { type Piece, PIECES } from './pieces.ts';

export const SIZE = 8;
export type Board = Uint8Array;

export interface Placement {
  board: Board; // after clearing
  rows: number[]; // the full rows that cleared
  cols: number[]; // the full columns that cleared
  cleared: { col: number; row: number; value: number }[]; // each cleared cell once, with its value before clearing
}

export function emptyBoard(): Board {
  return new Uint8Array(SIZE * SIZE);
}

export function fits(board: Board, piece: Piece, col: number, row: number): boolean {
  if (col < 0 || row < 0 || col + piece.w > SIZE || row + piece.h > SIZE) return false;
  return piece.cells.every(([c, r]) => board[(row + r) * SIZE + col + c] === 0);
}

export function canPlaceAnywhere(board: Board, piece: Piece): boolean {
  for (let row = 0; row + piece.h <= SIZE; row++) {
    for (let col = 0; col + piece.w <= SIZE; col++) if (fits(board, piece, col, row)) return true;
  }
  return false;
}

export function isEmpty(board: Board): boolean {
  return board.every((v) => v === 0);
}

function fullLines(board: Board): { rows: number[]; cols: number[] } {
  const rows: number[] = [];
  const cols: number[] = [];
  for (let i = 0; i < SIZE; i++) {
    let rowFull = true;
    let colFull = true;
    for (let j = 0; j < SIZE; j++) {
      if (board[i * SIZE + j] === 0) rowFull = false;
      if (board[j * SIZE + i] === 0) colFull = false;
    }
    if (rowFull) rows.push(i);
    if (colFull) cols.push(i);
  }
  return { rows, cols };
}

// Drops the piece with its top-left at (col, row) and clears every full line.
// The caller checks `fits` first. The input board is left alone.
export function place(board: Board, piece: Piece, col: number, row: number): Placement {
  const next = board.slice();
  const value = PIECES.indexOf(piece) + 1;
  for (const [c, r] of piece.cells) next[(row + r) * SIZE + col + c] = value;
  const { rows, cols } = fullLines(next);
  const cleared: Placement['cleared'] = [];
  for (let i = 0; i < next.length; i++) {
    const r = Math.floor(i / SIZE);
    const c = i % SIZE;
    if (rows.includes(r) || cols.includes(c)) cleared.push({ col: c, row: r, value: next[i]! });
  }
  for (const { col: c, row: r } of cleared) next[r * SIZE + c] = 0;
  return { board: next, rows, cols, cleared };
}
