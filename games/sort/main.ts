import { GameAudio } from '../../engine/audio.ts';
import { bootGame } from '../../engine/boot.ts';
import { SceneStack } from '../../engine/scenes.ts';
import { createStorage } from '../../engine/storage.ts';
import { loadLevel, loadSymbols, SORT_STORAGE, type SortGame } from './game.ts';
import { PlayScene } from './scenes/play.ts';

// The whole window, in CSS px. No title screen: it starts straight in.
await bootGame<SortGame>({
  fit: 'window',
  width: 0, // ignored in window mode
  height: 0,
  workerUrl: '../sw.js',
  createGame(input) {
    const storage = createStorage(SORT_STORAGE);
    const audio = new GameAudio();
    audio.muted = storage.get<unknown>('muted', false) === true;
    return { stack: new SceneStack(), input, audio, storage, view: { w: window.innerWidth, h: window.innerHeight }, symbols: loadSymbols(storage) };
  },
  onResize: (game, w, h) => (game.view = { w, h }),
  firstScene: (game) => new PlayScene(game, loadLevel(game.storage)),
});
