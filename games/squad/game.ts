// Shared services handed to every scene.
import type { AssetStore } from '../../engine/assets.ts';
import type { GameAudio } from '../../engine/audio.ts';
import type { Input } from '../../engine/input.ts';
import type { SceneStack } from '../../engine/scenes.ts';
import type { createStorage } from '../../engine/storage.ts';
import type { LevelEntry } from './levels/index.ts';
import type { Progress } from './progress.ts';

export const WIDTH = 540;
export const HEIGHT = 960;

export interface Game {
  stack: SceneStack;
  input: Input;
  audio: GameAudio;
  storage: ReturnType<typeof createStorage>;
  assets: AssetStore;
  levels: LevelEntry[];
  progress: Progress;
}
