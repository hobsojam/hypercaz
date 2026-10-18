// Namespaced JSON storage that never throws. Falls back to memory when
// localStorage is missing, blocked, or full.

export interface Backend {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

function defaultBackend(): Backend | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function createStorage(ns: string, backend: Backend | null = defaultBackend()) {
  const memory = new Map<string, string>();
  const key = (k: string) => `${ns}.${k}`;
  const read = (k: string): string | null => {
    if (memory.has(k)) return memory.get(k)!;
    try {
      return backend ? backend.getItem(k) : null;
    } catch {
      return null;
    }
  };
  return {
    get<T>(k: string, fallback: T): T {
      const raw = read(key(k));
      if (raw === null) return fallback;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    },
    set(k: string, value: unknown): void {
      const raw = JSON.stringify(value);
      try {
        if (!backend) throw new Error('no backend');
        backend.setItem(key(k), raw);
        memory.delete(key(k));
      } catch {
        memory.set(key(k), raw);
      }
    },
  };
}
