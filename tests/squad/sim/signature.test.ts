import { describe, expect, it } from 'vitest';
import { createState, type GameState } from '../../../games/squad/sim/state.ts';
import { step } from '../../../games/squad/sim/step.ts';
import { DT, makeLevel } from '../fixtures.ts';

// A level whose boss arrives at t=1 and settles at t=3 (length 10, speed 10),
// with a huge health pool so it outlives the test.
function bossLevel(extra: Record<string, unknown>, startSquad = 30) {
  return makeLevel({ startSquad, length: 10, boss: { hp: 1e9, pattern: 'single', fireEvery: 100, ...extra } });
}

// Steps for `seconds`, clearing shells so only the signature attack matters.
function run(s: GameState, seconds: number, targetX = 0, each?: (s: GameState) => void) {
  const events: GameState['events'] = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    step(s, { targetX }, DT);
    events.push(...s.events);
    s.projectiles = [];
    each?.(s);
  }
  return events;
}

describe('strafer', () => {
  it('slides side to side within reach of the road edges', () => {
    const s = createState(bossLevel({ signature: 'strafe' }), 1);
    run(s, 3);
    const xs: number[] = [];
    run(s, 20, 0, (st) => xs.push(st.boss!.x));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(-0.6);
    expect(Math.max(...xs)).toBeLessThanOrEqual(0.6);
    expect(Math.min(...xs)).toBeLessThan(-0.5);
    expect(Math.max(...xs)).toBeGreaterThan(0.5);
  });

  it('slides faster once enraged', () => {
    const cycle = (enraged: boolean) => {
      const s = createState(bossLevel({ signature: 'strafe' }), 1);
      run(s, 3);
      if (enraged) s.boss!.hp = s.boss!.maxHp * 0.4;
      // Time between two upward crossings of the centre line.
      const crossings: number[] = [];
      let last = s.boss!.x;
      run(s, 15, 0, (st) => {
        if (last < 0 && st.boss!.x >= 0) crossings.push(st.time);
        last = st.boss!.x;
      });
      return crossings[1] - crossings[0];
    };
    expect(cycle(false)).toBeCloseTo(6, 1);
    expect(cycle(true)).toBeCloseTo(4, 1);
  });

  it('a boss without a signature holds the centre', () => {
    const s = createState(bossLevel({}), 1);
    run(s, 3);
    run(s, 10, 0, (st) => expect(st.boss!.x).toBe(0));
  });
});
