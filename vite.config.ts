import { defineConfig } from 'vitest/config';
import { buildStamp, currentSha, pwa } from './scripts/pwa.ts';

const build = buildStamp(new Date(), currentSha());

export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(build) },
  plugins: [pwa(build)],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
