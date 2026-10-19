import { describe, expect, it } from 'vitest';
import type { Game } from '../../games/squad/game.ts';
import { PlayScene } from '../../games/squad/scenes/play.ts';
import { makeLevel } from './fixtures.ts';

// A game whose input is scripted and whose audio records what it was asked to do.
function stubGame() {
  const calls: string[] = [];
  const keys = new Set<string>();
  const game = {
    stack: { replace: () => calls.push('leave') },
    input: {
      pointerX: null,
      consumeKey: (k: string) => keys.delete(k),
      consumeClick: () => false,
      isDown: () => false,
    },
    audio: {
      muted: false,
      play: () => undefined,
      startMusic: () => calls.push('start'),
      stopMusic: () => calls.push('stop'),
      duckMusic: (on: boolean) => calls.push(on ? 'duck' : 'unduck'),
    },
    storage: { get: () => null, set: () => undefined },
    levels: [{ file: 'fixture.json', level: makeLevel({ startSquad: 50, length: 10, boss: { hp: 1, pattern: 'single', fireEvery: 99 } }), error: null }],
    progress: { best: {}, muted: false },
  };
  return { game: game as unknown as Game, calls, press: (k: string) => keys.add(k) };
}

describe('play scene music', () => {
  it('starts the music when a level starts', () => {
    const { game, calls } = stubGame();
    new PlayScene(game, 0);
    expect(calls).toEqual(['start']);
  });

  it('ducks the music while paused', () => {
    const { game, calls, press } = stubGame();
    const scene = new PlayScene(game, 0);
    press('Escape');
    scene.update(1 / 60);
    press('Escape');
    scene.update(1 / 60);
    expect(calls).toEqual(['start', 'duck', 'unduck']);
  });

  it('stops the music as soon as the level is decided, once', () => {
    const { game, calls } = stubGame();
    const scene = new PlayScene(game, 0);
    for (let i = 0; i < 60 * 20 && !calls.includes('leave'); i++) scene.update(1 / 60);
    expect(calls.filter((c) => c === 'stop')).toHaveLength(1);
    expect(calls.indexOf('stop')).toBeLessThan(calls.indexOf('leave'));
  });
});
