import type { Rect } from '../../engine/controls.ts';
import { PUZZLES } from './levels.ts';
import type { Session } from './session.ts';
import type { Cell, Puzzle } from './sim.ts';

export interface Button extends Readonly<Rect> { readonly id: string; readonly label: string; readonly enabled: boolean }
export function boardFor(puzzle: Puzzle) {
  const cell = Math.min(80, 480 / puzzle.size), w = puzzle.size * cell;
  return { x: (540 - w) / 2, y: 230 + (480 - w) / 2, w, h: w, cell };
}

export function cellAt(puzzle: Puzzle, point: Cell): Cell | null {
  const b = boardFor(puzzle), x = Math.floor((point.x - b.x) / b.cell), y = Math.floor((point.y - b.y) / b.cell);
  return x >= 0 && y >= 0 && x < puzzle.size && y < puzzle.size ? { x, y } : null;
}

export function buttonsFor(s: Session): readonly Button[] {
  if (s.paused) return [{ id: 'resume', label: 'Resume', enabled: true, x: 150, y: 550, w: 240, h: 64 }];
  if (s.screen === 'levels') return [
    ...PUZZLES.map((p, i) => ({ id: `puzzle:${i}`, label: p.name, enabled: true, x: 40 + (i % 3) * 160, y: 236 + Math.floor(i / 3) * 128, w: 140, h: 108 })),
    { id: 'back', label: 'Back to puzzle', enabled: true, x: 150, y: 822, w: 240, h: 64 },
  ];
  const buttons: Button[] = [
    { id: 'levels', label: 'Puzzles', enabled: true, x: 30, y: 822, w: 148, h: 64 },
    { id: 'hint', label: 'Hint', enabled: s.screen === 'play' && !s.flight, x: 196, y: 822, w: 148, h: 64 },
    { id: 'retry', label: 'Retry', enabled: true, x: 362, y: 822, w: 148, h: 64 },
  ];
  if (s.screen === 'won') buttons.push({ id: 'next', label: s.index < PUZZLES.length - 1 ? 'Next puzzle' : 'All puzzles', enabled: true, x: 150, y: 578, w: 240, h: 64 });
  return buttons;
}
