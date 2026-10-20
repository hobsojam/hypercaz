import { AssetStore, parseManifest, urlResolver } from '../../engine/assets.ts';
import { bootGame } from '../../engine/boot.ts';
import { GameAudio } from '../../engine/audio.ts';
import { SceneStack } from '../../engine/scenes.ts';
import { createStorage } from '../../engine/storage.ts';
import manifestJson from './assets/manifest.json';
import { type Game, HEIGHT, WIDTH } from './game.ts';
import { levels } from './levels/index.ts';
import type { RenderedSong } from './music/worker.ts';
import { loadProgress } from './progress.ts';
import { TitleScene } from './scenes/title.ts';

// Music is rendered in a worker so start-up never stalls; the game simply
// plays without it until (or unless) it arrives.
function loadMusic(audio: GameAudio): void {
  try {
    const worker = new Worker(new URL('./music/worker.ts', import.meta.url), { type: 'module' });
    // One message per song, as each finishes; the worker closes itself after the last.
    worker.onmessage = (e: MessageEvent<RenderedSong>) => audio.setMusic(e.data.name, e.data.samples, e.data.sampleRate);
    worker.onerror = (e) => console.warn('music failed to render:', e.message);
  } catch (err) {
    console.warn('music unavailable:', err);
  }
}

await bootGame<Game>({
  width: WIDTH,
  height: HEIGHT,
  workerUrl: '../sw.js',
  async createGame(input) {
    const storage = createStorage('hypercaz.squad');
    const progress = loadProgress(storage);
    const audio = new GameAudio();
    audio.muted = progress.muted;
    loadMusic(audio);
    const assetUrls = import.meta.glob<string>('./assets/*.{png,svg}', { eager: true, query: '?url', import: 'default' });
    const assets = await AssetStore.load(parseManifest(manifestJson), urlResolver(assetUrls, './assets/'));
    return { stack: new SceneStack(), input, audio, storage, assets, levels, progress };
  },
  firstScene: (game) => new TitleScene(game),
});
