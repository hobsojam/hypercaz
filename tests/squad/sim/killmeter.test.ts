import { describe, expect, it } from 'vitest';
import { BURST_MULTIPLIER, BURST_SECONDS } from '../../../games/squad/sim/constants.ts';
import { createState, type GameState } from '../../../games/squad/sim/state.ts';
import { step } from '../../../games/squad/sim/step.ts';
import { DT, makeLevel } from '../fixtures.ts';

function run(s: GameState, seconds: number, burst = false) {
  const events: GameState['events'] = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    step(s, { targetX: 0, burst }, DT);
    events.push(...s.events);
  }
  return events;
}

// Total damage of the bullets fired so far (none can hit anything here).
const firepower = (s: GameState) => s.bullets.reduce((sum, b) => sum + b.damage, 0);

describe('kill meter', () => {
  it('fills by one per enemy and three per heavy', () => {
    const s = createState(makeLevel({ speed: 2, startSquad: 10, spawns: [{ z: 15, x: 0, type: 'enemy', hp: 1 }] }), 1);
    run(s, 3);
    expect(s.meter).toBe(1);
    const h = createState(makeLevel({ speed: 2, startSquad: 10, spawns: [{ z: 15, x: 0, type: 'heavy', hp: 1 }] }), 1);
    run(h, 3);
    expect(h.meter).toBe(3);
  });

  it('caps at the level size and announces it is ready once', () => {
    const spawns = Array.from({ length: 6 }, (_, i) => ({ z: 15 + i, x: 0, type: 'enemy', hp: 1 }));
    const s = createState(makeLevel({ speed: 2, startSquad: 10, burstKills: 4, spawns }), 1);
    const events = run(s, 6);
    expect(s.meter).toBe(4);
    expect(events.filter((e) => e.type === 'burstReady')).toHaveLength(1);
  });

  it('defaults to 40 kills per burst', () => {
    expect(makeLevel().burstKills).toBe(40);
  });
});

describe('rapid fire burst', () => {
  const ready = () => {
    const s = createState(makeLevel({ speed: 1, startSquad: 10, burstKills: 5 }), 1);
    s.meter = 5;
    return s;
  };

  it('does nothing until the meter is full', () => {
    const s = ready();
    s.meter = 4;
    const events = run(s, 0.1, true);
    expect(s.burstTime).toBe(0);
    expect(events.some((e) => e.type === 'burstStart')).toBe(false);
  });

  it('empties the meter and multiplies firepower for a few seconds', () => {
    const calm = ready();
    run(calm, 1);
    const s = ready();
    const events = run(s, DT, true);
    expect(events.filter((e) => e.type === 'burstStart')).toHaveLength(1);
    expect(s.meter).toBe(0);
    run(s, 1 - DT);
    expect(firepower(s) / firepower(calm)).toBeGreaterThan(BURST_MULTIPLIER * 0.85);
    expect(firepower(s) / firepower(calm)).toBeLessThan(BURST_MULTIPLIER * 1.15);
  });

  it('wears off after its duration', () => {
    const s = ready();
    run(s, DT, true);
    run(s, BURST_SECONDS + 0.1);
    expect(s.burstTime).toBe(0);
    s.bullets = [];
    const calm = ready();
    calm.nextShot = s.nextShot;
    run(s, 1);
    run(calm, 1);
    expect(firepower(s) / firepower(calm)).toBeLessThan(1.2);
  });
});
