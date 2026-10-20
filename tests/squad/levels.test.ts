import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { botInput, runLevel } from '../../games/squad/sim/bot.ts';
import { createState, type GameState } from '../../games/squad/sim/state.ts';
import { step } from '../../games/squad/sim/step.ts';
import { validateLevel } from '../../games/squad/sim/level.ts';

const dir = join(import.meta.dirname, '../../games/squad/levels');
const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
const levels = files.map((f) => validateLevel(JSON.parse(readFileSync(join(dir, f), 'utf8')), f));

describe('levels', () => {
  it('there are ten valid levels with ids 1..10', () => {
    expect(levels.map((l) => l.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  describe.each(levels.map((l) => [l.id, l] as const))('level %i', (_id, level) => {
    it.each([1, 2, 3])('the bot wins with seed %i and earns 2 stars', (seed) => {
      const end = runLevel(level, seed, botInput);
      expect(end.phase).toBe('won');
      expect(end.squad.count).toBeGreaterThanOrEqual(level.stars[0]);
    });

    if (level.id >= 3) {
      it('standing still does not win', () => {
        expect(runLevel(level, 1, () => ({ targetX: 0 })).phase).not.toBe('won');
      });
    }
  });
});

// Boss fights should reward bringing a bigger squad with a quicker win, not
// only be a fixed-length health race.
describe('boss fights', () => {
  const finish = (s: GameState) => {
    const start = s.time;
    while (s.phase === 'boss' && s.time - start < 300) step(s, botInput(s), 1 / 60);
    return { phase: s.phase, seconds: s.time - start };
  };

  // Averaged over seeds 1–3: the entrance and clearing each summoned crowd take
  // the same time whatever the squad, so one seed alone can fall just short.
  it.each([5, 7, 8, 10])('on level %i a squad half as big again beats the boss at least 25 percent faster', (id) => {
    const level = levels[id - 1];
    const ratios = [1, 2, 3].map((seed) => {
      const s = createState(level, seed);
      while (s.phase === 'advance') step(s, botInput(s), 1 / 60);
      expect(s.phase).toBe('boss');
      const bigger = structuredClone(s);
      bigger.squad.count = Math.round(s.squad.count * 1.5);
      bigger.squad.peak = Math.max(bigger.squad.peak, bigger.squad.count);
      const normal = finish(s);
      const big = finish(bigger);
      expect(normal.phase).toBe('won');
      expect(big.phase).toBe('won');
      return big.seconds / normal.seconds;
    });
    expect(ratios.reduce((a, b) => a + b) / ratios.length).toBeLessThanOrEqual(0.75);
  }, 20_000);
});
