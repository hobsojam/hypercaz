// Shared services handed to every scene.
import type { GameAudio } from '../../engine/audio.ts';
import type { Input } from '../../engine/input.ts';
import type { SceneStack } from '../../engine/scenes.ts';
import type { createStorage } from '../../engine/storage.ts';

export const WIDTH = 540;
export const HEIGHT = 960;

export interface StackGame {
  stack: SceneStack;
  input: Input;
  audio: GameAudio;
  storage: ReturnType<typeof createStorage>;
  // How high the camera is, in floors. The boot reads it to tint the sky
  // behind the letterbox bars.
  sky: number;
}

// The saved best, or 0 when there is none or it is not a sane number.
export function loadBest(storage: StackGame['storage']): number {
  const best = storage.get<unknown>('best', 0);
  return typeof best === 'number' && Number.isFinite(best) && best > 0 ? Math.floor(best) : 0;
}
