import { GameAudio } from '../../engine/audio.ts';
import { bootGame } from '../../engine/boot.ts';
import { SceneStack } from '../../engine/scenes.ts';
import { createStorage } from '../../engine/storage.ts';
import { MERGE_STORAGE, type MergeGame } from './game.ts';
import { drawBackdrop } from './render/draw.ts';
import { HEIGHT, WIDTH } from './sim/constants.ts';
import { TitleScene } from './scenes/title.ts';

await bootGame<MergeGame>({
  width: WIDTH,
  height: HEIGHT,
  workerUrl: '../sw.js',
  createGame(input) {
    const storage = createStorage(MERGE_STORAGE);
    const audio = new GameAudio();
    audio.muted = storage.get<unknown>('muted', false) === true;
    return { stack: new SceneStack(), input, audio, storage, time: 0 };
  },
  firstScene: (game) => new TitleScene(game),
  // The winter garden first, over the whole window, so the bars around the
  // column are garden too. It is drawn in the column's coordinates and
  // continues past its edges.
  paintBackdrop(ctx, game, lb, win) {
    drawBackdrop(ctx, -lb.offsetX / lb.scale - 1, -lb.offsetY / lb.scale - 1, win.w / lb.scale + 2, win.h / lb.scale + 2, game.time);
  },
});
