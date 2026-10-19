// Renders the gameplay track off the main thread (about a second of work)
// and hands the samples back without copying them.
import { renderSong } from '../../../engine/music.ts';
import { GAMEPLAY_SONG } from './gameplay.ts';

const SAMPLE_RATE = 44100;
const samples = renderSong(GAMEPLAY_SONG, SAMPLE_RATE);
const scope = globalThis as unknown as { postMessage(message: unknown, transfer: Transferable[]): void };
scope.postMessage({ samples, sampleRate: SAMPLE_RATE }, [samples.buffer]);
