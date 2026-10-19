// Renders the gameplay track to a WAV file for listening outside the game.
//   node scripts/render-music.ts <out.wav>
import { writeFileSync } from 'node:fs';
import { encodeWav, renderSong, songSeconds } from '../engine/music.ts';
import { GAMEPLAY_SONG } from '../games/squad/music/gameplay.ts';

const out = process.argv[2];
if (!out) {
  console.error('usage: node scripts/render-music.ts <out.wav>');
  process.exit(1);
}
const rate = 44100;
const started = performance.now();
const samples = renderSong(GAMEPLAY_SONG, rate);
writeFileSync(out, encodeWav(samples, rate));
console.log(`wrote ${out}: ${songSeconds(GAMEPLAY_SONG).toFixed(1)} s, rendered in ${Math.round(performance.now() - started)} ms`);
