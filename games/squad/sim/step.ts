import { updateBoss } from './boss.ts';
import { updateCombat } from './combat.ts';
import { updateContacts } from './contact.ts';
import { DESPAWN_Z, ENEMY_SPEED, HEAVY_SPEED, SPAWN_HORIZON, SQUAD_OMEGA } from './constants.ts';
import { formationHalfWidth, formationSlots } from './formation.ts';
import { spawnEntity, type GameState, type Input } from './state.ts';

// The only way game state changes. Mutates `state` in place and returns it.
export function step(state: GameState, input: Input, dt: number): GameState {
  state.events = [];
  if (state.phase === 'won' || state.phase === 'lost') return state;

  moveSquad(state, input, dt);
  if (state.phase === 'advance') scrollAndSpawn(state, dt);
  moveEntities(state, dt);
  updateCombat(state, dt);
  updateContacts(state);
  updateBoss(state, dt);
  state.entities = state.entities.filter((e) => e.z >= DESPAWN_Z);
  state.time += dt;
  return state;
}

function moveSquad(state: GameState, input: Input, dt: number): void {
  const { squad } = state;
  const limit = 1 - formationHalfWidth(formationSlots(squad.count));
  const target = clamp(input.targetX, -limit, limit);
  const w = SQUAD_OMEGA;
  squad.vx += (w * w * (target - squad.x) - 2 * w * squad.vx) * dt;
  squad.x += squad.vx * dt;
  if (squad.x > limit || squad.x < -limit) {
    squad.x = clamp(squad.x, -limit, limit);
    squad.vx = 0;
  }
}

function scrollAndSpawn(state: GameState, dt: number): void {
  const { level } = state;
  state.distance = Math.min(state.distance + level.speed * dt, level.length);
  for (const e of state.entities) e.z -= level.speed * dt;
  while (state.nextSpawn < level.spawns.length && level.spawns[state.nextSpawn].z - state.distance <= SPAWN_HORIZON) {
    const spawn = level.spawns[state.nextSpawn];
    state.entities.push(spawnEntity(state, spawn, spawn.z - state.distance));
    state.nextSpawn++;
  }
  if (state.distance >= level.length) state.phase = 'boss';
}

function moveEntities(state: GameState, dt: number): void {
  for (const e of state.entities) {
    if (e.type === 'enemy') e.z -= ENEMY_SPEED * dt;
    else if (e.type === 'heavy') e.z -= HEAVY_SPEED * dt;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
