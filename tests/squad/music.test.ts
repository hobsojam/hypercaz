import { describe, expect, it } from 'vitest';
import { renderSong, songSeconds } from '../../engine/music.ts';
import { SONGS, type SongName } from '../../games/squad/music/songs.ts';

const RATE = 8000;
const names = Object.keys(SONGS) as SongName[];

describe('the game songs', () => {
  it('are the gameplay, menu and boss tracks, gameplay first so it is rendered first', () => {
    expect(names).toEqual(['gameplay', 'menu', 'boss']);
  });

  it.each(names)('%s: every track has the same number of bars', (name) => {
    const bars = SONGS[name].tracks.map((t) => t.bars.length);
    expect(new Set(bars).size).toBe(1);
  });

  it.each(names)('%s: renders to exactly its length, loud but never clipping', (name) => {
    const samples = renderSong(SONGS[name], RATE);
    expect(samples).toHaveLength(Math.round(songSeconds(SONGS[name]) * RATE));
    const peak = samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    expect(peak).toBeLessThanOrEqual(1);
    expect(peak).toBeGreaterThan(0.5);
  });

  it('the menu is calmer and the boss more urgent than the gameplay march', () => {
    expect(SONGS.menu.bpm).toBeLessThan(SONGS.gameplay.bpm);
    expect(SONGS.boss.bpm).toBeGreaterThan(SONGS.gameplay.bpm);
  });

  it.each(['menu', 'boss'] as const)('%s: loops in 16-24 bars', (name) => {
    const bars = SONGS[name].tracks[0].bars.length;
    expect(bars).toBeGreaterThanOrEqual(16);
    expect(bars).toBeLessThanOrEqual(24);
  });
});
