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

export { loadBest } from '../../engine/storage.ts';
