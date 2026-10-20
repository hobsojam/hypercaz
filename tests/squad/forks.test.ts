import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { botInput } from '../../games/squad/sim/bot.ts';
import { SPAWN_HORIZON } from '../../games/squad/sim/constants.ts';
import { validateLevel } from '../../games/squad/sim/level.ts';
import { createState, type Entity, type GameState, type Input } from '../../games/squad/sim/state.ts';
import { step } from '../../games/squad/sim/step.ts';

// Level 6 "Pincer" is the prototype for reward forks (#23): moments where the
// player can't have everything and has to pick.
const level = validateLevel(
  JSON.parse(readFileSync(join(import.meta.dirname, '../../games/squad/levels/06.json'), 'utf8')),
  '06.json',
);
const TWIN_1 = 110; // two cages side by side, nothing else around
const GUARDED = 215; // a small free cage, and a big one behind a crowd
const TWIN_3 = 315; // two cages with the meter about full, a big crowd close behind
const SEEDS = [1, 2, 3];
const DT = 1 / 60;

const cagesAt = (z: number) => level.spawns.filter((s) => s.type === 'cage' && Math.abs(s.z - z) < 0.01);

// Fork runs are slow (the bot plays up to each fork first), so give each test room.
const SLOW = { timeout: 30_000 };

// The bot plays until the fork's cages have just appeared. Each seed plays up
// to each fork once; every route gets its own copy.
const arrivals = new Map<string, GameState>();
function atFork(seed: number, z: number): GameState {
  const key = `${seed}@${z}`;
  if (!arrivals.has(key)) {
    const s = createState(level, seed);
    while (s.phase === 'advance' && s.distance < z - SPAWN_HORIZON) step(s, botInput(s), DT);
    step(s, botInput(s), DT);
    arrivals.set(key, s);
  }
  return structuredClone(arrivals.get(key)!);
}

const forkCages = (s: GameState, z: number) =>
  s.entities.filter((e) => e.type === 'cage' && Math.abs(e.z - (z - s.distance)) < 0.5).sort((a, b) => a.value - b.value);

// Plays a fixed route through the fork until its cages have passed or broken.
function route(s: GameState, cages: Entity[], policy: (s: GameState) => Input): { collected: number; state: GameState } {
  while (s.phase === 'advance' && cages.some((c) => c.hp > 0 && c.z > -1)) step(s, policy(s), DT);
  return { collected: cages.filter((c) => c.hp <= 0).length, state: s };
}

function twin(seed: number, z: number, opts: { scale?: number; burst?: boolean } = {}) {
  const s = atFork(seed, z);
  if (opts.scale) s.squad.count = Math.round(s.squad.count * opts.scale);
  s.burstTime = 0;
  s.meter = opts.burst ? level.burstKills : 0;
  const [small, big] = forkCages(s, z);
  return { s, small, big };
}

const aimAt = (target: Entity, burst = false) => (): Input => ({ targetX: target.x, burst });
// Breaks one cage, then turns to the other.
const both = (first: Entity, second: Entity, burst = false) => (): Input => ({ targetX: first.hp > 0 ? first.x : second.x, burst });

// Tries for both cages in either order; returns the most collected.
function greedy(seed: number, z: number, opts: { scale?: number; burst?: boolean } = {}): number {
  return Math.max(
    ...([true, false] as const).map((smallFirst) => {
      const t = twin(seed, z, opts);
      const [first, second] = smallFirst ? [t.small, t.big] : [t.big, t.small];
      return route(t.s, [t.small, t.big], both(first, second, opts.burst)).collected;
    }),
  );
}

// Plays the rest of the level as the bot, capped like runLevel.
function finish(s: GameState): GameState {
  for (let i = 0; i < 300 / DT && s.phase !== 'won' && s.phase !== 'lost'; i++) step(s, botInput(s), DT);
  return s;
}

