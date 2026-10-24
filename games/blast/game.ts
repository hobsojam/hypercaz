// Shared services handed to every scene. The picker imports this file, so it
// must not pull in scene or render code.
import type { GameAudio } from '../../engine/audio.ts';
import type { Input } from '../../engine/input.ts';
import type { SceneStack } from '../../engine/scenes.ts';
import type { createStorage } from '../../engine/storage.ts';

export const BLAST_STORAGE = 'hypercaz.blast';
export const WIDTH = 540;
export const HEIGHT = 960;

export interface BlastGame {
  stack: SceneStack;
  input: Input;
  audio: GameAudio;
  storage: ReturnType<typeof createStorage>;
  // Seconds the game has been running.
  time: number;
}

export { loadBest } from '../../engine/storage.ts';
