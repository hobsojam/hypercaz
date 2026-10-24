import { registerWorker } from '../../engine/offline.ts';
import { createStorage } from '../../engine/storage.ts';
import { levels } from '../squad/levels/index.ts';
import { SQUAD_STORAGE, STACK_STORAGE, ARROWS_STORAGE, SORT_STORAGE, MERGE_STORAGE, CAR_STORAGE, BLAST_STORAGE, sortTile, mergeTile, squadTile, stackTile, arrowsTile, carTile, blastTile } from './tiles.ts';

function refreshProgress(): void {
  const tiles = [squadTile(createStorage(SQUAD_STORAGE), levels.length), stackTile(createStorage(STACK_STORAGE)), sortTile(createStorage(SORT_STORAGE)), arrowsTile(createStorage(ARROWS_STORAGE)), mergeTile(createStorage(MERGE_STORAGE)), carTile(createStorage(CAR_STORAGE)), blastTile(createStorage(BLAST_STORAGE))];
  for (const tile of tiles) {
    const link = document.querySelector<HTMLAnchorElement>(`a[href="${tile.href}"]`);
    const progress = link?.querySelector('.progress');
    if (progress) progress.textContent = tile.progress;
  }
}
refreshProgress();
window.addEventListener('pageshow', refreshProgress);

if (import.meta.env.PROD) await registerWorker('./sw.js');
