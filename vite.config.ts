import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { buildStamp, pwa } from './scripts/pwa.ts';

// CI names the commit it builds; a local build says "dev".
const build = buildStamp(new Date(), process.env.GITHUB_SHA ?? null);

export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(build) },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        squad: resolve(import.meta.dirname, 'squad/index.html'),
        stack: resolve(import.meta.dirname, 'stack/index.html'),
        sort: resolve(import.meta.dirname, 'sort/index.html'),
      },
    },
  },
  plugins: [pwa(build)],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
