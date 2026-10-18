export const ease: Record<'linear' | 'outCubic' | 'outBack' | 'inOutQuad', (t: number) => number> = {
  linear: (t) => t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  outBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
};

export function tweenValue(from: number, to: number, t: number, e: (t: number) => number = ease.linear): number {
  const c = Math.min(1, Math.max(0, t));
  return from + (to - from) * e(c);
}
