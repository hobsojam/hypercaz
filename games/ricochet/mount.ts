import type { AssetStore } from '../../engine/assets.ts';
import { GameAudio } from '../../engine/audio.ts';
import { startLoop } from '../../engine/loop.ts';
import { createStorage } from '../../engine/storage.ts';
import { loadAssets } from './assets.ts';
import { Controls } from './controls.ts';
import { bindInput } from './input.ts';
import { render } from './render.ts';
import { Session } from './session.ts';
import { starsFor } from './sim/game.ts';
import { Viewport } from './viewport.ts';

export interface MountOptions {
  readonly assets?: AssetStore;
  readonly audio?: Pick<GameAudio, 'muted' | 'unlock' | 'hide' | 'play'>;
  readonly storage?: ReturnType<typeof createStorage>;
  readonly onStatus?: (message: string) => void;
  readonly onError?: (error: unknown) => void;
}

function status(s: Session): string {
  if (s.screen === 'levels') return 'Choose a puzzle. Use arrow keys and Enter, or tap a card.';
  const name = s.state.level.name;
  if (s.paused) return `${name}. Paused. Press Enter to resume.`;
  if (s.state.phase === 'won') return `${name}. Everyone rescued in ${s.state.shotsUsed} shot${s.state.shotsUsed === 1 ? '' : 's'}. ${starsFor(s.state)} stars.`;
  if (s.state.phase === 'lost') return `${name}. Out of shots. Press R to retry.`;
  if (s.state.phase === 'flying') return `${name}. Ball in flight.`;
  return `${name}. ${s.state.level.shots - s.state.shotsUsed} shots left. Drag to aim and release, or use arrows and Space.`;
}

// Owns only this canvas and its listeners. The host owns navigation/picker UI.
export async function mountRicochet(canvas: HTMLCanvasElement, options: MountOptions = {}): Promise<() => void> {
  const assets = options.assets ?? await loadAssets();
  const session = new Session(options.storage ?? createStorage('hypercaz.ricochet'));
  const audio = options.audio ?? new GameAudio();
  const lifecycle = new AbortController();
  let disposed = false;
  let stop = () => {};
  const dispose = () => {
    if (disposed) return;
    disposed = true; stop(); lifecycle.abort(); audio.hide();
  };
  try {
    const viewport = new Viewport(canvas, lifecycle.signal);
    const controls = new Controls(session);
    let lastStatus = '';
    const sync = () => {
      audio.muted = session.muted;
      for (const sound of session.takeSounds()) audio.play(sound);
      const message = status(session);
      if (message !== lastStatus) { lastStatus = message; options.onStatus?.(message); }
    };
    const suspend = () => {
      controls.cancelAll();
      if (!session.paused) session.togglePause();
      audio.hide(); sync();
    };
    bindInput(canvas, viewport, controls, { gesture: () => audio.unlock(), change: sync, suspend }, lifecycle.signal);
    document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); }, { signal: lifecycle.signal });
    stop = startLoop(dt => { session.update(dt); sync(); }, () => viewport.draw(ctx => render(ctx, session, assets)), error => {
      dispose();
      options.onStatus?.('The game stopped. Reload this page to try again.');
      options.onError?.(error);
    });
    sync(); viewport.draw(ctx => render(ctx, session, assets));
    return dispose;
  } catch (error) {
    dispose();
    throw error;
  }
}
