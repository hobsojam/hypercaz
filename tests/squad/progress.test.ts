import { describe, expect, it } from 'vitest';
import { createStorage } from '../../engine/storage.ts';
import { isUnlocked, loadProgress, recordResult, sanitizeProgress, saveProgress } from '../../games/squad/progress.ts';

const DEFAULTS = { best: {}, muted: false };

describe('sanitizeProgress', () => {
  it.each([null, 'x', 42, { best: 5 }, { best: [] }])('falls back to defaults for %j', (raw) => {
    expect(sanitizeProgress(raw)).toEqual(DEFAULTS);
  });

  it('drops invalid entries and keeps valid ones', () => {
    expect(sanitizeProgress({ best: { '1': 9, x: 2, '2': 2, '3': 1.5 } })).toEqual({ best: { 2: 2 }, muted: false });
  });

  it('round-trips valid progress', () => {
    expect(sanitizeProgress({ best: { '1': 2 }, muted: true })).toEqual({ best: { 1: 2 }, muted: true });
  });
});

describe('progress', () => {
  it('loads defaults from corrupt storage', () => {
    const storage = createStorage('t', { getItem: () => '{bad', setItem: () => {} });
    expect(loadProgress(storage)).toEqual(DEFAULTS);
  });

  it('saves and loads', () => {
    const storage = createStorage('t', null);
    saveProgress(storage, { best: { 1: 3 }, muted: true });
    expect(loadProgress(storage)).toEqual({ best: { 1: 3 }, muted: true });
  });

  it('keeps the best result', () => {
    const p = recordResult(recordResult(DEFAULTS, 1, 3), 1, 1);
    expect(p.best[1]).toBe(3);
  });

  it('unlocks levels one after another', () => {
    expect(isUnlocked(DEFAULTS, 1)).toBe(true);
    expect(isUnlocked(DEFAULTS, 2)).toBe(false);
    expect(isUnlocked(recordResult(DEFAULTS, 1, 0), 2)).toBe(false);
    expect(isUnlocked(recordResult(DEFAULTS, 1, 1), 2)).toBe(true);
  });
});
