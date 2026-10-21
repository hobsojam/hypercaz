// Water Sort's mute, pause and "All games" buttons are the shared engine ones,
// laid out for the window's width; muting is saved in its storage.
import { takeClick as takeEngineClick } from '../../engine/controls.ts';
import type { SortGame } from './game.ts';

export { controlRects, drawAllGamesButton, drawMuteButton, drawPauseButton, hitAllGames, hitRect, type Rect } from '../../engine/controls.ts';

export function takeClick(game: SortGame): { x: number; y: number } | null {
  return takeEngineClick(game, (muted) => game.storage.set('muted', muted), game.view.w);
}
