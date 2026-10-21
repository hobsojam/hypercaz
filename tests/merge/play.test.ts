import { describe, expect, test } from 'vitest';
import type { Scene } from '../../engine/scenes.ts';
import { createStorage } from '../../engine/storage.ts';
import { loadBest, type MergeGame } from '../../games/merge/game.ts';
import { PlayScene, popPitch } from '../../games/merge/scenes/play.ts';
import { TitleScene } from '../../games/merge/scenes/title.ts';
import { CRATE, RADII } from '../../games/merge/sim/constants.ts';
import { makeBall } from '../../games/merge/sim/physics.ts';
import type { MergeState } from '../../games/merge/sim/state.ts';
import { PAUSE_BUTTON } from '../../games/merge/controls.ts';
import { stubCtx } from '../squad/stubCtx.ts';

const DT = 1 / 60;

function stubMerge(backend: Parameters<typeof createStorage>[1] = null) {
  const keys = new Set<string>();
  let click: { x: number; y: number } | null = null;
  let release: { x: number; y: number } | null = null;
  const sounds: { sfx: string; pitch: number | undefined }[] = [];
  const scenes: Scene[] = [];
  const input = {
    touch: false,
    held: false,
    pointerX: null as number | null,
    pointerY: null as number | null,
    consumeKey: (k: string) => keys.delete(k),
    consumeClick: () => {
      const c = click;
      click = null;
      return c;
    },
    consumeRelease: () => {
      const r = release;
      release = null;
      return r;
    },
    isDown: (k: string) => keys.has(`down:${k}`),
  };
  const game = {
    stack: { replace: (s: Scene) => scenes.push(s) },
    input,
    audio: { muted: false, play: (sfx: string, pitch?: number) => sounds.push({ sfx, pitch }), unlock: () => undefined },
    storage: createStorage('test', backend),
    time: 0,
  };
  return {
    game: game as unknown as MergeGame,
    input,
    sounds,
    scenes,
    press: (k: string) => keys.add(k),
    hold: (k: string) => keys.add(`down:${k}`),
    down: (x: number, y: number) => {
      click = { x, y };
      input.held = true;
    },
    release: (x: number, y: number) => {
      release = { x, y };
      input.held = false;
    },
  };
}

const stateOf = (s: PlayScene) => (s as unknown as { state: MergeState }).state;
const centre = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const textsOf = (ctx: ReturnType<typeof stubCtx>) => (ctx.calls.fillText ?? []).map(([t]) => t);
const memory = () => {
  const m = new Map<string, string>();
  return { m, backend: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } };
};

// Two touching balls of one size, resting on the floor of the crate.
function touchingPair(state: MergeState, size: number, x = 270): void {
  const r = RADII[size];
  const y = CRATE.floor - r;
  state.balls.push(makeBall(state.nextId++, size, x - r, y), makeBall(state.nextId++, size, x + r - 1, y));
}

test('a click (press and release) in the play area drops a ball at the pointer', () => {
  const { game, input, down, release } = stubMerge();
  const scene = new PlayScene(game);
  input.pointerX = 200;
  down(200, 500);
  release(200, 500);
  scene.update(DT);
  expect(stateOf(scene).balls).toHaveLength(1);
  expect(stateOf(scene).balls[0]!.x).toBe(200);
});

test('a drop is made at the release point, not a stale pointer', () => {
  const { game, input, down, release } = stubMerge();
  const scene = new PlayScene(game);
  input.pointerX = 100;
  down(100, 500);
  scene.update(DT);
  release(380, 500);
  scene.update(DT);
  expect(stateOf(scene).balls[0]!.x).toBe(380);
});

test('Space drops at the current aim', () => {
  const { game, input, press } = stubMerge();
  const scene = new PlayScene(game);
  input.pointerX = 150;
  scene.update(DT);
  press(' ');
  scene.update(DT);
  expect(stateOf(scene).balls).toHaveLength(1);
  expect(stateOf(scene).balls[0]!.x).toBe(150);
});

test('the arrow keys move the aim', () => {
  const { game, hold } = stubMerge();
  const scene = new PlayScene(game);
  const x0 = stateOf(scene).aimX;
  hold('ArrowRight');
  for (let i = 0; i < 6; i++) scene.update(DT);
  expect(stateOf(scene).aimX).toBeGreaterThan(x0);
});

test('a press on the pause button does not drop on release', () => {
  const { game, down, release } = stubMerge();
  const scene = new PlayScene(game);
  const p = centre(PAUSE_BUTTON);
  down(p.x, p.y);
  release(p.x, p.y);
  scene.update(DT);
  expect(stateOf(scene).balls).toHaveLength(0);
  const ctx = stubCtx();
  scene.render(ctx);
  expect(textsOf(ctx)).toContain('Paused');
});

