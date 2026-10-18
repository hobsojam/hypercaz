import { describe, expect, it } from 'vitest';
import type { Sfx } from '../../engine/audio.ts';
import { ParticlePool } from '../../engine/particles.ts';
import { Effects } from '../../games/squad/render/effects.ts';

function setup() {
  const played: Sfx[] = [];
  const pool = new ParticlePool(500);
  const fx = new Effects({ play: (s) => played.push(s) }, pool);
  const toScreen = (x: number, z: number) => ({ sx: 270 + x * 100, sy: 800 - z * 10 });
  return { played, pool, fx, toScreen };
}

const magnitude = (fx: Effects) => Math.hypot(fx.shake.x, fx.shake.y);

describe('Effects', () => {
  it('gains pop up a green +N and play a sound', () => {
    const { fx, played, toScreen } = setup();
    fx.handle([{ type: 'gain', amount: 5, x: 0, z: 0 }], toScreen);
    expect(fx.popups.map((p) => p.text)).toEqual(['+5']);
    expect(played).toContain('gain');
  });

  it('losses pop up a −N', () => {
    const { fx, played, toScreen } = setup();
    fx.handle([{ type: 'lose', amount: 3, x: 0, z: 0 }], toScreen);
    expect(fx.popups.map((p) => p.text)).toEqual(['−3']);
    expect(played).toContain('lose');
  });

  it('pop-ups expire after 0.8 s', () => {
    const { fx, toScreen } = setup();
    fx.handle([{ type: 'gain', amount: 1, x: 0, z: 0 }], toScreen);
    fx.update(0.79);
    expect(fx.popups).toHaveLength(1);
    fx.update(0.02);
    expect(fx.popups).toHaveLength(0);
  });

  it('a boss death shakes the screen hard, then settles', () => {
    const { fx, played, toScreen } = setup();
    fx.handle([{ type: 'bossDead', x: 0, z: 18 }], toScreen);
    fx.update(1 / 60);
    expect(magnitude(fx)).toBeGreaterThanOrEqual(10);
    expect(played).toContain('win');
    for (let i = 0; i < 120; i++) fx.update(1 / 60);
    expect(magnitude(fx)).toBeLessThan(0.5);
  });

  it('destroyed units burst into 12 confetti particles', () => {
    const { fx, pool, toScreen } = setup();
    fx.handle([{ type: 'destroyed', x: 0, z: 10, target: 'enemy' }], toScreen);
    expect(pool.count).toBe(12);
  });

  it('losing the run plays the fail sound', () => {
    const { fx, played, toScreen } = setup();
    fx.handle([{ type: 'lost' }], toScreen);
    expect(played).toEqual(['fail']);
  });
});
