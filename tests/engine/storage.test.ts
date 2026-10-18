import { expect, test } from 'vitest';
import { type Backend, createStorage } from '../../engine/storage.ts';

function memoryBackend(init: Record<string, string> = {}): Backend {
  const data = { ...init };
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

test('round-trips values under a namespace', () => {
  const backend = memoryBackend();
  const s = createStorage('ns', backend);
  s.set('a', { n: 1 });
  expect(s.get('a', null)).toEqual({ n: 1 });
  expect(backend.getItem('ns.a')).toBe('{"n":1}');
});

test('a throwing backend falls back without crashing', () => {
  const throwing: Backend = {
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('denied');
    },
  };
  const s = createStorage('ns', throwing);
  expect(s.get('a', 7)).toBe(7);
  expect(() => s.set('a', 1)).not.toThrow();
  expect(s.get('a', 7)).toBe(1);
});

test('corrupt JSON returns the fallback', () => {
  const s = createStorage('ns', memoryBackend({ 'ns.a': '{bad json' }));
  expect(s.get('a', 'fallback')).toBe('fallback');
});

test('a null backend works in memory', () => {
  const s = createStorage('ns', null);
  s.set('a', 2);
  expect(s.get('a', 0)).toBe(2);
});
