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

  it('a gain pops the squad count badge green, more for a bigger gain, then settles', () => {
    const small = setup();
    small.fx.handle([{ type: 'gain', amount: 2, x: 0, z: 10 }], small.toScreen);
    const big = setup();
    big.fx.handle([{ type: 'gain', amount: 20, x: 0, z: 10 }], big.toScreen);
    expect(small.fx.badge.scale).toBeGreaterThan(1);
    expect(big.fx.badge.scale).toBeGreaterThan(small.fx.badge.scale);
    expect(big.fx.badge.color).toBe('#3CC85A');
    big.fx.update(0.5);
    expect(big.fx.badge).toEqual({ scale: 1, dx: 0, color: null });
  });

  it('a loss shakes the squad count badge red, then settles', () => {
    const { fx, toScreen } = setup();
    expect(fx.badge).toEqual({ scale: 1, dx: 0, color: null });
    fx.handle([{ type: 'lose', amount: 3, x: 0, z: 0 }], toScreen);
    expect(fx.badge.color).toBe('#E04040');
    const offsets: number[] = [];
    for (let i = 0; i < 10; i++) {
      fx.update(0.02);
      offsets.push(fx.badge.dx);
    }
    expect(Math.max(...offsets.map(Math.abs))).toBeGreaterThan(2);
    fx.update(0.5);
    expect(fx.badge).toEqual({ scale: 1, dx: 0, color: null });
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

  it('a boss charging shakes the screen and roars', () => {
    const { fx, played, toScreen } = setup();
    fx.handle([{ type: 'bossCharge', x: 0 }], toScreen);
    fx.update(1 / 60);
    expect(magnitude(fx)).toBeGreaterThan(0);
    expect(played).toContain('boss');
  });

  it('a barrage warning plays the warning sound', () => {
    const { fx, played, toScreen } = setup();
    fx.handle([{ type: 'bossBarrage' }], toScreen);
    expect(played).toContain('warn');
  });

  it('breaking a shield thumps', () => {
    const { fx, played, toScreen } = setup();
    fx.handle([{ type: 'shieldBreak' }], toScreen);
    fx.update(1 / 60);
    expect(magnitude(fx)).toBeGreaterThan(0);
    expect(played).toContain('hit');
  });

  it('a boss winding up plays a warning sound', () => {
    const { fx, played, toScreen } = setup();
    fx.handle([{ type: 'bossWindup' }], toScreen);
    expect(played).toEqual(['warn']);
  });

  it('an enraged boss roars and shakes the screen', () => {
    const { fx, played, toScreen } = setup();
    fx.handle([{ type: 'bossEnrage' }], toScreen);
    fx.update(1 / 60);
    expect(magnitude(fx)).toBeGreaterThanOrEqual(5);
    expect(played).toContain('boss');
  });

  it('a summon rumbles', () => {
    const { fx, played, toScreen } = setup();
    fx.handle([{ type: 'bossSummon', x: 0 }], toScreen);
    fx.update(1 / 60);
    expect(magnitude(fx)).toBeGreaterThan(0);
    expect(played).toContain('boss');
  });

  it('routine enemy deaths leave a small, short-lived red burst', () => {
    const { fx, pool, toScreen } = setup();
    fx.handle([{ type: 'destroyed', x: 0, z: 10, target: 'enemy' }], toScreen);
    expect(pool.count).toBeLessThanOrEqual(3);
    pool.forEach(p => expect(p.color).toBe('#E04040'));
    fx.update(0.3);
    expect(pool.count).toBe(0);
  });

  it('losing the run plays the fail sound', () => {
    const { fx, played, toScreen } = setup();
    fx.handle([{ type: 'lost' }], toScreen);
    expect(played).toEqual(['fail']);
  });

  it('a full meter chimes, and firing it kicks the screen with its own sound', () => {
    const { fx, played, toScreen } = setup();
    fx.handle([{ type: 'burstReady' }], toScreen);
    expect(played).toEqual(['ready']);
    fx.handle([{ type: 'burstStart' }], toScreen);
    expect(played).toEqual(['ready', 'burst']);
    fx.update(0);
    expect(magnitude(fx)).toBeGreaterThan(0);
  });
});

it('a dense crowd wipe is celebrated once while routine particles stay bounded', () => {
  const { fx, pool, toScreen } = setup();
  fx.handle(Array.from({ length: 100 }, () => ({ type: 'destroyed' as const, target: 'enemy' as const, x: 0, z: 10 })), toScreen);
  expect(pool.count).toBeLessThanOrEqual(30);
  const colors: string[] = [];
  pool.forEach(p => colors.push(p.color));
  expect(new Set(colors).size).toBeGreaterThan(2);
});

it('nearby losses combine without hiding a simultaneous recruitment reward', () => {
  const { fx, toScreen } = setup();
  fx.handle([
    ...Array.from({ length: 20 }, () => ({ type: 'lose' as const, amount: 1, x: 0, z: 0 })),
    { type: 'gain', amount: 8, x: 0, z: 0 },
  ], toScreen);
  expect(fx.popups.map(p => p.text)).toEqual(['−20', '+8']);
  expect(fx.popups[0].y).not.toBe(fx.popups[1].y);
});

it('rescuing a cage keeps a more prominent celebration than a routine kill', () => {
  const { fx, pool, toScreen } = setup();
  fx.handle([{ type: 'destroyed', target: 'cage', x: 0, z: 10 }], toScreen);
  expect(pool.count).toBeGreaterThanOrEqual(10);
});
