import { describe, expect, it } from 'vitest';
import { levels, loadLevels } from '../../games/squad/levels/index.ts';

const level = (id: number) => ({
  id,
  name: `L${id}`,
  speed: 10,
  startSquad: 1,
  length: 100,
  stars: [1, 2],
  spawns: [],
  boss: { hp: 10, pattern: 'single', fireEvery: 2 },
});

describe('loadLevels', () => {
  it('loads levels in file order', () => {
    const entries = loadLevels({ './02.json': level(2), './01.json': level(1) });
    expect(entries.map((e) => [e.file, e.level?.id, e.error])).toEqual([
      ['01.json', 1, null],
      ['02.json', 2, null],
    ]);
  });

  it('rejects a level whose id does not match its place in the list', () => {
    const entries = loadLevels({ './01.json': level(1), './02.json': level(3) });
    expect(entries[1].level).toBeNull();
    expect(entries[1].error).toBe('02.json: id is 3 but this is level 2 (levels are numbered in file order)');
  });

  it('rejects a duplicated id', () => {
    const entries = loadLevels({ './01.json': level(1), './02.json': level(1) });
    expect(entries[0].error).toBeNull();
    expect(entries[1].error).toMatch(/id is 1 but this is level 2/);
  });

  it('still reports invalid level data', () => {
    const entries = loadLevels({ './01.json': { id: 1 } });
    expect(entries[0].level).toBeNull();
    expect(entries[0].error).toMatch(/^01\.json: /);
  });
});

it('every shipped level loads with no errors', () => {
  expect(levels.filter((e) => e.error)).toEqual([]);
  expect(levels.map((e) => e.level?.id)).toEqual(levels.map((_, i) => i + 1));
});
