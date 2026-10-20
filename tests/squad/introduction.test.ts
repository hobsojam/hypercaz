import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { AssetStore, parseManifest } from '../../engine/assets.ts';
import { PlayScene } from '../../games/squad/scenes/play.ts';
import { BURST_BUTTON } from '../../games/squad/render/draw.ts';
import { spawnEntity, type GameState } from '../../games/squad/sim/state.ts';
import { makeLevel } from './fixtures.ts';
import { stubGame } from './stubGame.ts';

function setup(touch = false) {
  const stub = stubGame();
  stub.game.assets = AssetStore.fromManifest(parseManifest(JSON.parse(readFileSync(new URL('../../games/squad/assets/manifest.json', import.meta.url), 'utf8'))));
  stub.game.levels[0].level = makeLevel({ startSquad: 3, spawns: [{ type: 'cage', z: 4, x: 0, hp: 1, value: 4 }] });
  stub.input.touch = touch;
  const open = () => new PlayScene(stub.game, 0);
  return { ...stub, open };
}

function texts(scene: PlayScene): string[] {
  const result: string[] = [];
  const ctx: object = new Proxy({}, {
    get: (_target, key) => key === 'fillText' ? (text: string) => result.push(text) : () => ctx,
    set: () => true,
  });
  scene.render(ctx as CanvasRenderingContext2D);
  return result;
}

const stateOf = (scene: PlayScene) => (scene as unknown as { state: GameState }).state;
const advance = (scene: PlayScene, seconds: number) => {
  for (let i = 0; i < seconds * 60; i++) scene.update(1 / 60);
};

test.each([
  { touch: false, instruction: 'Use ← → / A D, or move your mouse.' },
  { touch: true, instruction: 'Drag left or right to aim.' },
])('the opening teaches aiming and automatic shooting (touch=$touch)', ({ touch, instruction }) => {
  const { open } = setup(touch);
  expect(texts(open())).toEqual(expect.arrayContaining(['Aim at a cage', instruction, 'Your squad shoots automatically.']));
});

test('a real rescue replaces steering instructions with the recruitment reward', () => {
  const { open } = setup();
  const scene = open();
  advance(scene, 0.5);
  expect(stateOf(scene).squad.count).toBe(7);
  expect(texts(scene)).toContain('+4 recruits!');
  expect(texts(scene)).toContain('More soldiers mean more shots.');
  expect(texts(scene)).not.toContain('Aim at a cage');
  advance(scene, 2);
  expect(texts(scene)).toContain('Aim at red crowds to fill the orange bar.');
});

test.each([false, true])('a charged meter teaches and acknowledges its real activation (touch=%s)', touch => {
  const { open, press, tap } = setup(touch);
  const scene = open();
  const state = stateOf(scene);
  const practice = makeLevel({ spawns: [{ type: 'enemy', hp: 1000, x: 0.5, z: 30 }] });
  state.entities.push(spawnEntity(state, practice.spawns[0], 30));
  state.meter = state.level.burstKills;
  expect(texts(scene)).toContain(touch ? 'Tap the orange Rapid Fire bar above.' : 'Press Space or click the orange bar.');
  if (touch) tap(BURST_BUTTON.x + BURST_BUTTON.w / 2, BURST_BUTTON.y + BURST_BUTTON.h / 2);
  else press(' ');
  scene.update(1 / 60);
  expect(stateOf(scene).burstTime).toBeGreaterThan(0);
  expect(texts(scene)).toContain('Faster shots for a few seconds.');
  advance(scene, 2.1);
  stateOf(scene).meter = stateOf(scene).level.burstKills;
  expect(texts(scene)).not.toContain('Rapid Fire is ready');
  expect(texts(scene)).not.toContain('Faster shots for a few seconds.');
});

test('completed introductions and other levels do not repeat coaching', () => {
  const { game, open } = setup();
  game.progress.best[1] = 1;
  expect(texts(open())).not.toContain('Aim at a cage');
  game.progress.best = {};
  game.levels[0].level!.id = 2;
  expect(texts(open())).not.toContain('Aim at a cage');
});

test('coaching stays out of pause and defeat overlays', () => {
  const { open, press } = setup();
  const scene = open();
  press('Escape');
  scene.update(1 / 60);
  expect(texts(scene)).toContain('Paused');
  expect(texts(scene)).not.toContain('Aim at a cage');
  press('Escape');
  scene.update(0);
  expect(texts(scene)).toContain('Aim at a cage');
  stateOf(scene).phase = 'lost';
  expect(texts(scene)).not.toContain('Aim at a cage');
});

test('a charged meter is saved until there is a crowd worth using it on', () => {
  const scene = setup().open();
  stateOf(scene).meter = stateOf(scene).level.burstKills;
  expect(texts(scene)).toContain('Save it for the next red crowd.');
  expect(texts(scene)).not.toContain('Press Space or click the orange bar.');
});
