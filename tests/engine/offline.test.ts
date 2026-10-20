import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { registerWorker } from '../../engine/offline.ts';

const SITE = 'https://example.github.io/hypercaz/';

// Where each page registers the worker from, and the page's own address.
const pages = [
  { main: 'games/picker/main.ts', page: SITE, url: './sw.js' },
  { main: 'games/squad/main.ts', page: `${SITE}squad/`, url: '../sw.js', boot: true },
  { main: 'games/stack/main.ts', page: `${SITE}stack/`, url: '../sw.js', boot: true },
];

test('registerWorker registers the given url', async () => {
  const register = vi.fn().mockResolvedValue({});
  await registerWorker('../sw.js', { register } as unknown as ServiceWorkerContainer);
  expect(register).toHaveBeenCalledWith('../sw.js');
});

test('registerWorker swallows a failed registration', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const register = vi.fn().mockRejectedValue(new Error('nope'));
  await expect(registerWorker('./sw.js', { register } as unknown as ServiceWorkerContainer)).resolves.toBeUndefined();
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
});

test('registerWorker does nothing without service worker support', async () => {
  await expect(registerWorker('./sw.js', undefined)).resolves.toBeUndefined();
});

test.each(pages)('$main registers the root sw.js', ({ main, page, url, boot }) => {
  const source = readFileSync(main, 'utf8');
  if (boot) {
    // The games start through the shared boot, which registers the worker.
    expect(source).toContain(`workerUrl: '${url}'`);
    const shared = readFileSync('engine/boot.ts', 'utf8');
    expect(shared).toContain('registerWorker(opts.workerUrl)');
    expect(shared).toContain('import.meta.env.PROD');
  } else {
    expect(source).toContain(`registerWorker('${url}')`);
    expect(source).toContain('import.meta.env.PROD');
  }
  expect(new URL(url, page).href).toBe(`${SITE}sw.js`);
});
