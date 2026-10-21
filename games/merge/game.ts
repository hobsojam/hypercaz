// Shared services handed to every scene. The picker imports this file, so it
// must not pull in scene or render code.
import type { GameAudio } from '../../engine/audio.ts';
import type { Input } from '../../engine/input.ts';
import type { SceneStack } from '../../engine/scenes.ts';
import type { createStorage } from '../../engine/storage.ts';

export const MERGE_STORAGE = 'hypercaz.merge';

export interface MergeGame {
  stack: SceneStack;
  input: Input;
  audio: GameAudio;
  storage: ReturnType<typeof createStorage>;
  // Seconds the game has been running, for the falling snow behind the crate.
  time: number;
}

// The saved best, or 0 when there is none or it is not a sane number.
export function loadBest(storage: MergeGame['storage']): number {
  const best = storage.get<unknown>('best', 0);
  return typeof best === 'number' && Number.isFinite(best) && best > 0 ? Math.floor(best) : 0;
}
