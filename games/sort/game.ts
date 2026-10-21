// Shared services handed to every scene. The picker reads SORT_STORAGE and
// loadLevel from here, so this file must not import scene or render code.
import type { GameAudio } from '../../engine/audio.ts';
import type { Input } from '../../engine/input.ts';
import type { SceneStack } from '../../engine/scenes.ts';
import type { createStorage } from '../../engine/storage.ts';

export const SORT_STORAGE = 'hypercaz.sort';

export interface SortGame {
  stack: SceneStack;
  input: Input;
  audio: GameAudio;
  storage: ReturnType<typeof createStorage>;
  // The window's size in CSS px; the boot keeps it current.
  view: { w: number; h: number };
  // Whether each colour also shows its symbol (for colour-blind players).
  symbols: boolean;
}

// The next level to play: the saved one, or 1 when there is none or it is not
// a sane number.
export function loadLevel(storage: SortGame['storage']): number {
  const level = storage.get<unknown>('level', 1);
  return typeof level === 'number' && Number.isFinite(level) && level >= 1 ? Math.floor(level) : 1;
}
