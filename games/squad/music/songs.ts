// Every song in the game, by name. Order matters: the worker renders them in
// this order, so gameplay (needed first) is never kept waiting.
import type { Song } from '../../../engine/music.ts';
import { BOSS_SONG } from './boss.ts';
import { GAMEPLAY_SONG } from './gameplay.ts';
import { MENU_SONG } from './menu.ts';

export const SONGS = {
  gameplay: GAMEPLAY_SONG,
  menu: MENU_SONG,
  boss: BOSS_SONG,
} satisfies Record<string, Song>;

export type SongName = keyof typeof SONGS;
