import { type Board, emptyBoard, SIZE } from '../../games/blast/sim/board.ts';

// A board from an ASCII picture: one string per row, '#' is a crate, '.' is
// empty. Missing rows and columns are empty.
export function boardFrom(rows: string[]): Board {
  const b = emptyBoard();
  rows.forEach((line, row) => {
    for (let col = 0; col < SIZE; col++) if (line[col] === '#') b[row * SIZE + col] = 1;
  });
  return b;
}

// A board with every cell filled except the listed [col, row] cells.
export function fullExcept(holes: [number, number][]): Board {
  const b = emptyBoard().fill(1);
  for (const [col, row] of holes) b[row * SIZE + col] = 0;
  return b;
}
