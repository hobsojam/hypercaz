import { GameAudio } from '../../engine/audio.ts';
import { fitLetterbox, Input, type Letterbox } from '../../engine/input.ts';
import { startLoop } from '../../engine/loop.ts';
import { SceneStack } from '../../engine/scenes.ts';
import { createStorage } from '../../engine/storage.ts';
import { HEIGHT, type StackGame, WIDTH } from './game.ts';
import { drawSky } from './render/draw.ts';
import { TitleScene } from './scenes/title.ts';
import { STACK_STORAGE } from '../picker/tiles.ts';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
let letterbox: Letterbox = fitLetterbox(window.innerWidth, window.innerHeight, WIDTH, HEIGHT);
let sizedFor = 0; // the devicePixelRatio the canvas was last sized for

function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  sizedFor = dpr;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  letterbox = fitLetterbox(window.innerWidth, window.innerHeight, WIDTH, HEIGHT);
}
window.addEventListener('resize', resize);
resize();

// Replaces the game with a plain message and a reload button. Built from text
// nodes, so nothing in the error can be read as HTML.
function showCrash(title: string, err: unknown): void {
  console.error(err);
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;background:#1A1A2E;color:#fff;font:16px "Trebuchet MS",sans-serif;text-align:center';
  const heading = document.createElement('h1');
  heading.textContent = title;
  heading.style.cssText = 'margin:0;font-size:28px;color:#F5C242';
  const detail = document.createElement('p');
  detail.textContent = err instanceof Error ? err.message : String(err);
  detail.style.cssText = 'margin:0;max-width:30em;opacity:0.7;font-size:13px;word-break:break-word';
  const reload = document.createElement('button');
  reload.textContent = 'Reload';
  reload.style.cssText = 'font:bold 20px "Trebuchet MS",sans-serif;padding:12px 32px;border:3px solid #fff;border-radius:16px;background:#2F7DE1;color:#fff';
  reload.addEventListener('click', () => location.reload());
  box.append(heading, detail, reload);
  document.body.replaceChildren(box);
}

function boot(): void {
  const storage = createStorage(STACK_STORAGE);
  const audio = new GameAudio();
  audio.muted = storage.get<unknown>('muted', false) === true;
  const game: StackGame = { stack: new SceneStack(), input: new Input(() => letterbox), audio, storage, sky: 0 };
  // Unlock audio inside the real gesture handlers, not later in the game
  // loop, so Safari allows it.
  const unlockAudio = () => audio.unlock();
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);
  game.stack.push(new TitleScene(game));
  // Switching app or tab pauses the run and silences the game.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    game.stack.top?.suspend?.();
    audio.hide();
  });

  let updated = false;
  startLoop(
    (dt) => {
      game.stack.top?.update(dt);
      updated = true;
    },
    (alpha) => {
      const dpr = window.devicePixelRatio || 1;
      // Zooming or moving to another screen can change this without a resize.
      if (dpr !== sizedFor) resize();
      // The sky first, over the whole window, so the bars around the column
      // are sky too. Its gradient is in the column's coordinates and
      // continues past its edges.
      ctx.setTransform(dpr * letterbox.scale, 0, 0, dpr * letterbox.scale, dpr * letterbox.offsetX, dpr * letterbox.offsetY);
      drawSky(ctx, game.sky, -letterbox.offsetX / letterbox.scale - 1, -letterbox.offsetY / letterbox.scale - 1, window.innerWidth / letterbox.scale + 2, window.innerHeight / letterbox.scale + 2);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, WIDTH, HEIGHT);
      ctx.clip();
      game.stack.top?.render(ctx, alpha);
      ctx.restore();
      if (updated) game.input.endFrame();
      updated = false;
    },
    (err) => {
      audio.hide();
      showCrash('Something went wrong', err);
    },
  );
}

try {
  boot();
} catch (err) {
  showCrash('The game failed to start', err);
}
