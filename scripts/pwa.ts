// Makes the build installable and playable offline: a build stamp for the
// title screen, and a service worker that caches every file of this build.
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin } from 'vite';

export function buildStamp(date: Date, sha: string | null): string {
  return `${date.toISOString().slice(0, 10)} ${sha ? sha.slice(0, 7) : 'dev'}`;
}

// The commit being built: CI names it, a local checkout asks git.
export function currentSha(): string | null {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null;
  } catch {
    return null;
  }
}

export function precacheList(built: string[], publicFiles: string[]): string[] {
  const files = new Set([...built, ...publicFiles].filter((f) => !f.endsWith('.map') && f !== 'sw.js'));
  return ['./', ...[...files].sort()];
}

export function serviceWorkerSource(version: string, precache: string[]): string {
  const runtime = readFileSync(new URL('./sw.js', import.meta.url), 'utf8');
  return `const VERSION = ${JSON.stringify(version)};\nconst PRECACHE = ${JSON.stringify(precache)};\n${runtime}`;
}

function listFiles(dir: string): string[] {
  try {
    return readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => relative(dir, join(d.parentPath, d.name)).split('\\').join('/'));
  } catch {
    return [];
  }
}

export function pwa(version: string): Plugin {
  let publicDir = '';
  return {
    name: 'squad-pwa',
    apply: 'build',
    enforce: 'post', // after the page itself is in the bundle
    configResolved(config) {
      publicDir = config.publicDir;
    },
    generateBundle(_options, bundle) {
      const precache = precacheList(Object.keys(bundle), listFiles(publicDir));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorkerSource(version, precache) });
    },
  };
}
