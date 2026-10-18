import { type Level, validateLevel } from '../../games/squad/sim/level.ts';

export function makeLevel(overrides: Record<string, unknown> = {}): Level {
  return validateLevel(
    {
      id: 1,
      name: 'Fixture',
      speed: 10,
      startSquad: 1,
      length: 200,
      stars: [5, 10],
      spawns: [],
      boss: { hp: 100, pattern: 'single', fireEvery: 2 },
      ...overrides,
    },
    'fixture.json',
  );
}

export const DT = 1 / 60;
