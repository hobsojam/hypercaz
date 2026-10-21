// What each game's tile on the picker says, read from that game's own saved progress.
import type { createStorage } from '../../engine/storage.ts';
import { loadBest } from '../merge/game.ts';
import { loadLevel } from '../sort/game.ts';
import { loadProgress } from '../squad/progress.ts';

import { PUZZLES } from '../arrows/levels.ts';
import { PUZZLES as CAR_PUZZLES } from '../car/levels.ts';
import { loadProgress as loadCarProgress } from '../car/progress.ts';
export { CAR_STORAGE } from '../car/progress.ts';
import { loadProgress as loadArrowsProgress } from '../arrows/progress.ts';
export { ARROWS_STORAGE } from '../arrows/progress.ts';

type Storage = ReturnType<typeof createStorage>;

export interface Tile {
  name: string;
  href: string;
  progress: string;
}

export const SQUAD_STORAGE = 'hypercaz.squad';
export const STACK_STORAGE = 'hypercaz.stack';
export { SORT_STORAGE } from '../sort/game.ts';
export { MERGE_STORAGE } from '../merge/game.ts';

export function squadTile(storage: Storage, levelCount = Infinity): Tile & { name: 'Squad Shooter'; href: 'squad/' } {
  const { best } = loadProgress(storage);
  const stars = Object.values(best).reduce<number>((sum, s) => sum + s, 0);
  let next = 1;
  while ((best[next] ?? 0) >= 1) next++;
  let progress = 'New';
  if (Object.keys(best).length > 0) progress = next > levelCount ? `Complete · ${stars}★` : `Level ${next} · ${stars}★`;
  return { name: 'Squad Shooter', href: 'squad/', progress };
}

export function stackTile(storage: Storage): Tile & { name: 'Stack'; href: 'stack/' } {
  const best = storage.get<unknown>('best', null);
  const progress = typeof best === 'number' && Number.isFinite(best) && best > 0 ? `Best: ${Math.floor(best)} floors` : 'New';
  return { name: 'Stack', href: 'stack/', progress };
}

export function arrowsTile(storage: Storage): Tile & { name: 'Arrow Escape'; href: 'arrows/' } {
  const count = loadArrowsProgress(storage).completed.length;
  let progress = 'New';
  if (count > 0) progress = count === PUZZLES.length ? `Complete · ${count}/${PUZZLES.length}` : `${count}/${PUZZLES.length} cleared`;
  return { name: 'Arrow Escape', href: 'arrows/', progress };
}

export function sortTile(storage: Storage): Tile & { name: 'Water Sort'; href: 'sort/' } {
  const saved = storage.get<unknown>('level', null);
  const valid = typeof saved === 'number' && Number.isFinite(saved) && saved >= 1;
  return { name: 'Water Sort', href: 'sort/', progress: valid ? `Level ${loadLevel(storage)}` : 'New' };
}

export function mergeTile(storage: Storage): Tile & { name: 'Snowman Merge'; href: 'merge/' } {
  const best = loadBest(storage);
  return { name: 'Snowman Merge', href: 'merge/', progress: best > 0 ? `Best: ${best}` : 'New' };
}

export function carTile(storage: Storage): Tile & { name: 'Car Park'; href: 'car/' } {
  const count = loadCarProgress(storage).completed.length;
  const progress = count === 0 ? 'New' : count === CAR_PUZZLES.length ? `Complete · ${count}/${CAR_PUZZLES.length}` : `${count}/${CAR_PUZZLES.length} cleared`;
  return { name: 'Car Park', href: 'car/', progress };
}
