import { describe, expect, test } from 'vitest';
import { controlRects } from '../../engine/controls.ts';
import type { Scene } from '../../engine/scenes.ts';
import { createStorage } from '../../engine/storage.ts';
import { loadLevel, SORT_STORAGE, type SortGame } from '../../games/sort/game.ts';
import { buttonRects, layoutTubes, symbolsRect } from '../../games/sort/render/layout.ts';
import { PlayScene } from '../../games/sort/scenes/play.ts';
import { type Board, CAPACITY, colorCounts } from '../../games/sort/sim/board.ts';
import { generateLevel } from '../../games/sort/sim/levels.ts';
import { solve } from '../../games/sort/sim/solver.ts';
import { stubCtx } from '../squad/stubCtx.ts';

const DT = 1 / 60;

function memoryBackend(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

function stubSort(backend: Parameters<typeof createStorage>[1] = memoryBackend(), view = { w: 1280, h: 800 }) {
  const keys = new Set<string>();
  let click: { x: number; y: number } | null = null;
  const sounds: string[] = [];
  const scenes: Scene[] = [];
  const game = {
    stack: { replace: (s: Scene) => scenes.push(s) },
    input: {
      touch: false,
      consumeKey: (k: string) => keys.delete(k.toLowerCase()),
      consumeClick: () => {
        const c = click;
        click = null;
        return c;
      },
    },
    audio: { muted: false, play: (sfx: string) => sounds.push(sfx), unlock: () => undefined },
    storage: createStorage(SORT_STORAGE, backend),
    view,
    symbols: true,
  };
  const g = game as unknown as SortGame;
  const centre = (i: number, scene: PlayScene) => {
    const r = layoutTubes(scene.board.tubes.length, g.view.w, g.view.h)[i]!;
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  };
  return {
    game: g,
    sounds,
    scenes,
    press(k: string, scene: PlayScene) {
      keys.add(k);
      scene.update(DT);
    },
    tap(x: number, y: number, scene: PlayScene, dt = DT) {
      click = { x, y };
      scene.update(dt);
    },
    tapTube(i: number, scene: PlayScene) {
      const c = centre(i, scene);
      click = c;
      scene.update(DT);
    },
    run(scene: PlayScene, seconds: number) {
      for (let t = 0; t < seconds; t += DT) scene.update(DT);
    },
  };
}

// Puts a chosen position on the board, as if the player had reached it.
const setBoard = (scene: PlayScene, board: Board) => {
  (scene as unknown as { current: Board }).current = board;
};

const pourBy = (stub: ReturnType<typeof stubSort>, scene: PlayScene, from: number, to: number) => {
  stub.tapTube(from, scene);
  stub.tapTube(to, scene);
};

// One pour (tube 4 onto tube 3) away from a position with no legal moves.
const NEARLY_STUCK: Board = { tubes: [[2, 0, 0, 3], [2, 0, 3, 3], [1, 2, 3, 2], [1], [1, 0, 1]] };

describe('loadLevel', () => {
  test('reads the saved level', () => {
    expect(loadLevel(createStorage(SORT_STORAGE, memoryBackend({ 'hypercaz.sort.level': '7' })))).toBe(7);
  });
  test.each([['"abc"'], ['-5'], ['0'], ['null'], ['abc'], ['1e999']])('junk %s gives level 1', (raw) => {
    expect(loadLevel(createStorage(SORT_STORAGE, memoryBackend({ 'hypercaz.sort.level': raw })))).toBe(1);
  });
  test('a fraction is floored', () => {
    expect(loadLevel(createStorage(SORT_STORAGE, memoryBackend({ 'hypercaz.sort.level': '2.5' })))).toBe(2);
  });
  test('a huge level is kept', () => {
    expect(loadLevel(createStorage(SORT_STORAGE, memoryBackend({ 'hypercaz.sort.level': '1000000000' })))).toBe(1e9);
  });
  test('null storage starts at level 1', () => {
    expect(loadLevel(createStorage(SORT_STORAGE, null))).toBe(1);
  });
});

test('the scene plays the level it is given', () => {
  const { game } = stubSort();
  const scene = new PlayScene(game, 4);
  expect(scene.level).toBe(4);
  expect(scene.board).toEqual(generateLevel(4));
});

test('a click on a tube lifts it; the same tube or empty space puts it down', () => {
  const stub = stubSort();
  const scene = new PlayScene(stub.game, 1);
  stub.tapTube(0, scene);
  expect(scene.lifted).toBe(0);
  stub.tapTube(0, scene);
  expect(scene.lifted).toBeNull();
  stub.tapTube(1, scene);
  expect(scene.lifted).toBe(1);
  stub.tap(30, 400, scene);
  expect(scene.lifted).toBeNull();
});

test('lifting then clicking another tube pours into it and plays the pour sound', () => {
  const stub = stubSort();
  const scene = new PlayScene(stub.game, 1);
  const before = scene.board;
  const spare = before.tubes.length - 1; // the spares are last and empty
  pourBy(stub, scene, 0, spare);
  expect(scene.lifted).toBeNull();
  const top = before.tubes[0]!.at(-1)!;
  expect(scene.board.tubes[spare]!.at(-1)).toBe(top);
  expect(scene.board.tubes[0]!.length).toBeLessThan(4);
  expect(stub.sounds).toContain('pour');
});

test('an illegal pour shakes the lifted tube, which stays lifted, and changes nothing', () => {
  const stub = stubSort();
  const scene = new PlayScene(stub.game, 1);
  setBoard(scene, { tubes: [[0, 1, 2, 0], [1, 2, 0, 1], [2, 0, 1, 2], [], []] });
  const before = scene.board;
  pourBy(stub, scene, 0, 1); // 0 onto 1: different colours
  expect(scene.lifted).toBe(0);
  expect(scene.board).toBe(before);
  expect(scene.shaking).toBe(true);
  stub.run(scene, 1);
  expect(scene.shaking).toBe(false);
  expect(scene.lifted).toBe(0);
});

test('a tube that becomes done plays the fill chime as the liquid lands', () => {
  const stub = stubSort();
  const scene = new PlayScene(stub.game, 1);
  setBoard(scene, { tubes: [[0, 0, 0], [0], [1, 2, 1, 2], [2, 1, 2, 1], []] });
  pourBy(stub, scene, 1, 0);
  expect(stub.sounds).toEqual(['pour']);
  stub.run(scene, 0.5);
  expect(stub.sounds).toEqual(['pour', 'fill']);
  expect(scene.celebrating).toBe(false);
});

test('the winning pour plays the pour, the chime and the clear flourish', () => {
  const stub = stubSort();
  const scene = new PlayScene(stub.game, 1);
  setBoard(scene, { tubes: [[0, 0, 0], [0], [1, 1, 1, 1], [2, 2, 2, 2], []] });
  pourBy(stub, scene, 1, 0);
  stub.run(scene, 0.5);
  expect(stub.sounds).toEqual(['pour', 'fill', 'clear']);
});

describe('undo and restart', () => {
  test('undo restores the previous board exactly, and repeated undo stops at the start', () => {
    const stub = stubSort();
    const scene = new PlayScene(stub.game, 1);
    const start = scene.board;
    const spare = start.tubes.length - 1;
    pourBy(stub, scene, 0, spare);
    const afterOne = scene.board;
    pourBy(stub, scene, 1, spare - 1);
    expect(scene.board).not.toEqual(afterOne);
    stub.press('z', scene);
    expect(scene.board).toEqual(afterOne);
    stub.press('backspace', scene);
    expect(scene.board).toEqual(start);
    stub.press('z', scene);
    stub.press('z', scene);
    expect(scene.board).toEqual(start);
  });

  test('the undo button undoes', () => {
    const stub = stubSort();
    const scene = new PlayScene(stub.game, 1);
    const start = scene.board;
    pourBy(stub, scene, 0, start.tubes.length - 1);
    const { undo } = buttonRects(1280, 800);
    stub.tap(undo.x + undo.w / 2, undo.y + undo.h / 2, scene);
    expect(scene.board).toEqual(start);
  });

  test('restart (R or the button) gives generateLevel(n) and clears the history', () => {
    const stub = stubSort();
    const scene = new PlayScene(stub.game, 3);
    const spare = scene.board.tubes.length - 1;
    pourBy(stub, scene, 0, spare);
    stub.press('r', scene);
    expect(scene.board).toEqual(generateLevel(3));
    stub.press('z', scene);
    expect(scene.board).toEqual(generateLevel(3));
    pourBy(stub, scene, 0, spare);
    const { restart } = buttonRects(1280, 800);
    stub.tap(restart.x + restart.w / 2, restart.y + restart.h / 2, scene);
    expect(scene.board).toEqual(generateLevel(3));
  });

  test('undo puts a lifted tube down', () => {
    const stub = stubSort();
    const scene = new PlayScene(stub.game, 1);
    pourBy(stub, scene, 0, scene.board.tubes.length - 1);
    stub.tapTube(1, scene);
    stub.press('z', scene);
    expect(scene.lifted).toBeNull();
  });
});

// Plays level n to the end with real clicks, using the solver's moves.
function playToWin(stub: ReturnType<typeof stubSort>, scene: PlayScene): void {
  const moves = solve(scene.board)!;
  for (const m of moves) pourBy(stub, scene, m.from, m.to);
}

describe('winning', () => {
  test('saves n + 1 at once, plays the clear flourish and moves on after the celebration', () => {
    const stub = stubSort();
    const scene = new PlayScene(stub.game, 2);
    playToWin(stub, scene);
    expect(scene.celebrating).toBe(true);
    expect(stub.game.storage.get('level', 0)).toBe(3);
    stub.run(scene, 0.5);
    expect(stub.sounds).toContain('clear');
    expect(stub.scenes).toHaveLength(0);
    stub.run(scene, 1.1);
    expect(stub.scenes).toHaveLength(1);
    expect((stub.scenes[0] as PlayScene).level).toBe(3);
  });

  test('a click skips the celebration', () => {
    const stub = stubSort();
    const scene = new PlayScene(stub.game, 1);
    playToWin(stub, scene);
    stub.tap(640, 400, scene);
    expect(stub.scenes).toHaveLength(1);
    expect((stub.scenes[0] as PlayScene).level).toBe(2);
  });

  test('a click before the liquid lands still plays the clear flourish', () => {
    const stub = stubSort();
    const scene = new PlayScene(stub.game, 1);
    playToWin(stub, scene);
    expect(stub.sounds).not.toContain('clear');
    stub.tap(640, 400, scene);
    expect(stub.sounds).toContain('clear');
    expect(stub.scenes).toHaveLength(1);
  });

  test('Review Focus 4: Z and R during the celebration neither undo the win nor skip a level twice', () => {
    const stub = stubSort();
    const scene = new PlayScene(stub.game, 5);
    playToWin(stub, scene);
    const won = scene.board;
    stub.press('z', scene);
    stub.press('r', scene);
    stub.press('backspace', scene);
    expect(scene.board).toBe(won);
    const { undo, restart } = buttonRects(1280, 800);
    stub.tap(undo.x + 5, undo.y + 5, scene); // skips, once
    stub.tap(restart.x + 5, restart.y + 5, scene);
    stub.run(scene, 2);
    expect(stub.scenes).toHaveLength(1);
    expect(stub.game.storage.get('level', 0)).toBe(6);
    expect((stub.scenes[0] as PlayScene).level).toBe(6);
  });

  test('without any clicks, the scene is replaced exactly once', () => {
    const stub = stubSort();
    const scene = new PlayScene(stub.game, 1);
    playToWin(stub, scene);
    stub.run(scene, 3);
    expect(stub.scenes).toHaveLength(1);
  });

  test('null storage starts at level 1 and still plays and wins', () => {
    const stub = stubSort(null);
    const scene = new PlayScene(stub.game, loadLevel(stub.game.storage));
    expect(scene.level).toBe(1);
    playToWin(stub, scene);
    expect(scene.celebrating).toBe(true);
  });
});

describe('stuck', () => {
  test('Review Focus 5: no legal moves shows the card; undo clears it', () => {
    const stub = stubSort();
    const scene = new PlayScene(stub.game, 1);
    setBoard(scene, NEARLY_STUCK);
    expect(scene.stuck).toBe(false);
    pourBy(stub, scene, 4, 3);
    expect(scene.stuck).toBe(true);
    const ctx = stubCtx();
    scene.render(ctx);
    expect((ctx.calls.fillText ?? []).map(([t]) => t)).toContain('No moves left');
    stub.press('z', scene);
    expect(scene.stuck).toBe(false);
    expect(scene.board).toEqual(NEARLY_STUCK);
  });

  test('restart clears it too', () => {
    const stub = stubSort();
    const scene = new PlayScene(stub.game, 1);
    setBoard(scene, NEARLY_STUCK);
    pourBy(stub, scene, 4, 3);
    expect(scene.stuck).toBe(true);
    const { restart } = buttonRects(1280, 800);
    stub.tap(restart.x + restart.w / 2, restart.y + restart.h / 2, scene);
    expect(scene.stuck).toBe(false);
  });
});

test('Review Focus 1: after a resize the tubes re-lay out, a lifted tube stays lifted, and clicks hit the new positions', () => {
  const stub = stubSort();
  const scene = new PlayScene(stub.game, 40); // 10 colours, 12 tubes
  stub.tapTube(2, scene);
  expect(scene.lifted).toBe(2);
  stub.game.view = { w: 390, h: 844 };
  scene.update(DT);
  expect(scene.lifted).toBe(2);
  stub.tapTube(2, scene); // its new centre puts it down
  expect(scene.lifted).toBeNull();
  stub.tapTube(7, scene);
  expect(scene.lifted).toBe(7);
});

test('Review Focus 2: 30 random clicks across 0.5 s with pours in flight keep the board valid', () => {
  const stub = stubSort();
  const scene = new PlayScene(stub.game, 40);
  const n = scene.board.tubes.length;
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let i = 0; i < 30; i++) {
    const r = layoutTubes(n, 1280, 800)[Math.floor(rand() * n)]!;
    stub.tap(r.x + rand() * r.w, r.y + rand() * r.h, scene, 0.5 / 30);
  }
  expect(stub.sounds.filter((s) => s === 'pour').length).toBeGreaterThanOrEqual(2); // so one landed mid-flight
  // nothing gained or lost: the same layers as level 40 starts with
  expect(colorCounts(scene.board)).toEqual(colorCounts(generateLevel(40)));
  for (const t of scene.board.tubes) expect(t.length).toBeLessThanOrEqual(CAPACITY);
});

