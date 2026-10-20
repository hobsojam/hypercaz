import { describe, expect, it } from 'vitest';
import { PAUSE_BUTTON } from '../../games/squad/controls.ts';
import { BURST_BUTTON } from '../../games/squad/render/draw.ts';
import type { Effects } from '../../games/squad/render/effects.ts';
import { spawnEntity } from '../../games/squad/sim/state.ts';
import { makeLevel } from './fixtures.ts';
import { PlayScene } from '../../games/squad/scenes/play.ts';
import type { GameState } from '../../games/squad/sim/state.ts';
import type { SquadView } from '../../games/squad/render/squadView.ts';
import { stubGame } from './stubGame.ts';

describe('play scene music', () => {
  it('starts the music when a level starts', () => {
    const { game, calls } = stubGame();
    new PlayScene(game, 0);
    expect(calls).toEqual(['start:gameplay']);
  });

  it('ducks the music while paused', () => {
    const { game, calls, press } = stubGame();
    const scene = new PlayScene(game, 0);
    press('Escape');
    scene.update(1 / 60);
    press('Escape');
    scene.update(1 / 60);
    expect(calls).toEqual(['start:gameplay', 'duck', 'unduck']);
  });

  it('stops the music as soon as the level is decided, once', () => {
    const { game, calls } = stubGame();
    const scene = new PlayScene(game, 0);
    for (let i = 0; i < 60 * 20 && !calls.includes('leave'); i++) scene.update(1 / 60);
    expect(calls.filter((c) => c === 'stop')).toHaveLength(1);
    expect(calls.indexOf('stop')).toBeLessThan(calls.indexOf('leave'));
  });

  it('switches to the boss music when the boss arrives, then silence, then the menu music on the results', () => {
    const { game, calls } = stubGame();
    const scene = new PlayScene(game, 0);
    for (let i = 0; i < 60 * 20 && !calls.includes('leave'); i++) scene.update(1 / 60);
    expect(calls).toEqual(['start:gameplay', 'start:boss', 'stop', 'start:menu', 'leave']);
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

describe('play scene on a phone', () => {
  const stateOf = (scene: PlayScene) => (scene as unknown as { state: GameState }).state;
  const centre = (b: { x: number; y: number; w: number; h: number }) => [b.x + b.w / 2, b.y + b.h / 2] as const;

  it('the pause button pauses, and a tap anywhere resumes', () => {
    const { game, calls, tap } = stubGame();
    const scene = new PlayScene(game, 0);
    tap(...centre(PAUSE_BUTTON));
    scene.update(1 / 60);
    const time = stateOf(scene).time;
    scene.update(1 / 60);
    expect(stateOf(scene).time).toBe(time);
    tap(270, 800);
    scene.update(1 / 60);
    expect(calls).toEqual(['start:gameplay', 'duck', 'unduck']);
  });

  it('pauses itself when the page is hidden', () => {
    const { game, calls } = stubGame();
    const scene = new PlayScene(game, 0);
    scene.suspend();
    expect(calls).toEqual(['start:gameplay', 'duck']);
    scene.suspend();
    expect(calls).toEqual(['start:gameplay', 'duck']);
  });

  it('tapping the top bar does not drag the squad there', () => {
    const { game, tap } = stubGame();
    const scene = new PlayScene(game, 0);
    tap(500, 100);
    scene.update(1 / 60);
    expect((scene as unknown as { targetX: number }).targetX).toBe(0);
  });

  it('a finger lower down still steers', () => {
    const { game, tap } = stubGame();
    const scene = new PlayScene(game, 0);
    tap(500, 800);
    scene.update(1 / 60);
    expect((scene as unknown as { targetX: number }).targetX).toBeGreaterThan(0.5);
  });
});

it('a rescue behind the front shows its reward at the displayed target', () => {
  const { game } = stubGame();
  game.levels[0].level = makeLevel({ startSquad: 150, spawns: [{ z: 4, x: 0.79, type: 'cage', hp: 1, value: 3 }] });
  const scene = new PlayScene(game, 0);
  const { state, effects } = scene as unknown as { state: GameState; effects: Effects };
  state.entities = [spawnEntity(state, state.level.spawns[0], -4)];
  state.bullets = [{ x: 0.79, z: -4, damage: 1, vx: 0 }];
  scene.update(0);
  expect(effects.popups).toHaveLength(1);
  expect(effects.popups[0].text).toBe('+3');
  expect(effects.popups[0].x).toBeCloseTo(451.7);
  expect(effects.popups[0].y).toBeGreaterThan(800);
  expect(effects.popups[0].y).toBeLessThan(850);
});

it('soldiers freed from a cage start at the cage and run into the squad', () => {
  const { game } = stubGame();
  game.levels[0].level = makeLevel({ startSquad: 5, spawns: [{ z: 10, x: 0.5, type: 'cage', hp: 1, value: 3 }] });
  const scene = new PlayScene(game, 0);
  const { state, squadView } = scene as unknown as { state: GameState; squadView: SquadView };
  state.entities = [spawnEntity(state, state.level.spawns[0], 10)];
  state.bullets = [{ x: 0.5, z: 10, damage: 1, vx: 0 }];
  scene.update(0);
  expect(state.squad.count).toBe(8);
  for (const p of squadView.positions.slice(5)) {
    expect(p.dx).toBeCloseTo(0.5 - state.squad.x);
    expect(p.dz).toBeCloseTo(10);
  }
});
