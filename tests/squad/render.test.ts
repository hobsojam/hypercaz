import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { AssetStore, parseManifest } from '../../engine/assets.ts';
import { DEFAULT_VIEW, project } from '../../engine/perspective.ts';
import { drawRoad, renderGame } from '../../games/squad/render/draw.ts';
import { SquadView } from '../../games/squad/render/squadView.ts';
import { botInput } from '../../games/squad/sim/bot.ts';
import { formationSlots } from '../../games/squad/sim/formation.ts';
import { validateLevel } from '../../games/squad/sim/level.ts';
import { createState } from '../../games/squad/sim/state.ts';
import { step } from '../../games/squad/sim/step.ts';
import { makeLevel } from './fixtures.ts';

// A canvas context that accepts every call and property write, recording each
// call's arguments by method name.
function stubCtx() {
  const calls: Record<string, unknown[][]> = {};
  const proxy: object = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'calls') return calls;
        return (...args: unknown[]) => {
          (calls[String(prop)] ??= []).push(args);
          return proxy;
        };
      },
      set: () => true,
    },
  );
  return proxy as CanvasRenderingContext2D & { calls: Record<string, unknown[][]> };
}

const root = join(import.meta.dirname, '../..');
const assets = AssetStore.fromManifest(parseManifest(JSON.parse(readFileSync(join(root, 'games/squad/assets/manifest.json'), 'utf8'))));

test('renders a whole bot run of level 1 without throwing', () => {
  const level = validateLevel(JSON.parse(readFileSync(join(root, 'games/squad/levels/01.json'), 'utf8')), '01.json');
  const state = createState(level, 1);
  const ctx = stubCtx();
  const squadView = new SquadView();
  let frames = 0;
  for (let i = 0; i < 60 * 300 && state.phase !== 'won' && state.phase !== 'lost'; i++) {
    step(state, botInput(state), 1 / 60);
    squadView.update(formationSlots(state.squad.count), 1 / 60);
    if (i % 10 === 0) {
      renderGame(ctx, state, { persp: DEFAULT_VIEW, assets, time: state.time, squadView, shake: { x: 0, y: 0 } });
      frames++;
    }
  }
  expect(state.phase).toBe('won');
  expect(frames).toBeGreaterThan(100);
  const drawn = ['fillRect', 'fill', 'drawImage'].reduce((n, m) => n + (ctx.calls[m]?.length ?? 0), 0);
  expect(drawn).toBeGreaterThan(0);
});

test('squad view eases displayed slots to their targets', () => {
  const view = new SquadView();
  const slots = formationSlots(12);
  for (let i = 0; i < 60; i++) view.update(slots, 1 / 60);
  expect(view.positions).toHaveLength(12);
  view.positions.forEach((p, i) => {
    expect(Math.abs(p.dx - slots[i].dx)).toBeLessThan(0.01);
    expect(Math.abs(p.dz - slots[i].dz)).toBeLessThan(0.01);
  });
});

test('new soldiers appear at the squad centre', () => {
  const view = new SquadView();
  view.update(formationSlots(1), 1);
  view.update(formationSlots(3), 0);
  expect(view.positions.map((p) => p.dx)).toEqual([0, 0, 0]);
});

test('the road tile is drawn inside the road edges, with no overhang', () => {
  const persp = DEFAULT_VIEW;
  const ctx = stubCtx();
  drawRoad(ctx, persp, 123.4, { width: 512, height: 256 } as HTMLImageElement);
  const slices = (ctx.calls.drawImage as number[][]).map(([, , , , , dx, dy, dw, dh]) => ({ dx, dy, dw, dh }));

  expect(slices.length).toBeGreaterThan(500);
  // The road edge at screen row y, from the projection's inverse.
  const edgeAt = (y: number) => {
    const scale = (y - persp.horizonY) / (persp.squadLineY - persp.horizonY);
    const z = persp.focal / scale - persp.focal;
    return { left: project(persp, -1, z).sx, right: project(persp, 1, z).sx };
  };
  for (const s of slices) {
    expect(s.dh).toBeLessThanOrEqual(1.01);
    for (const y of [s.dy, s.dy + s.dh]) {
      const { left, right } = edgeAt(y);
      expect(s.dx).toBeGreaterThanOrEqual(Math.min(left, edgeAt(s.dy + s.dh).left) - 0.5);
      expect(s.dx + s.dw).toBeLessThanOrEqual(Math.max(right, edgeAt(s.dy + s.dh).right) + 0.5);
    }
  }
});

// Every piece of text drawn for one frame of `state`.
function textsDrawn(state: ReturnType<typeof createState>): string[] {
  const ctx = stubCtx();
  renderGame(ctx, state, { persp: DEFAULT_VIEW, assets, time: 0, squadView: new SquadView(), shake: { x: 0, y: 0 } });
  return (ctx.calls.fillText ?? []).map(([text]) => text as string);
}

test('a cage shows its remaining hit points as well as its reward', () => {
  const state = createState(makeLevel({ speed: 6, spawns: [{ z: 20, x: 0.5, type: 'cage', hp: 37, value: 5 }] }), 1);
  step(state, { targetX: -0.9 }, 1 / 60);
  expect(textsDrawn(state)).toEqual(expect.arrayContaining(['+5', '37']));
});

test('the boss shows its remaining health as a number', () => {
  const state = createState(makeLevel({ startSquad: 5 }), 1);
  state.phase = 'boss';
  state.boss = { hp: 1234.4, maxHp: 5000, x: 0, z: 18, fireTimer: 5, summonTimer: 5, enraged: false, charging: false, flash: 0 };
  expect(textsDrawn(state)).toContain('1235');
});
