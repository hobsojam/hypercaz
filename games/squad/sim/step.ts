import { updateBoss } from './boss.ts';
import { updateCombat } from './combat.ts';
import { updateContacts } from './contact.ts';
import { DESPAWN_Z, ENEMY_SPEED, HEAVY_SPEED, SIZES, SPAWN_HORIZON, SQUAD_OMEGA } from './constants.ts';
import { formationHalfWidth, formationSlots } from './formation.ts';
import type { Spawn } from './level.ts';
import type { Entity, GameState, Input } from './state.ts';

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
    state.entities.push(makeEntity(state, level.spawns[state.nextSpawn]));
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

function makeEntity(state: GameState, s: Spawn): Entity {
  const halfW = s.type === 'gate' || s.type === 'hazard' ? s.width / 2 : SIZES[s.type].halfW;
  return {
    id: state.nextId++,
    type: s.type,
    x: s.x,
    z: s.z - state.distance,
    hp: s.hp,
    value: s.value,
    halfW,
    halfD: SIZES[s.type].halfD,
    kind: s.kind,
    kills: s.kills,
    max: s.max,
    resolved: false,
    flash: 0,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
