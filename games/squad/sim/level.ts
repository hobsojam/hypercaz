// Level data: types and validation. Levels are authored as JSON; anything
// malformed fails loudly with the file and field path in the message.
import { createRng, nextFloat } from '../../../engine/rng.ts';

export type SpawnType = 'enemy' | 'heavy' | 'cage' | 'gate' | 'hazard';
export type HazardKind = 'blade' | 'fire' | 'barricade';
export type BossPattern = 'single' | 'volley3' | 'spread5';

export interface Spawn {
  z: number;
  x: number;
  type: SpawnType;
  hp: number;
  value: number;
  width: number;
  kind: HazardKind | null;
  kills: number;
  max: number; // gates only: the highest value shooting can raise it to
}

export interface Level {
  id: number;
  name: string;
  speed: number;
  startSquad: number;
  length: number;
  stars: [number, number];
  spawns: Spawn[];
  boss: { hp: number; pattern: BossPattern; fireEvery: number };
}

export class LevelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LevelError';
  }
}

// 'horde' exists only in level files: it expands into a crowd of enemies.
const SPAWN_TYPES: readonly (SpawnType | 'horde')[] = ['enemy', 'heavy', 'cage', 'gate', 'hazard', 'horde'];
const HAZARD_KINDS: readonly HazardKind[] = ['blade', 'fire', 'barricade'];
const BOSS_PATTERNS: readonly BossPattern[] = ['single', 'volley3', 'spread5'];

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function validateLevel(raw: unknown, file: string): Level {
  const fail = (path: string, problem: string): never => {
    throw new LevelError(`${file}: ${path} ${problem}`);
  };
  const num = (o: Obj, key: string, path: string): number => {
    const v = o[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) fail(path, 'must be a number');
    return v as number;
  };
  const range = (o: Obj, key: string, path: string, min: number, max: number): number => {
    const v = num(o, key, path);
    if (v < min || v > max) fail(path, `must be between ${min} and ${max}`);
    return v;
  };
  const intMin = (o: Obj, key: string, path: string, min: number): number => {
    const v = o[key];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < min) fail(path, `must be an integer >= ${min}`);
    return v as number;
  };
  const oneOf = <T extends string>(o: Obj, key: string, path: string, options: readonly T[]): T => {
    const v = o[key];
    if (!options.includes(v as T)) fail(path, `must be one of ${options.join(', ')}`);
    return v as T;
  };
  const width = (o: Obj, path: string): number => {
    const v = num(o, 'width', path);
    if (v <= 0 || v > 2) fail(path, 'must be between 0 (exclusive) and 2');
    return v;
  };

  if (!isObj(raw)) fail('level', 'must be an object');
  const r = raw as Obj;

  const id = intMin(r, 'id', 'id', 1);
  if (typeof r.name !== 'string' || r.name.length === 0) fail('name', 'must be a non-empty string');
  const speed = num(r, 'speed', 'speed');
  if (speed <= 0 || speed > 30) fail('speed', 'must be between 0 (exclusive) and 30');
  const startSquad = intMin(r, 'startSquad', 'startSquad', 1);
  const length = num(r, 'length', 'length');
  if (length <= 0) fail('length', 'must be > 0');

  const stars = r.stars;
  if (
    !Array.isArray(stars) ||
    stars.length !== 2 ||
    !stars.every((s) => Number.isInteger(s)) ||
    stars[0] < 1 ||
    stars[0] > stars[1]
  ) {
    fail('stars', 'must be two integers with 1 <= stars[0] <= stars[1]');
  }

  if (!Array.isArray(r.spawns)) fail('spawns', 'must be an array');
  const spawns = (r.spawns as unknown[]).flatMap((s, i): Spawn[] => {
    const p = `spawns[${i}]`;
    if (!isObj(s)) fail(p, 'must be an object');
    const o = s as Obj;
    const type = oneOf(o, 'type', `${p}.type`, SPAWN_TYPES);
    if (type === 'horde') {
      const z = range(o, 'z', `${p}.z`, 0, length);
      const horde = {
        z,
        x: range(o, 'x', `${p}.x`, -1, 1),
        count: intMin(o, 'count', `${p}.count`, 1),
        hp: intMin(o, 'hp', `${p}.hp`, 1),
        width: width(o, `${p}.width`),
        depth: num(o, 'depth', `${p}.depth`),
      };
      if (horde.depth <= 0) fail(`${p}.depth`, 'must be > 0');
      if (z + horde.depth > length) fail(`${p}.depth`, `must keep the horde within length ${length}`);
      return expandHorde(horde, id * 100003 + i);
    }
    const spawn: Spawn = {
      z: range(o, 'z', `${p}.z`, 0, length),
      x: range(o, 'x', `${p}.x`, -1, 1),
      type,
      hp: 1,
      value: 0,
      width: 0,
      kind: null,
      kills: 0,
      max: 0,
    };
    switch (type) {
      case 'enemy':
      case 'heavy':
        spawn.hp = intMin(o, 'hp', `${p}.hp`, 1);
        spawn.kills = o.kills === undefined ? (type === 'enemy' ? 1 : 3) : intMin(o, 'kills', `${p}.kills`, 1);
        break;
      case 'cage':
        spawn.hp = intMin(o, 'hp', `${p}.hp`, 1);
        spawn.value = intMin(o, 'value', `${p}.value`, 1);
        break;
      case 'gate': {
        const v = o.value;
        if (typeof v !== 'number' || !Number.isInteger(v)) fail(`${p}.value`, 'must be an integer');
        spawn.value = v as number;
        spawn.width = width(o, `${p}.width`);
        spawn.max =
          o.max === undefined
            ? Math.max(5, 2 * Math.abs(spawn.value))
            : intMin(o, 'max', `${p}.max`, Math.max(spawn.value, 1));
        break;
      }
      case 'hazard':
        spawn.kind = oneOf(o, 'kind', `${p}.kind`, HAZARD_KINDS);
        spawn.width = width(o, `${p}.width`);
        break;
    }
    return [spawn];
  });
  spawns.sort((a, b) => a.z - b.z);

  if (!isObj(r.boss)) fail('boss', 'must be an object');
  const b = r.boss as Obj;
  const bossHp = intMin(b, 'hp', 'boss.hp', 1);
  const pattern = oneOf(b, 'pattern', 'boss.pattern', BOSS_PATTERNS);
  const fireEvery = num(b, 'fireEvery', 'boss.fireEvery');
  if (fireEvery <= 0) fail('boss.fireEvery', 'must be > 0');

  return {
    id,
    name: r.name as string,
    speed,
    startSquad,
    length,
    stars: [(stars as number[])[0], (stars as number[])[1]],
    spawns,
    boss: { hp: bossHp, pattern, fireEvery },
  };
}

interface Horde {
  z: number;
  x: number;
  count: number;
  hp: number;
  width: number;
  depth: number;
}

// A jittered grid: evenly filled like a crowd, never in neat rows. Seeded by
// the level and spawn index, so a level always lays out the same way.
function expandHorde(h: Horde, seed: number): Spawn[] {
  let rng = createRng(seed);
  const jitter = () => {
    const [v, next] = nextFloat(rng);
    rng = next;
    return (v * 2 - 1) * 0.4;
  };
  const cols = Math.max(1, Math.min(h.count, Math.round(h.width / 0.1)));
  const rows = Math.ceil(h.count / cols);
  const cw = h.width / cols;
  const cd = h.depth / rows;
  const out: Spawn[] = [];
  for (let k = 0; k < h.count; k++) {
    const x = h.x - h.width / 2 + (k % cols + 0.5 + jitter()) * cw;
    const z = h.z + (Math.floor(k / cols) + 0.5 + jitter()) * cd;
    out.push({
      z,
      x: Math.min(0.95, Math.max(-0.95, x)),
      type: 'enemy',
      hp: h.hp,
      value: 0,
      width: 0,
      kind: null,
      kills: 1,
      max: 0,
    });
  }
  return out;
}
