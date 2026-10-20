import { GameAudio } from '../../engine/audio.ts';
import { bootGame } from '../../engine/boot.ts';
import { SceneStack } from '../../engine/scenes.ts';
import { createStorage } from '../../engine/storage.ts';
import { STACK_STORAGE } from '../picker/tiles.ts';
import { HEIGHT, type StackGame, WIDTH } from './game.ts';
import { drawSky } from './render/draw.ts';
import { TitleScene } from './scenes/title.ts';

await bootGame<StackGame>({
  width: WIDTH,
  height: HEIGHT,
  workerUrl: '../sw.js',
  createGame(input) {
    const storage = createStorage(STACK_STORAGE);
    const audio = new GameAudio();
    audio.muted = storage.get<unknown>('muted', false) === true;
    return { stack: new SceneStack(), input, audio, storage, sky: 0 };
  },
  firstScene: (game) => new TitleScene(game),
  // The sky first, over the whole window, so the bars around the column are
  // sky too. Its gradient is in the column's coordinates and continues past
  // its edges.
  paintBackdrop(ctx, game, lb, win) {
    drawSky(ctx, game.sky, -lb.offsetX / lb.scale - 1, -lb.offsetY / lb.scale - 1, win.w / lb.scale + 2, win.h / lb.scale + 2);
  },
});
