import { describe, expect, test } from 'vitest';
import type { Scene } from '../../engine/scenes.ts';
import { createStorage } from '../../engine/storage.ts';
import type { BlastGame } from '../../games/blast/game.ts';
import { BAY, CELL, TOUCH_LIFT, traySlotCentre } from '../../games/blast/render/layout.ts';
import { PlayScene } from '../../games/blast/scenes/play.ts';
import { type Board, emptyBoard, SIZE } from '../../games/blast/sim/board.ts';
import { type Piece, pieceById, PIECES } from '../../games/blast/sim/pieces.ts';
import type { BlastState } from '../../games/blast/sim/state.ts';
import { stubCtx } from '../squad/stubCtx.ts';
import { DIAGONAL } from './helpers.ts';

const DT = 1 / 60;
const p = pieceById;
const single = () => p('1x1');

export function stubBlast(backend: Parameters<typeof createStorage>[1] = null) {
  const keys = new Set<string>();
  let click: { x: number; y: number } | null = null;
  const releases: { x: number; y: number }[] = [];
  const sounds: { sfx: string; pitch: number | undefined }[] = [];
  const scenes: Scene[] = [];
  const input = {
    touch: false,
    pointerX: null as number | null,
    pointerY: null as number | null,
    held: false,
    consumeKey: (k: string) => keys.delete(k.toLowerCase()),
    consumeClick: () => {
      const c = click;
      click = null;
      return c;
    },
    consumeRelease: () => releases.shift() ?? null,
    isDown: () => false,
  };
  const game = {
    stack: { replace: (s: Scene) => scenes.push(s) },
    input,
    audio: { muted: false, play: (sfx: string, pitch?: number) => sounds.push({ sfx, pitch }), unlock: () => undefined },
    storage: createStorage('test', backend),
    time: 0,
  };
  const at = (x: number, y: number) => {
    input.pointerX = x;
    input.pointerY = y;
  };
  return {
    game: game as unknown as BlastGame,
    input,
    sounds,
    scenes,
    press: (k: string) => keys.add(k.toLowerCase()),
    tap: (x: number, y: number) => {
      click = { x, y };
    },
    down: (x: number, y: number) => {
      at(x, y);
      input.held = true;
      click = { x, y };
    },
    move: at,
    up: (x: number, y: number) => {
      at(x, y);
      input.held = false;
      releases.push({ x, y });
    },
  };
}

type Stub = ReturnType<typeof stubBlast>;
const stateOf = (s: PlayScene) => (s as unknown as { state: BlastState }).state;

function setup(board: Board, hand: (Piece | null)[], stub: Stub = stubBlast()) {
  const scene = new PlayScene(stub.game, 1);
  const st = stateOf(scene);
  st.board = board;
  st.hand = hand;
  return { scene, st, ...stub };
}

// The pointer position that centres a piece on the cell (col, row).
const pointFor = (piece: Piece, col: number, row: number) => ({ x: BAY.x + col * CELL + (piece.w * CELL) / 2, y: BAY.y + row * CELL + (piece.h * CELL) / 2 });

// Picks slot up from the tray, drags it to (x, y) and lets go there.
function drag(t: ReturnType<typeof setup>, slot: number, x: number, y: number): void {
  const from = traySlotCentre(slot);
  t.down(from.x, from.y);
  t.scene.update(DT);
  t.move(x, y);
  t.scene.update(DT);
  t.up(x, y);
  t.scene.update(DT);
}

// Places a slot with the keyboard: its number, arrows, then Enter.
function keyPlace(t: ReturnType<typeof setup>, slot: number, col: number, row: number): void {
  const steps = [String(slot + 1), ...Array<string>(col).fill('ArrowRight'), ...Array<string>(row).fill('ArrowDown'), 'Enter'];
  for (const k of steps) {
    t.press(k);
    t.scene.update(DT);
  }
}

const cellsOf = (b: Board) => [...b.keys()].filter((i) => b[i] !== 0);
const texts = (ctx: ReturnType<typeof stubCtx>) => (ctx.calls.fillText ?? []).map(([s]) => s);