test('merges pop with a rising pitch and families play the fanfare', () => {
  const { game, sounds } = stubMerge();
  const scene = new PlayScene(game);
  touchingPair(stateOf(scene), 1, 150);
  touchingPair(stateOf(scene), 2, 400);
  scene.update(DT);
  const pops = sounds.filter((s) => s.sfx === 'pop');
  expect(pops.length).toBeGreaterThanOrEqual(2);
  expect(pops[0]!.pitch).toBe(popPitch(1));
  expect(pops[1]!.pitch).toBeGreaterThan(1);
  expect(popPitch(1)).toBe(1);
  expect(popPitch(2)).toBeGreaterThan(1);
  expect(popPitch(99)).toBe(2);

  const family = stubMerge();
  const fscene = new PlayScene(family.game);
  touchingPair(stateOf(fscene), 9);
  fscene.update(DT);
  expect(family.sounds.map((s) => s.sfx)).toContain('win');
  expect(stateOf(fscene).balls).toHaveLength(0);
  const ctx = stubCtx();
  fscene.render(ctx);
  expect(textsOf(ctx)).toContain('+500');
});

describe('game over', () => {
  // A settled ball pinned over the line ends the round after OVER_TIME.
  function endWith(score: number, stub = stubMerge()) {
    const scene = new PlayScene(stub.game);
    const st = stateOf(scene);
    st.score = score;
    const ball = makeBall(st.nextId++, 5, 270, 330);
    ball.age = 5;
    st.balls.push(ball);
    for (let i = 0; i < 150 && st.phase === 'play'; i++) {
      ball.x = ball.px = 270;
      ball.y = ball.py = 330;
      ball.age = 5;
      scene.update(DT);
    }
    expect(st.phase).toBe('over');
    return { scene, ...stub };
  }

  test('saves a new best, and only a better one', () => {
    const { m, backend } = memory();
    const first = endWith(50, stubMerge(backend));
    expect(m.get('test.best')).toBe('50');
    const ctx = stubCtx();
    first.scene.render(ctx);
    expect(textsOf(ctx)).toEqual(expect.arrayContaining(['Game over', 'Score: 50', 'Best: 50', 'New best!', 'All games']));
    endWith(20, stubMerge(backend));
    expect(m.get('test.best')).toBe('50');
  });

  test('after the delay, play again starts a fresh round', () => {
    const { scene, down, scenes } = endWith(10);
    down(270, 500);
    scene.update(DT);
    expect(scenes).toHaveLength(0); // too soon
    for (let i = 0; i < 40; i++) scene.update(DT);
    down(270, 500);
    scene.update(DT);
    expect(scenes[0]).toBeInstanceOf(PlayScene);
  });

  test('"All games" goes back to the picker', () => {
    const { scene, down } = endWith(10);
    const urls: string[] = [];
    scene.navigate = (u) => urls.push(u);
    down(60, 24);
    scene.update(DT);
    expect(urls).toEqual(['../']);
  });
});

test('loadBest copes with junk and missing storage', () => {
  const read = (v: unknown) => {
    const { m, backend } = memory();
    m.set('test.best', JSON.stringify(v));
    return loadBest(createStorage('test', backend));
  };
  expect(read('abc')).toBe(0);
  expect(read(-3)).toBe(0);
  expect(read(Number.NaN)).toBe(0);
  expect(read(12.7)).toBe(12);
  expect(loadBest(createStorage('test', null))).toBe(0);
});

test('hiding the tab pauses the round', () => {
  const { game, input, press, down, release } = stubMerge();
  const scene = new PlayScene(game);
  scene.suspend();
  input.pointerX = 200;
  press(' ');
  down(200, 500);
  release(200, 500);
  scene.update(DT);
  expect(stateOf(scene).balls).toHaveLength(0);
});

describe('title', () => {
  test('shows the name, best and start line; Space starts a round', () => {
    const stub = stubMerge();
    stub.game.storage.set('best', 12);
    const title = new TitleScene(stub.game);
    const ctx = stubCtx();
    title.render(ctx);
    expect(textsOf(ctx)).toEqual(expect.arrayContaining(['SNOWMAN MERGE', 'Best: 12', 'Click, press Space or tap to start', 'All games']));
    stub.press(' ');
    title.update(DT);
    expect(stub.scenes[0]).toBeInstanceOf(PlayScene);
  });
});
