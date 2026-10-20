// Stack's mute and pause buttons are the shared engine ones; muting is saved
// in its storage.
import { takeClick as takeEngineClick } from '../../engine/controls.ts';
import type { StackGame } from './game.ts';

export { ALL_GAMES_BUTTON, drawAllGamesButton, drawMuteButton, drawPauseButton, hitRect, MUTE_BUTTON, PAUSE_BUTTON, type Rect } from '../../engine/controls.ts';

export function takeClick(game: StackGame): { x: number; y: number } | null {
  return takeEngineClick(game, (muted) => game.storage.set('muted', muted));
}
