import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { botInput, runLevel } from '../../games/squad/sim/bot.ts';
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
