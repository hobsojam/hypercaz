// A simple scripted player used by tests to prove every level is winnable.
// Not used by the game itself.
import { formationHalfWidth, formationSlots } from './formation.ts';
import type { Level } from './level.ts';
import { createState, type Entity, type GameState, type Input } from './state.ts';
import { step } from './step.ts';

export function botInput(state: GameState): Input {
  const { squad, entities } = state;
  const hw = formationHalfWidth(formationSlots(squad.count));
  const limit = 1 - hw;
  const ahead = (e: Entity, maxZ: number) => e.z > 0 && e.z <= maxZ;
  const nearest = (list: Entity[]) => list.reduce<Entity | null>((a, e) => (!a || e.z < a.z ? e : a), null);

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

  // 2. Shoot the closest threat.
  const threat = nearest(entities.filter((e) => (e.type === 'enemy' || e.type === 'heavy') && ahead(e, 25)));
  if (threat) return { targetX: threat.x };

  // 3. Invest: break cages, shoot up gates, walk through good gates.
  const goodGate = nearest(entities.filter((e) => e.type === 'gate' && e.value > 0 && ahead(e, 10)));
  if (goodGate) return { targetX: goodGate.x };
  const bonus = nearest(entities.filter((e) => (e.type === 'cage' || (e.type === 'gate' && e.value <= 0)) && ahead(e, 40)));
  if (bonus) return { targetX: bonus.x };

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
