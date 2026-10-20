import { describe, expect, it } from 'vitest';
import { sweepCircle, sweepRect } from '../../games/ricochet/sim/geometry.ts';
import { createState, preview, shoot, starsFor, step } from '../../games/ricochet/sim/game.ts';
import type { Level } from '../../games/ricochet/levels.ts';

const level = (overrides: Partial<Level> = {}): Level => ({ id: 1, name: 'Test', lesson: 'Aim up.', par: 1, shots: 3, walls: [], cages: [{ id: 'a', x: 270, y: 300 }], ...overrides });
const finishShot = (s: ReturnType<typeof createState>, dt = 1 / 60) => {
  for (let i = 0; i < 2000 && s.phase === 'flying'; i++) step(s, dt);
};

describe('swept collisions', () => {
  it('finds a thin wall even when the end position crosses it', () => {
    expect(sweepRect({ x: 0, y: 10 }, { x: 1000, y: 0 }, { x: 20, y: 0, w: 2, h: 20 }, 1)).toMatchObject({ time: 0.02, nx: -1, ny: 0 });
  });
  it('reflects both axes at an exact rectangular corner', () => {
    expect(sweepRect({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 20, w: 20, h: 20 }, 3)).toMatchObject({ time: 2, nx: -1, ny: -1 });
  });
  it('does not collide when moving parallel outside a wall', () => {
    expect(sweepRect({ x: 0, y: -1 }, { x: 1000, y: 0 }, { x: 20, y: 0, w: 2, h: 20 }, 1)).toBeNull();
  });
  it('detects a circle on the travelled segment, excluding one behind it', () => {
    expect(sweepCircle({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 30, y: 0 }, 5, 5)?.time).toBe(2.5);
    expect(sweepCircle({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: -30, y: 0 }, 5, 5)).toBeNull();
  });
});

describe('rescue shots', () => {
  it('rescues a cage, wins and earns three stars for a par shot', () => {
    const s = createState(level());
    expect(shoot(s, -Math.PI / 2)).toBe(true);
    finishShot(s);
    expect(s.phase).toBe('won');
    expect(s.cages[0].rescued).toBe(true);
    expect(s.shotsUsed).toBe(1);
    expect(starsFor(s)).toBe(3);
  });
  it('can rescue several cages in one shot', () => {
    const s = createState(level({ cages: [{ id: 'a', x: 270, y: 500 }, { id: 'b', x: 270, y: 300 }] }));
    shoot(s, -Math.PI / 2);
    finishShot(s);
    expect(s.phase).toBe('won');
    expect(s.cages.every(c => c.rescued)).toBe(true);
  });
  it('banks off a side wall to rescue a cage', () => {
    // Ray to the right wall: (504,530), then to (274,300).
    const s = createState(level({ cages: [{ id: 'a', x: 274, y: 300 }] }));
    shoot(s, -Math.PI / 4);
    let banks = 0;
    for (let i = 0; i < 1000 && s.phase === 'flying'; i++) {
      step(s, 1 / 60);
      banks += s.events.filter(e => e.type === 'bank').length;
    }
    expect(banks).toBeGreaterThanOrEqual(1);
    expect(s.phase).toBe('won');
  });
  it('does not tunnel through an obstacle at a large step size', () => {
    const s = createState(level({ walls: [{ x: 230, y: 500, w: 80, h: 4 }] }));
    shoot(s, -Math.PI / 2);
    step(s, 0.6);
    expect(s.cages[0].rescued).toBe(false);
    expect(s.ball!.vy).toBeGreaterThan(0);
    finishShot(s);
    expect(s.phase).toBe('aiming');
  });
  it('rejects invalid angles and a second shot in flight without spending shots', () => {
    const s = createState(level());
    for (const angle of [NaN, Infinity, 0, Math.PI / 2]) expect(shoot(s, angle)).toBe(false);
    expect(s.shotsUsed).toBe(0);
    shoot(s, -Math.PI / 2);
    expect(shoot(s, -Math.PI / 2)).toBe(false);
    expect(s.shotsUsed).toBe(1);
  });
  it('returns a trapped ball after eight banks rather than looping forever', () => {
    const s = createState(level({ cages: [{ id: 'a', x: 450, y: 250 }], walls: [{ x: 200, y: 670, w: 140, h: 20 }] }));
    shoot(s, -Math.PI / 2);
    let banks = 0;
    for (let i = 0; i < 2000 && s.phase === 'flying'; i++) {
      step(s, 1 / 60);
      banks += s.events.filter(e => e.type === 'bank').length;
    }
    expect(banks).toBeLessThanOrEqual(8);
    expect(s.phase).toBe('aiming');
  });
  it('keeps rescued cages across shots, exhausts the budget and resets on retry', () => {
    const s = createState(level({ shots: 2, cages: [{ id: 'a', x: 270, y: 500 }, { id: 'b', x: 450, y: 300 }] }));
    shoot(s, -Math.PI / 2); finishShot(s);
    expect(s.cages[0].rescued).toBe(true);
    shoot(s, -Math.PI / 2); finishShot(s);
    expect(s.phase).toBe('lost');
    expect(starsFor(s)).toBe(0);
    expect(createState(s.level).cages.every(c => !c.rescued)).toBe(true);
  });
  it('preview uses the same bank and rescue path without modifying the attempt', () => {
    const s = createState(level({ cages: [{ id: 'a', x: 274, y: 300 }] }));
    const before = structuredClone(s);
    const guide = preview(s, -Math.PI / 4);
    expect(s).toEqual(before);
    expect(guide[0]).toEqual({ x: 270, y: 764 });
    expect(guide.some(p => Math.abs(p.x - 504) < 0.01)).toBe(true);
    shoot(s, -Math.PI / 4); finishShot(s);
    expect(s.phase).toBe('won');
    expect(Math.hypot(guide.at(-1)!.x - 274, guide.at(-1)!.y - 300)).toBeCloseTo(33);
  });
  it('scores fewer-shot wins more highly', () => {
    const s = createState(level());
    s.phase = 'won';
    s.shotsUsed = 1; expect(starsFor(s)).toBe(3);
    s.shotsUsed = 2; expect(starsFor(s)).toBe(2);
    s.shotsUsed = 3; expect(starsFor(s)).toBe(1);
  });
});
