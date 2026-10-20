// The start-up every game shares: a letterboxed canvas that follows the
// window, the game loop, pausing when the tab is hidden, unlocking audio on
// the first gesture, a crash screen, and the offline worker in real builds.
import type { GameAudio } from './audio.ts';
import { fitLetterbox, Input, type Letterbox } from './input.ts';
import { startLoop } from './loop.ts';
import { registerWorker } from './offline.ts';
import type { Scene, SceneStack } from './scenes.ts';

export interface BootOptions<G extends { stack: SceneStack; audio: GameAudio; input: Input }> {
  width: number;
  height: number;
  // Builds the game; it must use the given input, which knows the letterbox.
  createGame(input: Input): G | Promise<G>;
  firstScene(game: G): Scene;
  // Paints behind the game column. The canvas is already set up in the
  // column's coordinates, so it can reach into the bars. Default: black bars.
  paintBackdrop?(ctx: CanvasRenderingContext2D, game: G, letterbox: Letterbox, windowSize: { w: number; h: number }): void;
  // Where the root service worker is, relative to the page.
  workerUrl: string;
}

// Replaces the game with a plain message and a reload button. Built from text
// nodes, so nothing in the error can be read as HTML.
export function showCrash(title: string, err: unknown): void {
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

export async function bootGame<G extends { stack: SceneStack; audio: GameAudio; input: Input }>(opts: BootOptions<G>): Promise<void> {
  const { width, height } = opts;
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  let letterbox: Letterbox = fitLetterbox(window.innerWidth, window.innerHeight, width, height);
  let sizedFor = 0; // the devicePixelRatio the canvas was last sized for

  function resize(): void {
    const dpr = window.devicePixelRatio || 1;
    sizedFor = dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    letterbox = fitLetterbox(window.innerWidth, window.innerHeight, width, height);
  }
  window.addEventListener('resize', resize);
  resize();

  try {
    const game = await opts.createGame(new Input(() => letterbox));
    const { audio } = game;
    // Unlock audio inside the real gesture handlers, not later in the game
    // loop, so Safari allows it.
    const unlockAudio = () => audio.unlock();
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    game.stack.push(opts.firstScene(game));
    // Switching app or tab pauses the game and silences it.
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
        if (opts.paintBackdrop) {
          ctx.setTransform(dpr * letterbox.scale, 0, 0, dpr * letterbox.scale, dpr * letterbox.offsetX, dpr * letterbox.offsetY);
          opts.paintBackdrop(ctx, game, letterbox, { w: window.innerWidth, h: window.innerHeight });
        } else {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.setTransform(dpr * letterbox.scale, 0, 0, dpr * letterbox.scale, dpr * letterbox.offsetX, dpr * letterbox.offsetY);
        }
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, width, height);
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
  } catch (err) {
    showCrash('The game failed to start', err);
  }

  if (import.meta.env.PROD) await registerWorker(opts.workerUrl);
}
