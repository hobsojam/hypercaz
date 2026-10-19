// A simple scripted player used by tests to prove every level is winnable.
// Not used by the game itself.
import { formationHalfWidth, formationSlots } from './formation.ts';
import type { Level } from './level.ts';
import { createState, type Entity, type GameState, type Input } from './state.ts';
import { step } from './step.ts';

export function botInput(state: GameState): Input {
  const move = steer(state);
  return { ...move, burst: wantsBurst(state, move.targetX) };
}

// Spend a full kill meter on the boss, a big crowd that's close, or a cage
// the squad is lined up on but can't break in time.
function wantsBurst(state: GameState, targetX: number): boolean {
  if (state.meter < state.level.burstKills || state.burstTime > 0) return false;
  if (state.boss) return true;
  const close = state.entities.filter((e) => (e.type === 'enemy' || e.type === 'heavy') && e.z > 0 && e.z < 20);
  if (close.length >= 12) return true;
  const fire = (state.squad.count * 2.5) / 3; // rough share of shots that reach a cage
  return state.entities.some(
    (e) => e.type === 'cage' && e.z > 0 && Math.abs(e.x - targetX) < 0.05 && e.hp / fire > e.z / state.level.speed,
  );
}

function steer(state: GameState): Input {
  const { squad, entities } = state;
  const hw = formationHalfWidth(formationSlots(squad.count));
  const limit = 1 - hw;
  const ahead = (e: Entity, maxZ: number) => e.z > 0 && e.z <= maxZ;
  const nearest = (list: Entity[]) => list.reduce<Entity | null>((a, e) => (!a || e.z < a.z ? e : a), null);

  // 0. Dodge incoming boss projectiles: pick the reachable position that the
  // fewest projectiles overlap, preferring the one closest to where we are.
  const incoming = state.projectiles.filter((p) => p.z < 12);
  const overlaps = (x: number) => incoming.filter((p) => Math.abs(p.x - x) <= hw + 0.13).length;
  if (incoming.length > 0 && overlaps(squad.x) > 0) {
    let best = squad.x;
    for (let i = 0; i <= 40; i++) {
      const x = -limit + (2 * limit * i) / 40;
      const better = overlaps(x) < overlaps(best) || (overlaps(x) === overlaps(best) && Math.abs(x - squad.x) < Math.abs(best - squad.x));
      if (better) best = x;
    }
    return { targetX: best };
  }

  // 1. Dodge hazards and negative gates that are about to reach the squad.
  const danger = nearest(
    entities.filter(
      (e) =>
        (e.type === 'hazard' || (e.type === 'gate' && e.value < 0)) &&
        ahead(e, 8) &&
        Math.abs(e.x - squad.x) <= e.halfW + hw + 0.05,
    ),
  );
  if (danger) {
    const margin = danger.halfW + hw + 0.05;
    const options = [danger.x - margin, danger.x + margin].filter((x) => Math.abs(x) <= limit);
    if (options.length === 0) return { targetX: Math.abs(danger.x - limit) > Math.abs(danger.x + limit) ? limit : -limit };
    options.sort((a, b) => Math.abs(a - squad.x) - Math.abs(b - squad.x));
    return { targetX: options[0] };
  }

  // 2. Shoot whatever is nearest: a crowd, or a cage worth breaking first.
  // An enemy about to reach the squad always comes first.
  const threat = nearest(entities.filter((e) => (e.type === 'enemy' || e.type === 'heavy') && ahead(e, 45)));
  if (threat && threat.z < 12) return { targetX: threat.x };
  const goodGate = nearest(entities.filter((e) => e.type === 'gate' && e.value > 0 && ahead(e, 10)));
  if (goodGate) return { targetX: goodGate.x };
  const bonus = nearest(entities.filter((e) => (e.type === 'cage' || (e.type === 'gate' && e.value <= 0)) && ahead(e, 40)));
  // Commit to a cage the squad can break before it arrives, unless a crowd is close.
  const breakable = (e: Entity) => e.type === 'cage' && e.hp / (squad.count * 2.5) < e.z / state.level.speed;
  if (bonus && breakable(bonus) && (!threat || threat.z > 15)) return { targetX: bonus.x };
  const pick = nearest([threat, bonus].filter((e): e is Entity => e !== null));
  if (pick) return { targetX: pick.x };

  // 4. Boss, or centre.
  return { targetX: state.boss ? state.boss.x : 0 };
}

export function runLevel(level: Level, seed: number, policy: (s: GameState) => Input, maxSeconds = 300): GameState {
  const state = createState(level, seed);
  const dt = 1 / 60;
  for (let i = 0; i < maxSeconds / dt && state.phase !== 'won' && state.phase !== 'lost'; i++) {
    step(state, policy(state), dt);
  }
  return state;
}
