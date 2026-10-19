import { expect, test } from 'vitest';
import { createRng, nextFloat } from '../../engine/rng.ts';

test('same seed gives same sequence', () => {
  let a = createRng(42);
  let b = createRng(42);
  for (let i = 0; i < 5; i++) {
    const [va, na] = nextFloat(a);
    const [vb, nb] = nextFloat(b);
    expect(va).toBe(vb);
    a = na;
    b = nb;
  }
});

test('values are in [0,1) and different seeds differ', () => {
  let s = createRng(1);
  for (let i = 0; i < 1000; i++) {
    const [v, n] = nextFloat(s);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
    s = n;
  }
  expect(nextFloat(createRng(1))[0]).not.toBe(nextFloat(createRng(2))[0]);
});
