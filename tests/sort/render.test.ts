import { expect, test } from 'vitest';
import type { Board } from '../../games/sort/sim/board.ts';
import { COLORS, drawScene, GLASS_EDGE, type SceneModel, SYMBOL_INK, SYMBOL_INK_LIGHT, SYMBOLS } from '../../games/sort/render/draw.ts';
import { layoutTubes } from '../../games/sort/render/layout.ts';
import { stubCtx } from '../squad/stubCtx.ts';

const board: Board = { tubes: [[0, 1, 2, 0], [1, 2, 0, 1], [2, 0, 1, 2], [], []] };

function model(over: Partial<SceneModel> = {}): SceneModel {
  return {
    board,
    rects: layoutTubes(board.tubes.length, 1280, 800),
    view: { w: 1280, h: 800 },
    lifted: null,
    pour: null,
    symbols: true,
    level: 3,
    time: 0,
    stuck: false,
    celebrating: null,
    shake: 0,
    ...over,
  };
}

const writes = (ctx: ReturnType<typeof stubCtx>, prop: string, value: string) =>
  (ctx.calls[`=${prop}`] ?? []).filter(([v]) => v === value).length;
const texts = (ctx: ReturnType<typeof stubCtx>) => (ctx.calls.fillText ?? []).map(([t]) => t);

test('there are 10 clearly distinct colours, each with its own symbol', () => {
  expect(COLORS).toHaveLength(10);
  expect(SYMBOLS).toHaveLength(10);
  expect(new Set(COLORS).size).toBe(10);
  expect(new Set(SYMBOLS).size).toBe(10);
  expect(COLORS.slice(0, 6)).toEqual(['#E04040', '#F5C242', '#3CC85A', '#2F7DE1', '#9B59D0', '#FF8A1F']);
});

test('draws one glass outline per tube', () => {
  const ctx = stubCtx();
  drawScene(ctx, model());
  expect(writes(ctx, 'strokeStyle', GLASS_EDGE)).toBe(5);
});

const inks = (ctx: ReturnType<typeof stubCtx>) => writes(ctx, 'fillStyle', SYMBOL_INK) + writes(ctx, 'fillStyle', SYMBOL_INK_LIGHT);

test('draws one symbol per layer when symbols are on, and none when off', () => {
  const on = stubCtx();
  drawScene(on, model({ symbols: true }));
  expect(inks(on)).toBe(12);
  const off = stubCtx();
  drawScene(off, model({ symbols: false }));
  expect(inks(off)).toBe(0);
});

test('dark colours get light symbols so they stay readable', () => {
  const ctx = stubCtx();
  drawScene(ctx, model({ board: { tubes: [[3, 4, 9, 0], [], []] }, rects: layoutTubes(3, 1280, 800) }));
  expect(writes(ctx, 'fillStyle', SYMBOL_INK_LIGHT)).toBe(3);
  expect(writes(ctx, 'fillStyle', SYMBOL_INK)).toBe(1);
});

test('fills each run of a colour in that colour', () => {
  const ctx = stubCtx();
  drawScene(ctx, model());
  for (const c of [0, 1, 2]) expect(writes(ctx, 'fillStyle', COLORS[c]!)).toBe(4);
});

test('a run of one colour is one fill, with no seams', () => {
  const ctx = stubCtx();
  drawScene(ctx, model({ board: { tubes: [[0, 0, 0, 1], [1, 1, 1, 0], []] }, rects: layoutTubes(3, 1280, 800) }));
  expect(writes(ctx, 'fillStyle', COLORS[0]!)).toBe(2);
  expect(writes(ctx, 'fillStyle', COLORS[1]!)).toBe(2);
});

test('on a narrow phone the level sits below the corner buttons, inside the HUD band', () => {
  const ctx = stubCtx();
  drawScene(ctx, model({ view: { w: 390, h: 844 }, rects: layoutTubes(5, 390, 844), level: 100 }));
  const level = (ctx.calls.fillText ?? []).find(([t]) => t === 'Level 100');
  expect(level![2] as number).toBeGreaterThan(44);
  expect(level![2] as number).toBeLessThan(70);
});

test('shows the level number at the top', () => {
  const ctx = stubCtx();
  drawScene(ctx, model({ level: 17 }));
  const level = (ctx.calls.fillText ?? []).find(([t]) => t === 'Level 17');
  expect(level).toBeDefined();
  expect(level![2] as number).toBeLessThan(70);
});

test('shows the undo and restart buttons', () => {
  const ctx = stubCtx();
  drawScene(ctx, model());
  expect(texts(ctx)).toEqual(expect.arrayContaining(['Undo', 'Restart']));
});

test('the "No moves left" card shows only when stuck', () => {
  const calm = stubCtx();
  drawScene(calm, model());
  expect(texts(calm)).not.toContain('No moves left');
  const stuck = stubCtx();
  drawScene(stuck, model({ stuck: true }));
  expect(texts(stuck)).toContain('No moves left');
});

test('a level clear celebrates', () => {
  const ctx = stubCtx();
  drawScene(ctx, model({ celebrating: 0.5 }));
  expect(texts(ctx).some((t) => typeof t === 'string' && t.includes('clear'))).toBe(true);
});

test('a pour mid-flow still draws every tube and a stream between them', () => {
  const after: Board = { tubes: [[0, 1, 2], [1, 2, 0, 1], [2, 0, 1, 2], [0], []] };
  const ctx = stubCtx();
  drawScene(ctx, model({ board: after, pour: { from: 0, to: 3, color: 0, moved: 1, t: 0.5 } }));
  expect(writes(ctx, 'strokeStyle', GLASS_EDGE)).toBe(5);
  expect(ctx.calls.rotate?.length ?? 0).toBeGreaterThan(0);
});
