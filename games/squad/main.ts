import { AssetStore, parseManifest, urlResolver } from '../../engine/assets.ts';
import { GameAudio } from '../../engine/audio.ts';
import { fitLetterbox, Input, type Letterbox } from '../../engine/input.ts';
import { startLoop } from '../../engine/loop.ts';
import { SceneStack } from '../../engine/scenes.ts';
import { createStorage } from '../../engine/storage.ts';
import manifestJson from './assets/manifest.json';
import { type Game, HEIGHT, WIDTH } from './game.ts';
import { levels } from './levels/index.ts';
import { loadProgress } from './progress.ts';
import { TitleScene } from './scenes/title.ts';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
let letterbox: Letterbox = fitLetterbox(window.innerWidth, window.innerHeight, WIDTH, HEIGHT);

function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  letterbox = fitLetterbox(window.innerWidth, window.innerHeight, WIDTH, HEIGHT);
}
window.addEventListener('resize', resize);
resize();

// Music is rendered in a worker so start-up never stalls; the game simply
// plays without it until (or unless) it arrives.
function loadMusic(audio: GameAudio): void {
  try {
    const worker = new Worker(new URL('./music/worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ samples: Float32Array<ArrayBuffer>; sampleRate: number }>) => {
      audio.setMusic(e.data.samples, e.data.sampleRate);
      worker.terminate();
    };
    worker.onerror = (e) => console.warn('music failed to render:', e.message);
  } catch (err) {
    console.warn('music unavailable:', err);
  }
}

async function boot(): Promise<void> {
  const storage = createStorage('hypercaz.squad');
  const progress = loadProgress(storage);
  const audio = new GameAudio();
  audio.muted = progress.muted;
  loadMusic(audio);
  const assetUrls = import.meta.glob<string>('./assets/*.{png,svg}', { eager: true, query: '?url', import: 'default' });
  const assets = await AssetStore.load(parseManifest(manifestJson), urlResolver(assetUrls, './assets/'));
  const game: Game = {
    stack: new SceneStack(),
    input: new Input(() => letterbox),
    audio,
    storage,
    assets,
    levels,
    progress,
  };
  // Unlock audio inside the real gesture handlers, not later in the game
  // loop, so Safari allows it.
  const unlockAudio = () => audio.unlock();
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);
  game.stack.push(new TitleScene(game));

  let updated = false;
  startLoop(
    (dt) => {
      game.stack.top?.update(dt);
      updated = true;
    },
    (alpha) => {
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr * letterbox.scale, 0, 0, dpr * letterbox.scale, dpr * letterbox.offsetX, dpr * letterbox.offsetY);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, WIDTH, HEIGHT);
      ctx.clip();
      game.stack.top?.render(ctx, alpha);
      ctx.restore();
      if (updated) game.input.endFrame();
      updated = false;
    },
  );
}

boot().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<pre style="color:#fff;padding:16px">Failed to start: ${String(err)}</pre>`;
});
