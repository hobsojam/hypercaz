// Squad's mute and pause buttons are the shared engine ones; muting is also
// saved with the player's progress.
import { takeClick as takeEngineClick } from '../../engine/controls.ts';
import type { Game } from './game.ts';
import { saveProgress } from './progress.ts';

export { drawMuteButton, drawPauseButton, hitRect, MUTE_BUTTON, PAUSE_BUTTON, type Rect } from '../../engine/controls.ts';

export function takeClick(game: Game): { x: number; y: number } | null {
  return takeEngineClick(game, (muted) => {
    game.progress = { ...game.progress, muted };
    saveProgress(game.storage, game.progress);
  });
}
