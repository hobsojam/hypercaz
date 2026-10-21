import { GameAudio } from '../../engine/audio.ts';
import { bootGame } from '../../engine/boot.ts';
import { SceneStack } from '../../engine/scenes.ts';
import { createStorage } from '../../engine/storage.ts';
import { HEIGHT, WIDTH, type ArrowGame } from './game.ts';
import { ARROWS_STORAGE } from './progress.ts';
import { EscapeScene } from './scene.ts';

const status = document.getElementById('status')!;
await bootGame<ArrowGame>({
  width: WIDTH, height: HEIGHT, workerUrl: '../sw.js',
  createGame: input => ({
    stack: new SceneStack(), input, audio: new GameAudio(), storage: createStorage(ARROWS_STORAGE),
    announce: message => { status.textContent = message; },
  }),
  firstScene: game => new EscapeScene(game),
});
