import { expect, test } from 'vitest';
import { renderStack, skyColors } from '../../games/stack/render/draw.ts';
import { createStack } from '../../games/stack/sim/state.ts';
import { step } from '../../games/stack/sim/step.ts';
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

// Debris starts where it was cut. After a trim that is the slab just placed
// (the sim has already pushed it, so it is floors.length - 1); after a miss
// nothing was pushed and it is the moving slab's row, floors.length.
function withDebris(n: number, phase: 'play' | 'over') {
  const state = tower(n);
  state.phase = phase;
  state.debris.push({ x: 100, width: 40, y: 0, vy: 0, spin: 0, floor: phase === 'play' ? n - 1 : n });
  const ctx = stubCtx();
  renderStack(ctx, state, { camera: n - 1, time: 0, ring: 0 });
  const [, y] = ctx.calls.translate!.at(-1)!;
  const hues = (ctx.calls['=fillStyle'] ?? []).map(([c]) => c).filter((c): c is string => typeof c === 'string' && c.startsWith('hsl(')).slice(-3);
  return { y: y as number, hues };
}

test('debris after a trimmed drop sits on the slab that was cut, in its colour', () => {
  const { y, hues } = withDebris(3, 'play');
  expect(y).toBe(640 + 12); // the top floor's row (camera is on it), plus half a floor
  for (const h of hues) expect(h).toContain('hsl(208 '); // floor 2: 200 + 2 x 4
});

test('debris after a miss falls from the moving slab, in its colour', () => {
  const { y, hues } = withDebris(3, 'over');
  expect(y).toBe(640 - 24 + 12);
  for (const h of hues) expect(h).toContain('hsl(212 ');
});

test('falling debris keeps its row when the next drop lands', () => {
  const state = tower(3);
  state.debris.push({ x: 100, width: 40, y: 1, vy: 0, spin: 0, floor: 2 });
  const before = stubCtx();
  renderStack(before, state, { camera: 2, time: 0, ring: 0 });
  state.floors.push({ x: 120, width: 300 }); // the next drop lands
  const after = stubCtx();
  renderStack(after, state, { camera: 2, time: 0, ring: 0 });
  expect(after.calls.translate!.at(-1)![1]).toBe(before.calls.translate!.at(-1)![1]);
});

test('after 500 perfect drops every colour hue and number drawn is sane', () => {
  const state = createStack(1);
  for (let i = 0; i < 500; i++) {
    state.moving.x = state.floors[state.floors.length - 1]!.x;
    step(state, { drop: true }, 1 / 60);
  }
  const ctx = stubCtx();
  renderStack(ctx, state, { camera: state.floors.length - 1, time: 3, ring: 0.5 });
  const colours = Object.entries(ctx.calls)
    .filter(([k]) => k.startsWith('='))
    .flatMap(([, v]) => v.map(([c]) => c))
    .filter((c): c is string => typeof c === 'string' && c.includes('hsl('));
  expect(colours.length).toBeGreaterThan(0);
  for (const c of colours) for (const m of c.matchAll(/hsla?\(\s*(-?[\d.]+)/g)) {
    expect(Number(m[1])).toBeGreaterThanOrEqual(0);
    expect(Number(m[1])).toBeLessThanOrEqual(360);
  }
  for (const [name, calls] of Object.entries(ctx.calls)) {
    if (name.startsWith('=')) continue;
    for (const args of calls) for (const a of args) if (typeof a === 'number') expect(Number.isFinite(a), name).toBe(true);
  }
});
