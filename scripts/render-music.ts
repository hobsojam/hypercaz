// Renders the gameplay track to a WAV file for listening outside the game.
// Output always goes in music-out/ (git-ignored); only a file name is taken.
//   node scripts/render-music.ts [name.wav]
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { encodeWav, renderSong, songSeconds } from '../engine/music.ts';
import { GAMEPLAY_SONG } from '../games/squad/music/gameplay.ts';

const OUT_DIR = resolve(import.meta.dirname, '../music-out');
const name = basename(process.argv[2] ?? 'gameplay.wav');
if (!/^[\w-]+\.wav$/.test(name)) {
  console.error('usage: node scripts/render-music.ts [name.wav]  (letters, digits, - and _ only)');
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });
const out = join(OUT_DIR, name);
const rate = 44100;
const started = performance.now();
const samples = renderSong(GAMEPLAY_SONG, rate);
writeFileSync(out, encodeWav(samples, rate));
console.log(`wrote ${out}: ${songSeconds(GAMEPLAY_SONG).toFixed(1)} s, rendered in ${Math.round(performance.now() - started)} ms`);
