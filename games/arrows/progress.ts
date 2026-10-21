import type { createStorage } from '../../engine/storage.ts';
import { PUZZLES } from './levels.ts';

export const ARROWS_STORAGE = 'hypercaz.arrows';
export interface Progress { readonly completed: readonly number[]; readonly muted: boolean }
export function loadProgress(storage: ReturnType<typeof createStorage>): Progress {
  const raw = storage.get<unknown>('progress', null);
  if (!raw || typeof raw !== 'object') return { completed: [], muted: false };
  const data = raw as Record<string, unknown>;
  const ids = Array.isArray(data.completed) ? data.completed : [];
  return { completed: PUZZLES.filter(p => ids.includes(p.id)).map(p => p.id), muted: data.muted === true };
}
