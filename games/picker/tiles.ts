// What each game's tile on the picker says, read from that game's own saved progress.
import type { createStorage } from '../../engine/storage.ts';
import { loadProgress } from '../squad/progress.ts';

type Storage = ReturnType<typeof createStorage>;

export interface Tile {
  name: string;
  href: string;
  progress: string;
}

export const SQUAD_STORAGE = 'hypercaz.squad';
export const STACK_STORAGE = 'hypercaz.stack';

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
