import { describe, expect, test } from 'vitest';
import type { Scene } from '../../engine/scenes.ts';
import { createStorage } from '../../engine/storage.ts';
import type { StackGame } from '../../games/stack/game.ts';
import { PlayScene, perfectPitch } from '../../games/stack/scenes/play.ts';
import { TitleScene } from '../../games/stack/scenes/title.ts';
import type { StackState } from '../../games/stack/sim/state.ts';
import { stubCtx } from '../squad/stubCtx.ts';

const DT = 1 / 60;

function stubStack(backend: Parameters<typeof createStorage>[1] = null) {
  const keys = new Set<string>();
  let click: { x: number; y: number } | null = null;
  const sounds: { sfx: string; pitch: number | undefined }[] = [];
  const scenes: Scene[] = [];
  const game = {
    stack: { replace: (s: Scene) => scenes.push(s) },
    input: {
      touch: false,
      pointerX: null,
      pointerY: null,
      consumeKey: (k: string) => keys.delete(k),
      consumeClick: () => {
        const c = click;
        click = null;
        return c;
      },
      isDown: () => false,
    },
    audio: { muted: false, play: (sfx: string, pitch?: number) => sounds.push({ sfx, pitch }), unlock: () => undefined },
    storage: createStorage('test', backend),
    sky: 0,
  };
  return {
    game: game as unknown as StackGame,
    sounds,
    scenes,
    press: (k: string) => keys.add(k),
    tap: (x: number, y: number) => {
      click = { x, y };
    },
  };
}

const stateOf = (s: PlayScene) => (s as unknown as { state: StackState }).state;

// Lines the sliding slab up dead on the top slab, as the player sees it.
function alignPerfect(scene: PlayScene): void {
  const st = stateOf(scene);
  st.moving.x = st.floors[st.floors.length - 1]!.x;
}

test('Space drops the slab', () => {
  const { game, press } = stubStack();
  const scene = new PlayScene(game);
  press(' ');
  scene.update(DT);
  expect(stateOf(scene).floors).toHaveLength(2);
});

test('a single frame after Space on an aligned slab is a perfect', () => {
  const { game, press, sounds } = stubStack();
  const scene = new PlayScene(game);
  alignPerfect(scene);
  press(' ');
  scene.update(DT);
  expect(stateOf(scene).events.map((e) => e.type)).toEqual(['perfect']);
  expect(sounds.map((s) => s.sfx)).toContain('perfect');
});

test('a click or tap drops the slab too', () => {
  const { game, tap } = stubStack();
  const scene = new PlayScene(game);
  alignPerfect(scene);
  tap(270, 500);
  scene.update(DT);
  expect(stateOf(scene).floors).toHaveLength(2);
});

test('a perfect drop plays a note, and each perfect in a row is higher', () => {
  const { game, press, sounds } = stubStack();
  const scene = new PlayScene(game);
  for (let i = 0; i < 3; i++) {
    alignPerfect(scene);
    press(' ');
    scene.update(DT);
  }
  const perfects = sounds.filter((s) => s.sfx === 'perfect');
  expect(perfects).toHaveLength(3);
  expect(perfects[0]!.pitch).toBe(1);
  expect(perfects[1]!.pitch!).toBeGreaterThan(perfects[0]!.pitch!);
  expect(perfects[2]!.pitch!).toBeGreaterThan(perfects[1]!.pitch!);
});

test('perfect notes climb the major scale and stop at two octaves', () => {
  const steps = [1, 2, 3, 4, 5, 6, 7, 8, 9, 15, 16, 17, 50].map((n) => Math.round(12 * Math.log2(perfectPitch(n))));
  expect(steps).toEqual([0, 2, 4, 5, 7, 9, 11, 12, 14, 24, 24, 24, 24]);
});

test('a normal drop plays the place sound and resets the notes', () => {
  const { game, press, sounds } = stubStack();
  const scene = new PlayScene(game);
  alignPerfect(scene);
  press(' ');
  scene.update(DT);
  const st = stateOf(scene);
  st.moving.x = st.floors[1]!.x + 50;
  press(' ');
  scene.update(DT);
  expect(sounds.map((s) => s.sfx)).toEqual(['perfect', 'place']);
  // Two perfects in a row would now play the second note; after a normal drop it starts over.
  alignPerfect(scene);
  press(' ');
  scene.update(DT);
  expect(sounds.at(-1)).toEqual({ sfx: 'perfect', pitch: 1 });
});