describe('dragging', () => {
  test('drag and release places at the snapped cell', () => {
    const t = setup(emptyBoard(), [p('sq2'), single(), single()]);
    const at = pointFor(p('sq2'), 3, 3);
    drag(t, 0, at.x, at.y);
    const st = stateOf(t.scene);
    expect(cellsOf(st.board)).toEqual([3 * SIZE + 3, 3 * SIZE + 4, 4 * SIZE + 3, 4 * SIZE + 4]);
    expect(st.hand[0]).toBeNull();
    expect(t.sounds.map((s) => s.sfx)).toContain('place');
  });

  test('a release off the bay returns the piece', () => {
    const t = setup(emptyBoard(), [p('sq2'), single(), single()]);
    drag(t, 0, 270, 120);
    drag(t, 0, -50, 500);
    expect(t.st.hand[0]?.id).toBe('sq2');
    expect(cellsOf(stateOf(t.scene).board)).toEqual([]);
  });

  test("a release where it doesn't fit returns the piece", () => {
    const b = emptyBoard();
    b[4 * SIZE + 4] = 1;
    const t = setup(b, [p('sq2'), single(), single()]);
    const at = pointFor(p('sq2'), 3, 3);
    drag(t, 0, at.x, at.y);
    expect(t.st.hand[0]?.id).toBe('sq2');
    expect(cellsOf(stateOf(t.scene).board)).toEqual([4 * SIZE + 4]);
  });

  test('touch lifts the piece above the finger', () => {
    const t = setup(emptyBoard(), [p('sq2'), single(), single()]);
    t.input.touch = true;
    const at = pointFor(p('sq2'), 3, 3);
    drag(t, 0, at.x, at.y + TOUCH_LIFT);
    expect(cellsOf(stateOf(t.scene).board)).toEqual([3 * SIZE + 3, 3 * SIZE + 4, 4 * SIZE + 3, 4 * SIZE + 4]);
  });

  test('while dragging over a fitting cell, the ghost and the lines it completes are shown', () => {
    const b = emptyBoard();
    for (let c = 1; c < SIZE; c++) b[c] = 1;
    b[7 * SIZE + 7] = 1;
    const t = setup(b, [single(), single(), single()]);
    const from = traySlotCentre(0);
    t.down(from.x, from.y);
    t.scene.update(DT);
    const at = pointFor(single(), 0, 0);
    t.move(at.x, at.y);
    t.scene.update(DT);
    const view = (t.scene as unknown as { dragView(): { ghost: unknown; glow: unknown } | null }).dragView();
    expect(view?.ghost).toEqual({ col: 0, row: 0 });
    expect(view?.glow).toEqual({ rows: [0], cols: [] });
  });

  test('a press on a button does not pick up a piece', () => {
    for (const [x, y] of [[480, 24], [512, 24], [60, 24]] as const) {
      const t = setup(emptyBoard(), [p('sq2'), single(), single()]);
      t.scene.navigate = () => undefined;
      t.down(x, y);
      t.scene.update(DT);
      expect((t.scene as unknown as { drag: unknown }).drag).toBeNull();
    }
    const t = setup(emptyBoard(), [p('sq2'), single(), single()]);
    t.down(480, 24);
    t.scene.update(DT);
    const ctx = stubCtx();
    t.scene.render(ctx);
    expect(texts(ctx)).toContain('Paused');
  });

  test('suspend mid-drag cancels the drag and pauses', () => {
    const t = setup(emptyBoard(), [p('sq2'), single(), single()]);
    const from = traySlotCentre(0);
    t.down(from.x, from.y);
    t.scene.update(DT);
    t.scene.suspend();
    expect((t.scene as unknown as { drag: unknown }).drag).toBeNull();
    const ctx = stubCtx();
    t.scene.render(ctx);
    expect(texts(ctx)).toContain('Paused');
    // Back on the tab: the resume tap does not pick anything up, and a later
    // release over the bay places nothing.
    t.tap(270, 500);
    t.scene.update(DT);
    const at = pointFor(p('sq2'), 3, 3);
    t.up(at.x, at.y);
    t.scene.update(DT);
    expect(cellsOf(stateOf(t.scene).board)).toEqual([]);
  });
});

describe('keyboard', () => {
  test('a number, arrows and Enter place a piece', () => {
    const t = setup(emptyBoard(), [single(), p('h2'), single()]);
    keyPlace(t, 1, 2, 0);
    expect(t.st.hand[1]).toBeNull();
    expect(cellsOf(stateOf(t.scene).board)).toEqual([2, 3]);
  });

  test('arrows keep the piece on the bay', () => {
    const t = setup(emptyBoard(), [p('h5'), single(), single()]);
    keyPlace(t, 0, 9, 9);
    expect(cellsOf(stateOf(t.scene).board)).toEqual([7 * SIZE + 3, 7 * SIZE + 4, 7 * SIZE + 5, 7 * SIZE + 6, 7 * SIZE + 7]);
  });

  test('Esc while holding puts it back; Esc with nothing held pauses', () => {
    const t = setup(emptyBoard(), [single(), single(), single()]);
    t.press('1');
    t.scene.update(DT);
    t.press('Escape');
    t.scene.update(DT);
    expect((t.scene as unknown as { drag: unknown }).drag).toBeNull();
    const ctx = stubCtx();
    t.scene.render(ctx);
    expect(texts(ctx)).not.toContain('Paused');
    t.press('Escape');
    t.scene.update(DT);
    const paused = stubCtx();
    t.scene.render(paused);
    expect(texts(paused)).toContain('Paused');
  });
});

