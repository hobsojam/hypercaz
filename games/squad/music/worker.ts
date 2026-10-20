// Renders every song off the main thread (about a second of work each) and
// hands each one back, without copying, as soon as it is ready. Gameplay
// comes first so a level never waits on the menu or boss tracks.
import { renderSong } from '../../../engine/music.ts';
import { SONGS, type SongName } from './songs.ts';

export interface RenderedSong {
  name: SongName;
  samples: Float32Array<ArrayBuffer>;
  sampleRate: number;
}

const SAMPLE_RATE = 44100;
const scope = globalThis as unknown as { postMessage(message: RenderedSong, transfer: Transferable[]): void; close(): void };
for (const name of Object.keys(SONGS) as SongName[]) {
  const samples = renderSong(SONGS[name], SAMPLE_RATE);
  scope.postMessage({ name, samples, sampleRate: SAMPLE_RATE }, [samples.buffer]);
}
scope.close();