describe('level 6 reward forks', () => {
  it('has the three forks', () => {
    expect(cagesAt(TWIN_1)).toHaveLength(2);
    expect(cagesAt(GUARDED)).toHaveLength(2);
    expect(cagesAt(TWIN_3)).toHaveLength(2);
    for (const z of [TWIN_1, TWIN_3]) {
      const [a, b] = cagesAt(z);
      expect(Math.sign(a.x)).toBe(-Math.sign(b.x));
      expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(0.9);
    }
  });

  describe.each([
    ['first', TWIN_1],
    ['third', TWIN_3],
  ])('the %s twin cages', (_name, z) => {
    it('the big cage holds about two and a half times the small one', () => {
      const [small, big] = [...cagesAt(z)].sort((a, b) => a.value - b.value);
      expect(big.value / small.value).toBeGreaterThanOrEqual(2);
      expect(big.value / small.value).toBeLessThanOrEqual(3);
    });

    it.each(SEEDS)('seed %i: either cage alone can be broken, both cannot in either order', SLOW, (seed) => {
      for (const pick of ['small', 'big'] as const) {
        const t = twin(seed, z);
        expect(route(t.s, [t[pick]], aimAt(t[pick])).collected, pick).toBe(1);
      }
      expect(greedy(seed, z)).toBe(1);
    });

    it.each(SEEDS)('seed %i: Rapid Fire breaks both', SLOW, (seed) => {
      expect(greedy(seed, z, { burst: true })).toBe(2);
    });

    it.each(SEEDS)('seed %i: a squad that lost soldiers earlier can still take either cage', SLOW, (seed) => {
      const t = twin(seed, z, { scale: 0.7 });
      expect(route(t.s, [t.small], aimAt(t.small)).collected, 'small at 0.7').toBe(1);
      const u = twin(seed, z, { scale: 0.8 });
      expect(route(u.s, [u.big], aimAt(u.big)).collected, 'big at 0.8').toBe(1);
    });

    it.each(SEEDS)('seed %i: a somewhat bigger squad still cannot take both without Rapid Fire', SLOW, (seed) => {
      expect(greedy(seed, z, { scale: 1.2 })).toBe(1);
    });
  });

  // A small free cage on one side; a big cage on the other, behind a crowd.
  // Shooting through the crowd costs soldiers and time, but charges the meter.
  describe('the guarded cage', () => {
    // Soldiers gained or lost from when the fork appears until it has passed.
    const runs = new Map<string, ReturnType<typeof play>>();
    function guarded(seed: number, pick: 'small' | 'big', burst = false) {
      const key = `${seed}${pick}${burst}`;
      if (!runs.has(key)) runs.set(key, play(seed, pick, burst));
      return runs.get(key)!;
    }
    function play(seed: number, pick: 'small' | 'big', burst: boolean) {
      const s = atFork(seed, GUARDED);
      s.burstTime = 0;
      s.meter = burst ? level.burstKills : 0;
      const [small, big] = forkCages(s, GUARDED);
      const target = pick === 'small' ? small : big;
      const start = s.squad.count;
      let kills = 0;
      // The crowd is every enemy that spawns within 15 m of the fork; hordes
      // spawn row by row as they come into view. The fork has passed once its
      // cages and the crowd are behind the squad.
      const crowd = new Set<Entity>();
      const gather = () => {
        for (const e of s.entities) if ((e.type === 'enemy' || e.type === 'heavy') && Math.abs(e.z + s.distance - GUARDED) < 15) crowd.add(e);
      };
      gather();
      const ahead = (e: Entity) => s.entities.includes(e) && e.z > -1;
      while (s.phase === 'advance' && (ahead(small) || ahead(big) || [...crowd].some(ahead) || s.distance < GUARDED + 15 - SPAWN_HORIZON)) {
        step(s, { targetX: target.x, burst }, DT);
        gather();
        kills += s.events.filter((e) => e.type === 'destroyed' && (e.target === 'enemy' || e.target === 'heavy')).length;
      }
      return { net: s.squad.count - start, collected: target.hp <= 0, kills, small: small.value, big: big.value };
    }

    it('has a crowd in front of the big cage and none in front of the small one', () => {
      const [small, big] = [...cagesAt(GUARDED)].sort((a, b) => a.value - b.value);
      expect(Math.sign(small.x)).toBe(-Math.sign(big.x));
      const crowd = level.spawns.filter((s) => (s.type === 'enemy' || s.type === 'heavy') && Math.abs(s.z - GUARDED) < 15);
      expect(crowd.length).toBeGreaterThan(20);
      const mid = crowd.reduce((a, e) => a + e.x, 0) / crowd.length;
      expect(Math.sign(mid)).toBe(Math.sign(big.x));
      expect(crowd.every((e) => e.z < GUARDED)).toBe(true);
    });

    it.each(SEEDS)('seed %i: the small cage is safe', SLOW, (seed) => {
      const r = guarded(seed, 'small');
      expect(r.collected).toBe(true);
      expect(r.net).toBeGreaterThanOrEqual(0.8 * r.small);
    });

    it.each(SEEDS)('seed %i: the guarded cage pays more, but the crowd takes a real share', SLOW, (seed) => {
      const r = guarded(seed, 'big');
      expect(r.collected).toBe(true);
      expect(r.big - r.net).toBeGreaterThanOrEqual(0.3 * r.big);
      expect(r.kills).toBeGreaterThan(guarded(seed, 'small').kills);
    });

    it.each(SEEDS)('seed %i: neither cage is far ahead of the other', SLOW, (seed) => {
      const small = guarded(seed, 'small');
      const big = guarded(seed, 'big');
      expect(Math.abs(big.net - small.net)).toBeLessThanOrEqual(0.5 * big.big);
    });

    it.each(SEEDS)('seed %i: Rapid Fire through the crowd beats both', SLOW, (seed) => {
      const r = guarded(seed, 'big', true);
      expect(r.collected).toBe(true);
      expect(r.net).toBeGreaterThan(guarded(seed, 'big').net);
      expect(r.net).toBeGreaterThan(guarded(seed, 'small').net);
    });
  });

  describe('the third fork: Rapid Fire now or later', () => {
    it.each(SEEDS)('seed %i: spending it on the cages and saving it both win the level', SLOW, (seed) => {
      for (const spend of [true, false]) {
        const t = twin(seed, TWIN_3, { burst: true });
        const policy = spend ? both(t.small, t.big, true) : aimAt(t.small);
        const r = route(t.s, [t.small, t.big], policy);
        expect(r.collected, spend ? 'spend' : 'save').toBe(spend ? 2 : 1);
        expect(finish(r.state).phase, spend ? 'spend' : 'save').toBe('won');
      }
    });

    // A player who spent Rapid Fire earlier and lost a few soldiers on the way.
    it.each(SEEDS)('seed %i: arriving with an empty meter and fewer soldiers still wins', SLOW, (seed) => {
      const t = twin(seed, TWIN_3, { scale: 0.85 });
      expect(finish(route(t.s, [t.small, t.big], aimAt(t.small)).state).phase).toBe('won');
    });
  });

  // The first fork teaches "pick one"; Rapid Fire coming ready halfway
  // through it would turn it into the third fork.
  it.each(SEEDS)('seed %i: Rapid Fire is not ready during the first fork', SLOW, (seed) => {
    const s = atFork(seed, TWIN_1);
    const cages = forkCages(s, TWIN_1);
    expect(cages).toHaveLength(2);
    let peak = s.meter;
    while (s.phase === 'advance' && cages.some((c) => c.hp > 0 && c.z > -1)) {
      step(s, botInput(s), DT);
      peak = Math.max(peak, s.meter);
    }
    expect(peak).toBeLessThan(level.burstKills);
  });

  it.each(SEEDS)('seed %i: the bot takes a cage at every twin fork', SLOW, (seed) => {
    const s = createState(level, seed);
    const seen = new Map<number, Entity[]>();
    while (s.phase === 'advance') {
      step(s, botInput(s), DT);
      for (const z of [TWIN_1, TWIN_3]) if (!seen.has(z) && s.distance >= z - SPAWN_HORIZON) seen.set(z, forkCages(s, z));
    }
    for (const [z, cages] of seen) {
      expect(cages, `fork at ${z}`).toHaveLength(2);
      expect(cages.filter((c) => c.hp <= 0).length, `fork at ${z}`).toBeGreaterThanOrEqual(1);
    }
    expect(seen.size).toBe(2);
  });
});
