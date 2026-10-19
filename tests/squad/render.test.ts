import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { AssetStore, parseManifest } from '../../engine/assets.ts';
import { DEFAULT_VIEW } from '../../engine/perspective.ts';
import { renderGame } from '../../games/squad/render/draw.ts';
import { SquadView } from '../../games/squad/render/squadView.ts';
import { botInput } from '../../games/squad/sim/bot.ts';
import { formationSlots } from '../../games/squad/sim/formation.ts';
import { validateLevel } from '../../games/squad/sim/level.ts';
import { createState } from '../../games/squad/sim/state.ts';
import { step } from '../../games/squad/sim/step.ts';

// A canvas context that accepts every call and property write, counting calls.
function stubCtx() {
  const calls: Record<string, number> = {};
  const proxy: object = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'calls') return calls;
        return () => {
          calls[String(prop)] = (calls[String(prop)] ?? 0) + 1;
          return proxy;
        };
      },
      set: () => true,
    },
  );
  return proxy as CanvasRenderingContext2D & { calls: Record<string, number> };
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
  expect((ctx.calls.fillRect ?? 0) + (ctx.calls.fill ?? 0) + (ctx.calls.drawImage ?? 0)).toBeGreaterThan(0);
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