describe('game over', () => {
  function miss(stub = stubStack()) {
    const scene = new PlayScene(stub.game);
    const st = stateOf(scene);
    st.floors.push({ x: 120, width: 300 }, { x: 120, width: 300 }, { x: 120, width: 300 });
    st.moving.x = 430;
    st.moving.width = 100;
    stub.press(' ');
    scene.update(DT);
    return { scene, ...stub };
  }

  test('a miss saves a new best and offers "All games"', () => {
    const backend = new Map<string, string>();
    const stub = stubStack({ getItem: (k) => backend.get(k) ?? null, setItem: (k, v) => void backend.set(k, v) });
    const { scene } = miss(stub);
    expect(stateOf(scene).phase).toBe('over');
    expect(backend.get('test.best')).toBe('3');
    const ctx = stubCtx();
    scene.render(ctx);
    const texts = (ctx.calls.fillText ?? []).map(([t]) => t);
    expect(texts).toContain('All games');
    expect(texts).toContain('Best: 3');
  });

  test('a lower score does not overwrite the best', () => {
    const backend = new Map<string, string>([['test.best', '9']]);
    const stub = stubStack({ getItem: (k) => backend.get(k) ?? null, setItem: (k, v) => void backend.set(k, v) });
    miss(stub);
    expect(backend.get('test.best')).toBe('9');
  });

  test('after a short pause, Space or a tap plays again', () => {
    const { scene, press, scenes } = miss();
    press(' ');
    scene.update(DT);
    expect(scenes).toHaveLength(0); // too soon: a frantic extra tap must not restart
    for (let i = 0; i < 60; i++) scene.update(DT);
    press(' ');
    scene.update(DT);
    expect(scenes[0]).toBeInstanceOf(PlayScene);
  });

  test('"All games" goes back to the picker', () => {
    const { scene, tap } = miss();
    const urls: string[] = [];
    scene.navigate = (u) => urls.push(u);
    for (let i = 0; i < 60; i++) scene.update(DT);
    const ctx = stubCtx();
    scene.render(ctx);
    tap(60, 24);
    scene.update(DT);
    expect(urls).toEqual(['../']);
  });
});

test('with no storage at all it still plays, and best reads 0', () => {
  const { game, press } = stubStack(null);
  const scene = new PlayScene(game);
  for (let i = 0; i < 5; i++) {
    alignPerfect(scene);
    press(' ');
    scene.update(DT);
  }
  expect(stateOf(scene).floors).toHaveLength(6);
  const title = stubCtx();
  new TitleScene(stubStack(null).game).render(title);
  expect((title.calls.fillText ?? []).map(([t]) => t)).toContain('Best: 0');
});

describe('controls', () => {
  test('Esc pauses and the slab stops sliding; Esc again resumes', () => {
    const { game, press } = stubStack();
    const scene = new PlayScene(game);
    const x0 = stateOf(scene).moving.x;
    press('Escape');
    scene.update(DT);
    scene.update(DT);
    expect(stateOf(scene).moving.x).toBe(x0);
    press('Escape');
    scene.update(DT);
    scene.update(DT);
    expect(stateOf(scene).moving.x).not.toBe(x0);
  });

  test('Space while paused does not drop', () => {
    const { game, press } = stubStack();
    const scene = new PlayScene(game);
    press('Escape');
    scene.update(DT);
    press(' ');
    scene.update(DT);
    expect(stateOf(scene).floors).toHaveLength(1);
  });

  test('M mutes', () => {
    const { game, press } = stubStack();
    const scene = new PlayScene(game);
    press('m');
    scene.update(DT);
    expect(game.audio.muted).toBe(true);
  });

  test('the pause button pauses instead of dropping', () => {
    const { game, tap } = stubStack();
    const scene = new PlayScene(game);
    tap(540 - 80 + 20, 24);
    scene.update(DT);
    expect(stateOf(scene).floors).toHaveLength(1);
    const ctx = stubCtx();
    scene.render(ctx);
    expect((ctx.calls.fillText ?? []).map(([t]) => t)).toContain('Paused');
  });

  test('suspend (tab hidden) pauses', () => {
    const { game } = stubStack();
    const scene = new PlayScene(game);
    scene.suspend();
    const x0 = stateOf(scene).moving.x;
    scene.update(DT);
    expect(stateOf(scene).moving.x).toBe(x0);
  });
});

describe('title', () => {
  test('shows STACK, best and the start line; Space starts a run', () => {
    const stub = stubStack();
    stub.game.storage.set('best', 12);
    const title = new TitleScene(stub.game);
    const ctx = stubCtx();
    title.render(ctx);
    const texts = (ctx.calls.fillText ?? []).map(([t]) => t);
    expect(texts).toEqual(expect.arrayContaining(['STACK', 'Best: 12', 'Click, press Space or tap to start', 'All games']));
    stub.press(' ');
    title.update(DT);
    expect(stub.scenes[0]).toBeInstanceOf(PlayScene);
  });

  test('"All games" navigates to the picker', () => {
    const stub = stubStack();
    const title = new TitleScene(stub.game);
    const urls: string[] = [];
    title.navigate = (u) => urls.push(u);
    stub.tap(50, 24);
    title.update(DT);
    expect(urls).toEqual(['../']);
    expect(stub.scenes).toHaveLength(0);
  });
});