describe('controls', () => {
  test('Esc pauses and a click resumes; nothing moves while paused', () => {
    const stub = stubSort();
    const scene = new PlayScene(stub.game, 1);
    stub.press('escape', scene);
    expect(scene.paused).toBe(true);
    stub.tapTube(0, scene);
    expect(scene.paused).toBe(false);
    expect(scene.lifted).toBeNull();
  });

  test('the pause button pauses, and the paused overlay is drawn', () => {
    const stub = stubSort();
    const scene = new PlayScene(stub.game, 1);
    const { pause } = controlRects(1280);
    stub.tap(pause.x + 20, pause.y + 20, scene);
    expect(scene.paused).toBe(true);
    const ctx = stubCtx();
    scene.render(ctx);
    expect((ctx.calls.fillText ?? []).map(([t]) => t)).toContain('Paused');
  });

  test('suspending pauses', () => {
    const stub = stubSort();
    const scene = new PlayScene(stub.game, 1);
    scene.suspend();
    expect(scene.paused).toBe(true);
  });

  test('M and the mute button (at the window width) mute and save it', () => {
    const stub = stubSort();
    const scene = new PlayScene(stub.game, 1);
    stub.press('m', scene);
    expect(stub.game.audio.muted).toBe(true);
    expect(stub.game.storage.get('muted', false)).toBe(true);
    const { mute } = controlRects(1280);
    stub.tap(mute.x + 20, mute.y + 20, scene);
    expect(stub.game.audio.muted).toBe(false);
  });

  test('S and the symbols button toggle the symbols and save the setting', () => {
    const stub = stubSort();
    const scene = new PlayScene(stub.game, 1);
    stub.press('s', scene);
    expect(stub.game.symbols).toBe(false);
    expect(stub.game.storage.get('symbols', true)).toBe(false);
    const r = symbolsRect(1280);
    stub.tap(r.x + r.w / 2, r.y + r.h / 2, scene);
    expect(stub.game.symbols).toBe(true);
    expect(stub.game.storage.get('symbols', false)).toBe(true);
  });

  test('the symbols button sits left of pause without overlapping it', () => {
    const r = symbolsRect(390);
    expect(r.x + r.w).toBeLessThanOrEqual(controlRects(390).pause.x);
  });

  test('"All games" goes back to the picker', () => {
    const stub = stubSort();
    const scene = new PlayScene(stub.game, 1);
    let went = '';
    scene.navigate = (url) => {
      went = url;
    };
    const { allGames } = controlRects(1280);
    stub.tap(allGames.x + 10, allGames.y + 10, scene);
    expect(went).toBe('../');
  });
});

test('render draws a pour mid-animation without throwing', () => {
  const stub = stubSort();
  const scene = new PlayScene(stub.game, 1);
  pourBy(stub, scene, 0, scene.board.tubes.length - 1);
  stub.run(scene, 0.2);
  const ctx = stubCtx();
  expect(() => scene.render(ctx)).not.toThrow();
  expect(ctx.calls.rotate?.length ?? 0).toBeGreaterThan(0);
});
