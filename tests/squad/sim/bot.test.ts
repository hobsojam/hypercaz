import { describe, expect, it } from 'vitest';
import { botInput } from '../../../games/squad/sim/bot.ts';
import { createState, type GameState } from '../../../games/squad/sim/state.ts';
import { step } from '../../../games/squad/sim/step.ts';
import { DT, makeLevel } from '../fixtures.ts';

// Two cages side by side, listed in either order, so picking by list order
// alone can't pass both runs of a test.
function twins(bigHp: number, bigFirst: boolean): GameState {
  const small = { z: 80, x: 0.5, type: 'cage', hp: 20, value: 5 };
  const big = { z: 80, x: -0.5, type: 'cage', hp: bigHp, value: 12 };
  return createState(
    makeLevel({
      speed: 8,
      length: 200,
      startSquad: 40,
      spawns: bigFirst ? [big, small] : [small, big],
    }),
    1,
  );
}

function play(s: GameState, seconds: number) {
  for (let i = 0; i < Math.round(seconds / DT); i++) step(s, botInput(s), DT);
}

const cageAt = (s: GameState, x: number) => s.entities.find((e) => e.type === 'cage' && e.x === x);

describe('bot at twin cages', () => {
  it.each([true, false])('goes for the bigger reward when it can break it in time (big listed first: %s)', (bigFirst) => {
    const s = twins(150, bigFirst);
    play(s, 7);
    expect(s.squad.x).toBeLessThan(-0.3);
  });

  it.each([true, false])('settles for the small cage when the big one is out of reach (big listed first: %s)', (bigFirst) => {
    const s = twins(5000, bigFirst);
    play(s, 8);
    expect(cageAt(s, 0.5)).toBeUndefined();
    expect(s.squad.count).toBe(45);
  });

  it.each([true, false])('sticks with its choice until that cage is broken (big listed first: %s)', (bigFirst) => {
    const s = twins(150, bigFirst);
    const sides = new Set<number>();
    for (let i = 0; i < Math.round(10 / DT) && (s.distance < 25 || cageAt(s, -0.5)); i++) {
      const input = botInput(s);
      if (Math.abs(input.targetX) > 0.3) sides.add(Math.sign(input.targetX));
      step(s, input, DT);
    }
    expect(sides).toEqual(new Set([-1]));
    expect(cageAt(s, -0.5)).toBeUndefined();
  });
});
