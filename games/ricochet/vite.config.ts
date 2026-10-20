import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// An independent build until the shared game picker owns the entry points.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  publicDir: false,
  build: { outDir: 'dist' },
});
