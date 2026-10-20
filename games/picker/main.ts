import { registerWorker } from '../../engine/offline.ts';
import { createStorage } from '../../engine/storage.ts';
import { levels } from '../squad/levels/index.ts';
import { SQUAD_STORAGE, SORT_STORAGE, STACK_STORAGE, sortTile, squadTile, stackTile } from './tiles.ts';

const tiles = [squadTile(createStorage(SQUAD_STORAGE), levels.length), stackTile(createStorage(STACK_STORAGE)), sortTile(createStorage(SORT_STORAGE))];
for (const tile of tiles) {
  const link = document.querySelector<HTMLAnchorElement>(`a[href="${tile.href}"]`);
  const progress = link?.querySelector('.progress');
  if (progress) progress.textContent = tile.progress;
}

if (import.meta.env.PROD) await registerWorker('./sw.js');
