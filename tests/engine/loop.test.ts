import { afterEach, expect, test, vi } from 'vitest';
import { advance, startLoop, STEP } from '../../engine/loop.ts';

test('a long stall is clamped to at most 15 steps', () => {
  expect(advance(0, 10).steps).toBe(15);
});

test('one frame of 1/60 s is one step', () => {
  const r = advance(0, 1 / 60);
  expect(r.steps).toBe(1);
  expect(r.alpha).toBeGreaterThanOrEqual(0);
  expect(r.alpha).toBeLessThan(1);
});

test('leftover time carries into the next frame', () => {
  const r = advance(0, STEP * 1.5);
  expect(r.steps).toBe(1);
  expect(r.acc).toBeCloseTo(STEP * 0.5);
  expect(r.alpha).toBeCloseTo(0.5);
});

afterEach(() => vi.unstubAllGlobals());

// requestAnimationFrame that only runs when the test says so.
function manualFrames() {
  let next: ((now: number) => void) | null = null;
  let cancelled = 0;
  vi.stubGlobal('requestAnimationFrame', (f: (now: number) => void) => ((next = f), 1));
  vi.stubGlobal('cancelAnimationFrame', () => cancelled++);
  return {
    frame: (now: number) => {
      const f = next;
      next = null;
      f?.(now);
    },
    pending: () => next !== null,
    cancelled: () => cancelled,
  };
}

test('an error in a frame is handed to onError and the loop stops', () => {
  const frames = manualFrames();
  const errors: unknown[] = [];
  const boom = new Error('boom');
  startLoop(
    () => {
      throw boom;
    },
    () => undefined,
    (e) => errors.push(e),
  );
  frames.frame(performance.now() + 20);
  expect(errors).toEqual([boom]);
  expect(frames.pending()).toBe(false);
});

test('without onError, errors still propagate', () => {
  const frames = manualFrames();
  startLoop(
    () => undefined,
    () => {
      throw new Error('render');
    },
  );
  expect(() => frames.frame(performance.now() + 20)).toThrow('render');
});
