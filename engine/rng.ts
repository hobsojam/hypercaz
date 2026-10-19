// mulberry32: tiny, fast, seedable PRNG. State is passed explicitly so the
// pure simulation can keep it inside its own state object.

export function createRng(seed: number): number {
  return seed >>> 0;
}

export function nextFloat(state: number): [value: number, nextState: number] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}
