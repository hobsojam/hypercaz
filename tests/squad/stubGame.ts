import type { Scene } from '../../engine/scenes.ts';
import type { Game } from '../../games/squad/game.ts';
import { makeLevel } from './fixtures.ts';

// A game whose input is scripted and whose audio and storage record what they
// were asked to do.
export function stubGame() {
  const calls: string[] = [];
  const scenes: Scene[] = [];
  const saved: unknown[] = [];
  const keys = new Set<string>();
  let click: { x: number; y: number } | null = null;
  const input = {
    pointerX: null as number | null,
    pointerY: null as number | null,
    touch: false,
    consumeKey: (k: string) => keys.delete(k),
    consumeClick: () => {
      const c = click;
      click = null;
      return c;
    },
    isDown: () => false,
  };
  const game = {
    stack: {
      replace: (s: Scene) => {
        calls.push('leave');
        scenes.push(s);
      },
    },
    input,
    audio: {
      muted: false,
      play: () => undefined,
      unlock: () => undefined,
      startMusic: (name: string) => calls.push(`start:${name}`),
      stopMusic: () => calls.push('stop'),
      duckMusic: (on: boolean) => calls.push(on ? 'duck' : 'unduck'),
    },
    storage: { get: () => null, set: (_k: string, v: unknown) => saved.push(v) },
    levels: [{ file: 'fixture.json', level: makeLevel({ startSquad: 50, length: 10, boss: { hp: 1, pattern: 'single', fireEvery: 99 } }), error: null }],
    progress: { best: {}, muted: false },
  };
  return {
    game: game as unknown as Game,
    input,
    calls,
    scenes,
    saved,
    press: (k: string) => keys.add(k),
    // A tap also moves the pointer there, as a real pointerdown does.
    tap: (x: number, y: number) => {
      click = { x, y };
      input.pointerX = x;
      input.pointerY = y;
    },
  };
}
