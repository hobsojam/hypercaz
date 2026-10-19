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
    expect(enemy).toEqual({ z: 50, x: 0.2, type: 'enemy', hp: 2, value: 0, width: 0, kind: null, kills: 1, max: 0 });
    expect(level.spawns.find((s) => s.type === 'heavy')!.kills).toBe(3);
    expect(level.spawns.find((s) => s.type === 'hazard')!.kind).toBe('blade');
    expect(level.boss).toEqual({ hp: 400, pattern: 'volley3', fireEvery: 2.5, advance: 0, summonEvery: 0, summonCount: 0, summonHp: 1 });
  });

  it('gates get a value cap: explicit, or max(5, 2 * |value|)', () => {
    const gate = validateLevel(raw(), 't.json').spawns.find((s) => s.type === 'gate')!;
    expect(gate.max).toBe(16);
    const small = validateLevel(raw({ spawns: [{ z: 1, x: 0, type: 'gate', width: 0.4, value: 1 }] }), 't.json');
    expect(small.spawns[0].max).toBe(5);
    const explicit = validateLevel(raw({ spawns: [{ z: 1, x: 0, type: 'gate', width: 0.4, value: -3, max: 9 }] }), 't.json');
    expect(explicit.spawns[0].max).toBe(9);
  });

  it('boss pressure settings default to none', () => {
    expect(validateLevel(raw(), 't.json').boss).toMatchObject({ advance: 0, summonEvery: 0, summonCount: 0, summonHp: 1 });
    const b = validateLevel(raw({ boss: { hp: 10, pattern: 'single', fireEvery: 1, advance: 0.5, summonEvery: 4, summonCount: 12, summonHp: 3 } }), 't.json').boss;
    expect(b).toMatchObject({ advance: 0.5, summonEvery: 4, summonCount: 12, summonHp: 3 });
  });

  it('sorts spawns by z', () => {
    const zs = validateLevel(raw(), 't.json').spawns.map((s) => s.z);
    expect(zs).toEqual([40, 50, 60, 80, 90]);
  });

  describe('hordes', () => {
    const horde = { z: 100, x: 0.3, type: 'horde', count: 24, hp: 2, width: 0.6, depth: 6 };

    it('expands into that many ordinary enemies', () => {
      const spawns = validateLevel(raw({ spawns: [horde] }), 't.json').spawns;
      expect(spawns).toHaveLength(24);
      for (const e of spawns) {
        expect(e).toMatchObject({ type: 'enemy', hp: 2, kills: 1 });
        expect(Math.abs(e.x - 0.3)).toBeLessThanOrEqual(0.3);
        expect(e.z).toBeGreaterThanOrEqual(100);
        expect(e.z).toBeLessThanOrEqual(106);
      }
    });

    it('scatters the crowd rather than lining it up', () => {
      const spawns = validateLevel(raw({ spawns: [horde] }), 't.json').spawns;
      expect(new Set(spawns.map((e) => e.x.toFixed(3))).size).toBeGreaterThan(12);
      expect(new Set(spawns.map((e) => e.z.toFixed(2))).size).toBeGreaterThan(12);
    });

    it('lays out the same crowd every time', () => {
      const a = validateLevel(raw({ spawns: [horde] }), 't.json').spawns;
      expect(validateLevel(raw({ spawns: [horde] }), 't.json').spawns).toEqual(a);
    });

    it('keeps crowds at the road edge on the road', () => {
      const edge = { ...horde, x: 0.9, width: 0.6 };
      for (const e of validateLevel(raw({ spawns: [edge] }), 't.json').spawns) expect(Math.abs(e.x)).toBeLessThanOrEqual(0.95);
    });
  });

  it('rejects non-object input', () => {
    expect(() => validateLevel(null, 't.json')).toThrow(new LevelError('t.json: level must be an object'));
    expect(() => validateLevel([], 't.json')).toThrow('t.json: level must be an object');
  });

  const spawn = (s: Record<string, unknown>) => raw({ spawns: [s] });
  it.each([
    ['bad x', spawn({ z: 10, x: 1.5, type: 'enemy', hp: 1 }), 't.json: spawns[0].x must be between -1 and 1'],
    ['z beyond length', spawn({ z: 500, x: 0, type: 'enemy', hp: 1 }), 't.json: spawns[0].z must be between 0 and 200'],
    ['unknown type', spawn({ z: 10, x: 0, type: 'dragon' }), 't.json: spawns[0].type must be one of enemy, heavy, cage, gate, hazard, horde'],
    ['gate missing width', spawn({ z: 10, x: 0, type: 'gate', value: 3 }), 't.json: spawns[0].width must be a number'],
    ['gate max below value', spawn({ z: 10, x: 0, type: 'gate', width: 0.4, value: 5, max: 2 }), 't.json: spawns[0].max must be an integer >= 5'],
    ['hazard bad kind', spawn({ z: 10, x: 0, type: 'hazard', kind: 'lava', width: 0.3 }), 't.json: spawns[0].kind must be one of blade, fire, barricade'],
    ['cage zero value', spawn({ z: 10, x: 0, type: 'cage', hp: 2, value: 0 }), 't.json: spawns[0].value must be an integer >= 1'],
    ['enemy fractional hp', spawn({ z: 10, x: 0, type: 'enemy', hp: 1.5 }), 't.json: spawns[0].hp must be an integer >= 1'],
    ['horde zero count', spawn({ z: 10, x: 0, type: 'horde', count: 0, hp: 1, width: 0.5, depth: 4 }), 't.json: spawns[0].count must be an integer >= 1'],
    ['horde no depth', spawn({ z: 10, x: 0, type: 'horde', count: 5, hp: 1, width: 0.5 }), 't.json: spawns[0].depth must be a number'],
    ['horde past the end', spawn({ z: 198, x: 0, type: 'horde', count: 5, hp: 1, width: 0.5, depth: 4 }), 't.json: spawns[0].depth must keep the horde within length 200'],
    ['stars reversed', raw({ stars: [20, 10] }), 't.json: stars must be two integers with 1 <= stars[0] <= stars[1]'],
    ['boss bad pattern', raw({ boss: { hp: 10, pattern: 'laser', fireEvery: 1 } }), 't.json: boss.pattern must be one of single, volley3, spread5'],
    ['boss summon without count', raw({ boss: { hp: 10, pattern: 'single', fireEvery: 1, summonEvery: 4 } }), 't.json: boss.summonCount must be an integer >= 1'],
    ['boss negative advance', raw({ boss: { hp: 10, pattern: 'single', fireEvery: 1, advance: -1 } }), 't.json: boss.advance must be between 0 and 10'],
    ['speed out of range', raw({ speed: 0 }), 't.json: speed must be between 0 (exclusive) and 30'],
    ['empty name', raw({ name: '' }), 't.json: name must be a non-empty string'],
  ])('rejects %s', (_label, input, message) => {
    expect(() => validateLevel(input, 't.json')).toThrow(new LevelError(message));
  });
});
