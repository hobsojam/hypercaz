import { describe, expect, it } from 'vitest';
import type { Game } from '../../games/squad/game.ts';
import { BURST_BUTTON } from '../../games/squad/render/draw.ts';
import { PlayScene } from '../../games/squad/scenes/play.ts';
import type { GameState } from '../../games/squad/sim/state.ts';
import { makeLevel } from './fixtures.ts';

// A game whose input is scripted and whose audio records what it was asked to do.
function stubGame() {
  const calls: string[] = [];
  const keys = new Set<string>();
  let click: { x: number; y: number } | null = null;
  const game = {
    stack: { replace: () => calls.push('leave') },
    input: {
      pointerX: null,
      consumeKey: (k: string) => keys.delete(k),
      consumeClick: () => {
        const c = click;
        click = null;
        return c;
      },
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
  return {
    game: game as unknown as Game,
    calls,
    press: (k: string) => keys.add(k),
    tap: (x: number, y: number) => (click = { x, y }),
  };
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

describe('play scene rapid fire', () => {
  const stateOf = (scene: PlayScene) => (scene as unknown as { state: GameState }).state;
  const charged = () => {
    const stub = stubGame();
    const scene = new PlayScene(stub.game, 0);
    stateOf(scene).meter = stateOf(scene).level.burstKills;
    return { ...stub, scene };
  };

  it('Space spends a full meter on rapid fire', () => {
    const { scene, press } = charged();
    press(' ');
    scene.update(1 / 60);
    expect(stateOf(scene).burstTime).toBeGreaterThan(0);
  });

  it('tapping the meter spends it too', () => {
    const { scene, tap } = charged();
    tap(BURST_BUTTON.x + BURST_BUTTON.w / 2, BURST_BUTTON.y + BURST_BUTTON.h / 2);
    scene.update(1 / 60);
    expect(stateOf(scene).burstTime).toBeGreaterThan(0);
  });

  it('a tap anywhere else is just steering', () => {
    const { scene, tap } = charged();
    tap(270, 800);
    scene.update(1 / 60);
    expect(stateOf(scene).burstTime).toBe(0);
  });
});
