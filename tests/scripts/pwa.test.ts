import { describe, expect, it } from 'vitest';
import { buildStamp, precacheList, serviceWorkerSource } from '../../scripts/pwa.ts';

describe('buildStamp', () => {
  it('names the build by its UTC date and short commit', () => {
    expect(buildStamp(new Date('2026-10-20T23:30:00Z'), '98faf9e1234567')).toBe('2026-10-20 98faf9e');
  });

  it('says dev when there is no commit to name', () => {
    expect(buildStamp(new Date('2026-10-20T00:00:00Z'), null)).toBe('2026-10-20 dev');
  });
});

describe('precacheList', () => {
  it('lists the start page and every built and public file once, minus source maps and the worker itself', () => {
    expect(precacheList(['index.html', 'assets/index-abc.js', 'assets/index-abc.js.map', 'sw.js'], ['favicon.svg', 'index.html', 'icons/a.png'])).toEqual([
      './',
      'squad/',
      'stack/',
      'sort/',
      'arrows/',
      'merge/',
      'assets/index-abc.js',
      'favicon.svg',
      'icons/a.png',
      'index.html',
    ]);
  });
});

describe('precacheList pages', () => {
  it('lists the page directories the browser requests', () => {
    expect(precacheList(['index.html'], [])).toEqual(expect.arrayContaining(['./', 'squad/', 'stack/', 'sort/', 'arrows/', 'merge/']));
  });
});

describe('serviceWorkerSource', () => {
  const source = serviceWorkerSource('2026-10-20 98faf9e', ['./', 'index.html']);

  it('carries the build in its cache name, so each deploy replaces the old cache', () => {
    expect(source).toContain('const VERSION = "2026-10-20 98faf9e";');
  });

  it('carries the files to fetch on install', () => {
    expect(source).toContain('const PRECACHE = ["./","index.html"];');
  });

  it('is valid JavaScript', () => {
    expect(() => new Function(source)).not.toThrow();
  });
});
