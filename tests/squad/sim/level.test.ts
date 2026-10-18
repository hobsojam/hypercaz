import { describe, expect, it } from 'vitest';
import { LevelError, validateLevel } from '../../../games/squad/sim/level.ts';

function raw(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'Test',
    speed: 6,
    startSquad: 1,
    length: 200,
    stars: [10, 20],
    spawns: [
      { z: 50, x: 0.2, type: 'enemy', hp: 2 },
      { z: 40, x: -0.4, type: 'cage', hp: 5, value: 3 },
      { z: 60, x: 0, type: 'heavy', hp: 10 },
      { z: 80, x: 0, type: 'gate', width: 0.5, value: -8 },
      { z: 90, x: 0.5, type: 'hazard', kind: 'blade', width: 0.3 },
    ],
    boss: { hp: 400, pattern: 'volley3', fireEvery: 2.5 },
    ...overrides,
  };
}

describe('validateLevel', () => {
  it('accepts a valid level and fills defaults', () => {
    const level = validateLevel(raw(), 't.json');
    expect(level.name).toBe('Test');
    const enemy = level.spawns.find((s) => s.type === 'enemy')!;
    expect(enemy).toEqual({ z: 50, x: 0.2, type: 'enemy', hp: 2, value: 0, width: 0, kind: null, kills: 1 });
    expect(level.spawns.find((s) => s.type === 'heavy')!.kills).toBe(3);
    expect(level.spawns.find((s) => s.type === 'hazard')!.kind).toBe('blade');
    expect(level.boss).toEqual({ hp: 400, pattern: 'volley3', fireEvery: 2.5 });
  });

  it('sorts spawns by z', () => {
    const zs = validateLevel(raw(), 't.json').spawns.map((s) => s.z);
    expect(zs).toEqual([40, 50, 60, 80, 90]);
  });

  it('rejects non-object input', () => {
    expect(() => validateLevel(null, 't.json')).toThrow(new LevelError('t.json: level must be an object'));
    expect(() => validateLevel([], 't.json')).toThrow('t.json: level must be an object');
  });

  const spawn = (s: Record<string, unknown>) => raw({ spawns: [s] });
  it.each([
    ['bad x', spawn({ z: 10, x: 1.5, type: 'enemy', hp: 1 }), 't.json: spawns[0].x must be between -1 and 1'],
    ['z beyond length', spawn({ z: 500, x: 0, type: 'enemy', hp: 1 }), 't.json: spawns[0].z must be between 0 and 200'],
    ['unknown type', spawn({ z: 10, x: 0, type: 'dragon' }), 't.json: spawns[0].type must be one of enemy, heavy, cage, gate, hazard'],
    ['gate missing width', spawn({ z: 10, x: 0, type: 'gate', value: 3 }), 't.json: spawns[0].width must be a number'],
    ['hazard bad kind', spawn({ z: 10, x: 0, type: 'hazard', kind: 'lava', width: 0.3 }), 't.json: spawns[0].kind must be one of blade, fire, barricade'],
    ['cage zero value', spawn({ z: 10, x: 0, type: 'cage', hp: 2, value: 0 }), 't.json: spawns[0].value must be an integer >= 1'],
    ['enemy fractional hp', spawn({ z: 10, x: 0, type: 'enemy', hp: 1.5 }), 't.json: spawns[0].hp must be an integer >= 1'],
    ['stars reversed', raw({ stars: [20, 10] }), 't.json: stars must be two integers with 1 <= stars[0] <= stars[1]'],
    ['boss bad pattern', raw({ boss: { hp: 10, pattern: 'laser', fireEvery: 1 } }), 't.json: boss.pattern must be one of single, volley3, spread5'],
    ['speed out of range', raw({ speed: 0 }), 't.json: speed must be between 0 (exclusive) and 30'],
    ['empty name', raw({ name: '' }), 't.json: name must be a non-empty string'],
  ])('rejects %s', (_label, input, message) => {
    expect(() => validateLevel(input, 't.json')).toThrow(new LevelError(message));
  });
});
