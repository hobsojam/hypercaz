import type { Rect } from '../../engine/controls.ts';
import { PUZZLES } from './levels.ts';
import type { Session } from './session.ts';
import { occupied, type State } from './sim.ts';

export const BOARD = { x: 45, y: 250, cell: 72, size: 6 } as const;
export interface Button extends Readonly<Rect> { readonly id: string; readonly label: string; readonly enabled: boolean }
export function cellAt(point: { x: number; y: number }): { x: number; y: number } | null {
  const x = Math.floor((point.x - BOARD.x) / BOARD.cell), y = Math.floor((point.y - BOARD.y) / BOARD.cell);
  return x >= 0 && x < BOARD.size && y >= 0 && y < BOARD.size ? { x, y } : null;
}
export function carAt(state: State, cell: { x: number; y: number }): number {
  return state.puzzle.cars.findIndex((car, i) => occupied(car, state.positions[i], cell.x, cell.y));
}
export function buttonsFor(s: Session): readonly Button[] {
  if (s.paused) return [{ id: 'resume', label: 'Resume', enabled: true, x: 150, y: 550, w: 240, h: 64 }];
  if (s.screen === 'levels') return [
    ...PUZZLES.map((p, i) => ({ id: `puzzle:${i}`, label: p.name, enabled: true, x: 35 + i % 2 * 245, y: 245 + Math.floor(i / 2) * 140, w: 225, h: 112 })),
    { id: 'back', label: 'Back to puzzle', enabled: true, x: 150, y: 822, w: 240, h: 64 },
  ];
  const buttons: Button[] = [
    { id: 'levels', label: 'Puzzles', enabled: true, x: 20, y: 822, w: 115, h: 64 },
    { id: 'hint', label: 'Hint', enabled: s.screen === 'play', x: 148, y: 822, w: 115, h: 64 },
    { id: 'undo', label: 'Undo', enabled: s.history.length > 0, x: 277, y: 822, w: 115, h: 64 },
    { id: 'reset', label: 'Reset', enabled: true, x: 405, y: 822, w: 115, h: 64 },
  ];
  if (s.screen === 'won') buttons.push({ id: 'next', label: s.index < PUZZLES.length - 1 ? 'Next puzzle' : 'All puzzles', enabled: true, x: 150, y: 755, w: 240, h: 58 });
  return buttons;
}
