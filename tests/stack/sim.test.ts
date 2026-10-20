import { describe, expect, it } from 'vitest';
import { createRng, nextFloat } from '../../engine/rng.ts';
import {
  BASE_WIDTH,
  SPEED_FULL_AT,
  SPEED_MAX,
  SPEED_START,
  WIDTH,
} from '../../games/stack/sim/constants.ts';
import { createStack, type StackState } from '../../games/stack/sim/state.ts';
import { step } from '../../games/stack/sim/step.ts';

const DROP = { drop: true };
const IDLE = { drop: false };

// Park the moving slab at x (width = top floor's width) and drop it.
function dropAt(s: StackState, x: number): void {
  s.moving.x = x;
  step(s, DROP, 0);
}

describe('stack sim', () => {
  it('starts with one base floor, centred', () => {
    const s = createStack(1);
    expect(s.floors).toEqual([{ x: (WIDTH - BASE_WIDTH) / 2, width: BASE_WIDTH }]);
    expect(s.phase).toBe('play');
  });

  it('trims the overhang and keeps it as debris', () => {
    const s = createStack(1);
    const top = s.floors[0]!;
    dropAt(s, top.x + BASE_WIDTH - 120); // overlap of 120 on the right
    expect(s.floors).toHaveLength(2);
    expect(s.floors[1]).toEqual({ x: top.x + BASE_WIDTH - 120, width: 120 });
    expect(s.debris).toHaveLength(1);
    expect(s.debris[0]!.width).toBe(BASE_WIDTH - 120);
    expect(s.events).toEqual([{ type: 'place', perfect: false, trimmed: BASE_WIDTH - 120 }]);
  });

  it('ends the game on a miss', () => {
    const s = createStack(1);
    s.floors = [{ x: 400, width: 50 }]; // a narrow tower, far from the left edge
    s.moving = { x: 0, width: 50, dir: 1 };
    dropAt(s, 100);
    expect(s.phase).toBe('over');
    expect(s.events).toEqual([{ type: 'miss' }]);
    expect(s.floors).toHaveLength(1);
    expect(s.debris).toHaveLength(1);
  });

  it('snaps a perfect drop within tolerance, trims at 5 px', () => {
    const s = createStack(1);
    const top = s.floors[0]!;
    dropAt(s, top.x + 4);
    expect(s.floors[1]).toEqual({ x: top.x, width: BASE_WIDTH });
    expect(s.events).toEqual([{ type: 'perfect', streak: 1 }]);
    const t = createStack(1);
    dropAt(t, t.floors[0]!.x + 5);
    expect(t.floors[1]!.width).toBe(BASE_WIDTH - 5);
  });

  it('regrows from the 3rd perfect, caps at base, resets on a normal drop', () => {
    const s = createStack(1);
    dropAt(s, s.floors[0]!.x + 100); // width 200
    expect(s.floors[1]!.width).toBe(200);
    const perfect = () => dropAt(s, s.floors.at(-1)!.x);
    perfect();
    perfect();
    expect(s.floors.at(-1)!.width).toBe(200);
    perfect();
    expect(s.floors.at(-1)!.width).toBeCloseTo(209);
    for (let i = 0; i < 20; i++) perfect();
    expect(s.floors.at(-1)!.width).toBe(BASE_WIDTH);
    expect(s.streak).toBe(23);
    dropAt(s, s.floors.at(-1)!.x + 50);
    expect(s.streak).toBe(0);
  });

  it('speeds up with floors and tops out at floor 40', () => {
    const speedAt = (n: number) => {
      const s = createStack(1);
      s.floors = Array.from({ length: n }, () => ({ x: 120, width: BASE_WIDTH }));
      s.moving.x = 120;
      step(s, IDLE, 0);
      return s.speed;
    };
    expect(speedAt(1)).toBe(SPEED_START + (SPEED_MAX - SPEED_START) / SPEED_FULL_AT);
    expect(speedAt(20)).toBeGreaterThan(speedAt(5));
    expect(speedAt(40)).toBe(SPEED_MAX);
    expect(speedAt(500)).toBe(SPEED_MAX);
  });

  it('almost never lands a perfect on a random drop', () => {
    let rng = createRng(42);
    let perfects = 0;
    for (let i = 0; i < 1000; i++) {
      const s = createStack(i);
      let r: number;
      [r, rng] = nextFloat(rng);
      const total = r * 4;
      for (let t = 0; t < total; t += 1 / 60) step(s, IDLE, 1 / 60);
      step(s, DROP, 0);
      if (s.events.some((e) => e.type === 'perfect')) perfects++;
    }
    expect(perfects / 1000).toBeLessThan(0.05);
  });

  it('gives a finite, non-negative width for a drop at the turnaround', () => {
    for (const edge of [-1, 1]) {
      const s = createStack(3);
      const w = s.moving.width;
      s.moving.x = edge < 0 ? -w / 2 : WIDTH - w / 2;
      step(s, DROP, 0);
      const top = s.floors.at(-1)!;
      expect(Number.isFinite(top.width)).toBe(true);
      expect(top.width).toBeGreaterThanOrEqual(0);
      expect(top.width).toBeCloseTo(30);
    }
  });

  it('bounces inside its bounds', () => {
    const s = createStack(7);
    for (let i = 0; i < 600; i++) {
      step(s, IDLE, 1 / 60);
      expect(s.moving.x).toBeGreaterThanOrEqual(-s.moving.width / 2 - 1e-9);
      expect(s.moving.x).toBeLessThanOrEqual(WIDTH - s.moving.width / 2 + 1e-9);
    }
  });

  it('alternates the starting side on every floor', () => {
    const s = createStack(7);
    const side = () => {
      const { x, width, dir } = s.moving;
      if (x === -width / 2 && dir === 1) return 'left';
      if (x === WIDTH - width / 2 && dir === -1) return 'right';
      return 'other';
    };
    const sides = [side()];
    for (let i = 0; i < 3; i++) {
      dropAt(s, s.floors.at(-1)!.x); // perfect, so the width stays put
      sides.push(side());
    }
    expect(sides).toEqual(['left', 'right', 'left', 'right']);
  });

  it('drops debris with gravity and removes it far below the tower', () => {
    const s = createStack(1);
    dropAt(s, s.floors[0]!.x + 100);
    const y0 = s.debris[0]!.y;
    step(s, IDLE, 0.1);
    expect(s.debris[0]!.y).toBeGreaterThan(y0);
    for (let i = 0; i < 300; i++) step(s, IDLE, 1 / 60);
    expect(s.debris).toHaveLength(0);
  });

  it('clears events each step', () => {
    const s = createStack(1);
    dropAt(s, s.floors[0]!.x);
    step(s, IDLE, 1 / 60);
    expect(s.events).toEqual([]);
  });

  it('is deterministic for a seed and inputs', () => {
    const run = () => {
      const s = createStack(99);
      for (let i = 0; i < 500; i++) step(s, { drop: i % 37 === 0 }, 1 / 60);
      return s;
    };
    expect(run()).toEqual(run());
  });
});
