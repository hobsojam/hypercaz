import { updateBoss } from './boss.ts';
import { updateCombat } from './combat.ts';
import { updateContacts } from './contact.ts';
import {
  BURST_SECONDS,
  DESPAWN_Z,
  ENEMY_SPEED,
  ENEMY_STEER,
  HEAVY_SPEED,
  HEAVY_STEER,
  SPAWN_HORIZON,
  SQUAD_OMEGA,
  STEER_RANGE,
} from './constants.ts';
import { formationHalfWidth, formationSlots } from './formation.ts';
import { spawnEntity, type GameState, type Input } from './state.ts';

// The only way game state changes. Mutates `state` in place and returns it.
export function step(state: GameState, input: Input, dt: number): GameState {
  state.events = [];
  if (state.phase === 'won' || state.phase === 'lost') return state;

  if (input.burst) startBurst(state);
  moveSquad(state, input, dt);
  if (state.phase === 'advance') scrollAndSpawn(state, dt);
  moveEntities(state, dt);
  updateCombat(state, dt);
  state.burstTime = Math.max(0, state.burstTime - dt);
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

function startBurst(state: GameState): void {
  if (state.burstTime > 0 || state.meter < state.level.burstKills) return;
  state.meter = 0;
  state.burstTime = BURST_SECONDS;
  state.events.push({ type: 'burstStart' });
}

// Enemies walk down the road; once close, those outside the formation drift
// toward it (stopping at its edge), so a crowd can't simply be sidestepped.
function moveEntities(state: GameState, dt: number): void {
  const edge = formationHalfWidth(formationSlots(state.squad.count));
  for (const e of state.entities) {
    if (e.type !== 'enemy' && e.type !== 'heavy') continue;
    e.z -= (e.type === 'enemy' ? ENEMY_SPEED : HEAVY_SPEED) * dt;
    if (e.z > STEER_RANGE) continue;
    const gap = e.x - state.squad.x;
    if (Math.abs(gap) <= edge) continue;
    const move = Math.min((e.type === 'enemy' ? ENEMY_STEER : HEAVY_STEER) * dt, Math.abs(gap) - edge);
    e.x -= Math.sign(gap) * move;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
