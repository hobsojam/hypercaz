// Renders one of the game's songs to a WAV file for listening outside the game.
// Output always goes in music-out/ (git-ignored); only a file name is taken.
//   node scripts/render-music.ts [gameplay|menu|boss] [name.wav]
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { encodeWav, renderSong, songSeconds } from '../engine/music.ts';
import { SONGS, type SongName } from '../games/squad/music/songs.ts';

const usage = (): never => {
  console.error('usage: node scripts/render-music.ts [gameplay|menu|boss] [name.wav]  (file name: letters, digits, - and _ only)');
  process.exit(1);
};

const song = process.argv[2] ?? 'gameplay';
if (!Object.hasOwn(SONGS, song)) usage();
const name = basename(process.argv[3] ?? `${song}.wav`);
if (!/^[\w-]+\.wav$/.test(name)) usage();

const OUT_DIR = resolve(import.meta.dirname, '../music-out');
mkdirSync(OUT_DIR, { recursive: true });
const out = join(OUT_DIR, name);
const rate = 44100;
const track = SONGS[song as SongName];
const started = performance.now();
const samples = renderSong(track, rate);
writeFileSync(out, encodeWav(samples, rate));
console.log(`wrote ${out}: ${songSeconds(track).toFixed(1)} s, rendered in ${Math.round(performance.now() - started)} ms`);
