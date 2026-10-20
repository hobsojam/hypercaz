import { defineConfig } from 'vitest/config';
import { buildStamp, pwa } from './scripts/pwa.ts';

// CI names the commit it builds; a local build says "dev".
const build = buildStamp(new Date(), process.env.GITHUB_SHA ?? null);

export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(build) },
  plugins: [pwa(build)],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
