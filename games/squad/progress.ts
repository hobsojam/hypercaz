import type { createStorage } from '../../engine/storage.ts';

export type Stars = 0 | 1 | 2 | 3;

export interface Progress {
  best: Record<number, Stars>;
  muted: boolean;
}

type Storage = ReturnType<typeof createStorage>;

const KEY = 'progress';

export function sanitizeProgress(raw: unknown): Progress {
  const out: Progress = { best: {}, muted: false };
  if (typeof raw !== 'object' || raw === null) return out;
  const r = raw as Record<string, unknown>;
  out.muted = r.muted === true;
  const best = r.best;
  if (typeof best !== 'object' || best === null || Array.isArray(best)) return { best: {}, muted: false };
  for (const [k, v] of Object.entries(best)) {
    const id = Number(k);
    if (Number.isInteger(id) && id >= 1 && (v === 0 || v === 1 || v === 2 || v === 3)) out.best[id] = v;
  }
  return out;
}

export function recordResult(p: Progress, levelId: number, stars: Stars): Progress {
  const prev = p.best[levelId] ?? 0;
  return { ...p, best: { ...p.best, [levelId]: Math.max(prev, stars) as Stars } };
}

export function isUnlocked(p: Progress, levelId: number): boolean {
  return levelId === 1 || (p.best[levelId - 1] ?? 0) >= 1;
}

export function loadProgress(storage: Storage): Progress {
  return sanitizeProgress(storage.get<unknown>(KEY, null));
}

export function saveProgress(storage: Storage, p: Progress): void {
  storage.set(KEY, p);
}
