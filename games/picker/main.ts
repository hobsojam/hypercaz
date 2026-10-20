import { createStorage } from '../../engine/storage.ts';
import { levels } from '../squad/levels/index.ts';
import { SQUAD_STORAGE, STACK_STORAGE, squadTile, stackTile } from './tiles.ts';

const tiles = [squadTile(createStorage(SQUAD_STORAGE), levels.length), stackTile(createStorage(STACK_STORAGE))];
for (const tile of tiles) {
  const link = document.querySelector<HTMLAnchorElement>(`a[href="${tile.href}"]`);
  const progress = link?.querySelector('.progress');
  if (progress) progress.textContent = tile.progress;
}
