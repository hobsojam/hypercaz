import { expect, test } from 'vitest';
import { ParticlePool } from '../../engine/particles.ts';

const p = { x: 0, y: 0, vx: 1, vy: 0, life: 0.5, color: '#fff', size: 2, spin: 0 };

test('a full pool overwrites the oldest particle', () => {
  const pool = new ParticlePool(3);
  for (let i = 0; i < 5; i++) pool.emit({ ...p, x: i });
  expect(pool.count).toBe(3);
  const xs: number[] = [];
  pool.forEach((q) => xs.push(q.x));
  expect(xs.sort()).toEqual([2, 3, 4]);
});

test('particles expire after their life', () => {
  const pool = new ParticlePool(3);
  pool.emit(p);
  pool.update(0.6, 0);
  expect(pool.count).toBe(0);
});
