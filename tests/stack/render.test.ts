import { expect, test } from 'vitest';
import { renderStack, skyColors } from '../../games/stack/render/draw.ts';
import { createStack } from '../../games/stack/sim/state.ts';
import { BASE_WIDTH } from '../../games/stack/sim/constants.ts';
import { stubCtx } from '../squad/stubCtx.ts';

function tower(n: number) {
  const state = createStack(1);
  for (let i = 1; i < n; i++) state.floors.push({ x: (540 - BASE_WIDTH) / 2, width: BASE_WIDTH });
  return state;
}
// The sky is one fillRect; each slab's front face is another.
const slabs = (ctx: ReturnType<typeof stubCtx>) => (ctx.calls.fillRect ?? []).length - 1;

test('draws one slab per floor, plus the moving slab', () => {
  const ctx = stubCtx();
  renderStack(ctx, tower(5), { camera: 4, time: 0, ring: 0 });
  expect(slabs(ctx)).toBe(6);
});

test('skips floors that have scrolled off the screen', () => {
  const ctx = stubCtx();
  renderStack(ctx, tower(100), { camera: 99, time: 0, ring: 0 });
  expect(slabs(ctx)).toBeLessThan(45);
  expect(slabs(ctx)).toBeGreaterThan(10);
});

test('the moving slab is gone once the run is over (it became debris)', () => {
  const ctx = stubCtx();
  const state = tower(3);
  state.phase = 'over';
  renderStack(ctx, state, { camera: 2, time: 0, ring: 0 });
  expect(slabs(ctx)).toBe(3);
});

test('draws the score at the top centre', () => {
  const ctx = stubCtx();
  renderStack(ctx, tower(8), { camera: 7, time: 0, ring: 0 });
  const score = (ctx.calls.fillText ?? []).find(([text]) => text === '7');
  expect(score).toBeDefined();
  expect(score![1]).toBe(270);
  expect(score![2] as number).toBeLessThan(200);
});

test('the ring is drawn only while a perfect drop is ringing', () => {
  const none = stubCtx();
  renderStack(none, tower(4), { camera: 3, time: 0, ring: 0 });
  expect(none.calls.roundRect ?? []).toHaveLength(0);
  const on = stubCtx();
  renderStack(on, tower(4), { camera: 3, time: 0, ring: 0.6 });
  expect(on.calls.roundRect ?? []).toHaveLength(1);
  expect(on.calls['=strokeStyle']!.some(([c]) => typeof c === 'string' && c.startsWith('rgba(255,255,255'))).toBe(true);
});

test('the sky hue follows the top floor', () => {
  expect(skyColors(0)).not.toEqual(skyColors(30));
  expect(skyColors(90)).toEqual(skyColors(0)); // 90 floors x 4 degrees is a full turn
});
