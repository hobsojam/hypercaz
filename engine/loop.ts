// Fixed-step game loop. Simulation always advances in STEP increments; a long
// stall (background tab, breakpoint) is clamped so we never spiral.

export const STEP = 1 / 60;
export const MAX_FRAME = 0.25;

export function advance(acc: number, frameDt: number): { steps: number; acc: number; alpha: number } {
  let a = acc + Math.min(Math.max(frameDt, 0), MAX_FRAME);
  let steps = 0;
  while (a >= STEP - 1e-9) {
    a -= STEP;
    steps++;
  }
  a = Math.max(0, a);
  return { steps, acc: a, alpha: a / STEP };
}

export function startLoop(update: (dt: number) => void, render: (alpha: number) => void): () => void {
  let acc = 0;
  let last = performance.now();
  let handle = 0;
  const frame = (now: number) => {
    const r = advance(acc, (now - last) / 1000);
    last = now;
    acc = r.acc;
    for (let i = 0; i < r.steps; i++) update(STEP);
    render(r.alpha);
    handle = requestAnimationFrame(frame);
  };
  handle = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(handle);
}
