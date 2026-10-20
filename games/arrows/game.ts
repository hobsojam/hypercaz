import type { GameAudio } from '../../engine/audio.ts';
import type { Input } from '../../engine/input.ts';
import type { SceneStack } from '../../engine/scenes.ts';
import type { createStorage } from '../../engine/storage.ts';

export const WIDTH = 540;
export const HEIGHT = 960;
export interface ArrowGame {
  readonly stack: SceneStack;
  readonly audio: GameAudio;
  readonly input: Input;
  readonly storage: ReturnType<typeof createStorage>;
  readonly announce: (message: string) => void;
}
