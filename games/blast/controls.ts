// Crate Blast's mute and pause buttons are the shared engine ones; muting is
// saved in its storage.
import { takeClick as takeEngineClick } from '../../engine/controls.ts';
import type { BlastGame } from './game.ts';

export { ALL_GAMES_BUTTON, drawAllGamesButton, drawGameOver, drawMuteButton, drawPauseButton, gameOverAction, hitRect, MUTE_BUTTON, OVER_DELAY, PAUSE_BUTTON, type Rect } from '../../engine/controls.ts';

export function takeClick(game: BlastGame): { x: number; y: number } | null {
  return takeEngineClick(game, (muted) => game.storage.set('muted', muted));
}
