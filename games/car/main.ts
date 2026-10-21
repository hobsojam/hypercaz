import { GameAudio } from '../../engine/audio.ts';
import { bootGame } from '../../engine/boot.ts';
import { SceneStack } from '../../engine/scenes.ts';
import { createStorage } from '../../engine/storage.ts';
import { HEIGHT, WIDTH, type CarGame } from './game.ts';
import { CAR_STORAGE } from './progress.ts';
import { ParkScene } from './scene.ts';

const status = document.getElementById('status')!;
await bootGame<CarGame>({
  width: WIDTH, height: HEIGHT, workerUrl: '../sw.js',
  createGame: input => ({
    stack: new SceneStack(), input, audio: new GameAudio(), storage: createStorage(CAR_STORAGE),
    announce: message => { status.textContent = message; },
  }),
  firstScene: game => new ParkScene(game),
});
