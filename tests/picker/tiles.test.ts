import { describe, expect, it } from 'vitest';
import { createStorage } from '../../engine/storage.ts';
import { saveProgress } from '../../games/squad/progress.ts';
import { STACK_STORAGE, ARROWS_STORAGE, MERGE_STORAGE, CAR_STORAGE, arrowsTile, mergeTile, carTile, sortTile, squadTile, stackTile } from '../../games/picker/tiles.ts';

function memoryBackend() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe('tiles', () => {
  it('read "New" from empty storage', () => {
    const backend = memoryBackend();
    expect(squadTile(createStorage('hypercaz.squad', backend))).toEqual({ name: 'Squad Shooter', href: 'squad/', progress: 'New' });
    expect(stackTile(createStorage(STACK_STORAGE, backend))).toEqual({ name: 'Stack', href: 'stack/', progress: 'New' });
  });

  it('show Squad\'s next level and star total', () => {
    const storage = createStorage('hypercaz.squad', memoryBackend());
    saveProgress(storage, { best: { 1: 3, 2: 2, 3: 1, 4: 1, 5: 2 }, muted: false });
    expect(squadTile(storage).progress).toBe('Level 6 · 9★');
  });

  it('say Complete once every level is beaten', () => {
    const storage = createStorage('hypercaz.squad', memoryBackend());
    saveProgress(storage, { best: { 1: 3, 2: 3 }, muted: false });
    expect(squadTile(storage, 2).progress).toBe('Complete · 6★');
  });

  it('show the Stack best', () => {
    const storage = createStorage(STACK_STORAGE, memoryBackend());
    storage.set('best', 47);
    expect(STACK_STORAGE).toBe('hypercaz.stack');
    expect(stackTile(storage).progress).toBe('Best: 47 floors');
  });

  it('ignore a junk Stack best', () => {
    const storage = createStorage(STACK_STORAGE, memoryBackend());
    storage.set('best', 'lots');
    expect(stackTile(storage).progress).toBe('New');
  });
});


describe('Arrow Escape tile', () => {
  it('links to the game with New for empty progress', () => {
    expect(arrowsTile(createStorage(ARROWS_STORAGE, memoryBackend()))).toEqual({ name: 'Arrow Escape', href: 'arrows/', progress: 'New' });
  });
  it('counts only known completed puzzles, once each', () => {
    const storage = createStorage(ARROWS_STORAGE, memoryBackend());
    storage.set('progress', { completed: [1, 3, 3, 99, '4'], muted: true });
    expect(arrowsTile(storage).progress).toBe('2/12 cleared');
  });
  it('marks all twelve puzzles complete and tolerates malformed progress', () => {
    const storage = createStorage(ARROWS_STORAGE, memoryBackend());
    storage.set('progress', { completed: Array.from({ length: 12 }, (_, i) => i + 1) });
    expect(arrowsTile(storage).progress).toBe('Complete · 12/12');
    storage.set('progress', { completed: 'all' });
    expect(arrowsTile(storage).progress).toBe('New');
  });
});

describe('sortTile', () => {
  it('reads "New" on empty storage', () => {
    expect(sortTile(createStorage('hypercaz.sort', memoryBackend()))).toEqual({ name: 'Water Sort', href: 'sort/', progress: 'New' });
  });

  it('shows the saved level', () => {
    const storage = createStorage('hypercaz.sort', memoryBackend());
    storage.set('level', 12);
    expect(sortTile(storage).progress).toBe('Level 12');
  });

  it('ignores a saved level that is not a sane number', () => {
    const storage = createStorage('hypercaz.sort', memoryBackend());
    storage.set('level', 'x');
    expect(sortTile(storage).progress).toBe('New');
  });
});

describe('mergeTile', () => {
  it('reads "New" from empty storage', () => {
    expect(mergeTile(createStorage(MERGE_STORAGE, memoryBackend()))).toEqual({ name: 'Snowman Merge', href: 'merge/', progress: 'New' });
  });

  it('shows the best score', () => {
    const storage = createStorage(MERGE_STORAGE, memoryBackend());
    storage.set('best', 1234);
    expect(MERGE_STORAGE).toBe('hypercaz.merge');
    expect(mergeTile(storage).progress).toBe('Best: 1234');
  });

  it('ignores a junk best', () => {
    const storage = createStorage(MERGE_STORAGE, memoryBackend());
    storage.set('best', 'x');
    expect(mergeTile(storage).progress).toBe('New');
  });
});

describe('Car Park tile', () => {
  it('shows new and completed progress from its own storage', () => {
    const storage = createStorage(CAR_STORAGE, memoryBackend());
    expect(carTile(storage)).toEqual({ name: 'Car Park', href: 'car/', progress: 'New' });
    storage.set('progress', { completed: [1, 2, 2, 99] });
    expect(carTile(storage).progress).toBe('2/6 cleared');
    storage.set('progress', { completed: [1, 2, 3, 4, 5, 6] });
    expect(carTile(storage).progress).toBe('Complete · 6/6');
  });
});
