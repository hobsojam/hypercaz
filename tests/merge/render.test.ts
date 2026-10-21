import { expect, test } from 'vitest';
import { DANGER_Y } from '../../games/merge/sim/constants.ts';
import { drawFamily, drawPiece, pieceLook, renderMerge } from '../../games/merge/render/draw.ts';
import { makeBall } from '../../games/merge/sim/physics.ts';
import { createMerge } from '../../games/merge/sim/state.ts';
import { stubCtx } from '../squad/stubCtx.ts';

const view = (best = 0) => ({ time: 0, best, families: [] });
const count = (ctx: ReturnType<typeof stubCtx>, name: string) => (ctx.calls[name] ?? []).length;

test('snowmen gain one feature per size and each has its own colour', () => {
  for (let size = 1; size <= 4; size++) {
    const look = pieceLook(size);
    expect(Object.values(look).filter((v) => v === true)).toHaveLength(0);
    expect(look.accent).toBeNull();
  }
  const features = [5, 6, 7, 8, 9].map((s) => {
    const look = pieceLook(s);
    return [look.face, look.nose, look.scarf, look.hat, look.earmuffs].filter(Boolean).length;
  });
  for (let i = 1; i < features.length; i++) expect(features[i]).toBeGreaterThan(features[i - 1]);
  const accents = [5, 6, 7, 8, 9].map((s) => pieceLook(s).accent);
  expect(new Set(accents).size).toBe(5);
});

test('draws every size and the family without throwing', () => {
  const ctx = stubCtx();
  for (let size = 1; size <= 9; size++) drawPiece(ctx, size, 100, 100, 0.5);
  drawFamily(ctx, 270, 800, 0);
  drawFamily(ctx, 270, 800, 1);
  expect(count(ctx, 'arc')).toBeGreaterThan(0);
});

test('draws the score, the best and the next preview', () => {
  const ctx = stubCtx();
  const state = createMerge(1);
  state.score = 123;
  state.next = 3;
  renderMerge(ctx, state, view(456));
  const texts = (ctx.calls.fillText ?? []).map((c) => c[0]);
  expect(texts).toEqual(expect.arrayContaining(['123', 'Best: 456', 'Next']));
});

test('the danger line flashes red when snow is over it', () => {
  const strokes = (over: boolean) => {
    const ctx = stubCtx();
    const state = createMerge(1);
    if (over) {
      const b = makeBall(1, 5, 270, DANGER_Y + 10);
      b.age = 5;
      state.balls.push(b);
    }
    renderMerge(ctx, state, view());
    return (ctx.calls['=strokeStyle'] ?? []).map((c) => String(c[0]));
  };
  expect(strokes(false).some((s) => s.startsWith('#FF'))).toBe(false);
  expect(strokes(true).some((s) => s.startsWith('#FF'))).toBe(true);
});

test('no hanging ball once the round is over', () => {
  const arcs = (phase: 'play' | 'over') => {
    const ctx = stubCtx();
    const state = createMerge(1);
    state.phase = phase;
    renderMerge(ctx, state, view());
    return count(ctx, 'arc');
  };
  expect(arcs('over')).toBeLessThan(arcs('play'));
});