describe('feedback', () => {
  test('clears play the clear sound, pitched up with the streak', () => {
    const b = emptyBoard();
    for (let c = 1; c < SIZE; c++) b[c] = 1;
    b[7 * SIZE + 7] = 1;
    const t = setup(b, [single(), single(), single()]);
    keyPlace(t, 0, 0, 0); // clears row 0
    keyPlace(t, 1, 0, 0);
    keyPlace(t, 2, 1, 0);
    const st = stateOf(t.scene);
    for (let c = 1; c < SIZE; c++) st.board[SIZE + c] = 1;
    st.hand = [single(), single(), single()];
    keyPlace(t, 0, 0, 1); // clears row 1, in the next hand
    const clears = t.sounds.filter((s) => s.sfx === 'clear');
    expect(clears).toHaveLength(2);
    expect(clears[1]!.pitch!).toBeGreaterThan(clears[0]!.pitch!);
    const ctx = stubCtx();
    t.scene.render(ctx);
    expect(texts(ctx).some((s) => String(s).includes('×2'))).toBe(true);
  });

  test('an empty bay plays the fanfare and shows the banner', () => {
    const b = emptyBoard();
    for (let c = 1; c < SIZE; c++) b[c] = 1;
    const t = setup(b, [single(), single(), single()]);
    keyPlace(t, 0, 0, 0);
    expect(t.sounds.map((s) => s.sfx)).toContain('win');
    const ctx = stubCtx();
    t.scene.render(ctx);
    expect(texts(ctx)).toContain('EMPTY BAY! +500');
  });

  test('cleared crates sweep away and draw without throwing', () => {
    const b = emptyBoard();
    for (let c = 1; c < SIZE; c++) b[c] = PIECES.length;
    b[7 * SIZE + 7] = 1;
    const t = setup(b, [single(), single(), single()]);
    keyPlace(t, 0, 0, 0);
    for (let i = 0; i < 30; i++) {
      t.scene.update(DT);
      t.scene.render(stubCtx());
    }
  });
});

describe('game over', () => {
  function jam(stub: Stub = stubBlast()) {
    const t = setup(DIAGONAL, [single(), p('sq3'), p('sq3')], stub);
    keyPlace(t, 0, 0, 0);
    return t;
  }

  test('a jam plays fail, saves a new best and shows game over', () => {
    const backend = new Map<string, string>();
    const t = jam(stubBlast({ getItem: (k) => backend.get(k) ?? null, setItem: (k, v) => void backend.set(k, v) }));
    expect(stateOf(t.scene).phase).toBe('over');
    expect(t.sounds.map((s) => s.sfx)).toContain('fail');
    expect(backend.get('test.best')).toBe(String(stateOf(t.scene).score));
    t.tap(270, 500);
    t.scene.update(DT);
    expect(t.scenes).toHaveLength(0); // too soon: a frantic extra tap must not restart
    for (let i = 0; i < 120; i++) t.scene.update(DT);
    const ctx = stubCtx();
    t.scene.render(ctx);
    expect(texts(ctx)).toEqual(expect.arrayContaining(['Game over', 'New best!']));
    t.tap(270, 500);
    t.scene.update(DT);
    expect(t.scenes[0]).toBeInstanceOf(PlayScene);
  });

  test('"All games" goes back to the picker', () => {
    const t = jam();
    const urls: string[] = [];
    t.scene.navigate = (u) => urls.push(u);
    for (let i = 0; i < 120; i++) t.scene.update(DT);
    t.tap(60, 24);
    t.scene.update(DT);
    expect(urls).toEqual(['../']);
  });

  test('a lower score does not overwrite the best', () => {
    const backend = new Map<string, string>([['test.best', '9999']]);
    jam(stubBlast({ getItem: (k) => backend.get(k) ?? null, setItem: (k, v) => void backend.set(k, v) }));
    expect(backend.get('test.best')).toBe('9999');
  });
});

test('M mutes', () => {
  const t = setup(emptyBoard(), [single(), single(), single()]);
  t.press('m');
  t.scene.update(DT);
  expect(t.game.audio.muted).toBe(true);
});
