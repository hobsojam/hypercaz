import { nextFloat } from '../../../engine/rng.ts';
import {
  BOSS_HALF_D,
  BOSS_HALF_W,
  BULLET_DRIFT,
  BURST_MULTIPLIER,
  BULLET_RANGE,
  BULLET_SPEED,
  FIRE_INTERVAL,
  HEAVY_CHARGE,
  MAX_BULLETS_PER_SEC,
  SHOT_GAP_JITTER,
  SHOT_X_JITTER,
  SHOT_Z_JITTER,
} from './constants.ts';
import { changeCount } from './contact.ts';
import { formationSlots } from './formation.ts';
import type { Entity, GameState } from './state.ts';

export interface SweptBullet {
  x: number;
  zFrom: number;
  zTo: number;
}

export interface Box {
  x: number;
  z: number;
  halfW: number;
  halfD: number;
}

// Swept test: the bullet's travel this step, not just its end point, so fast
// bullets can't tunnel through thin targets like gates.
export function hitTest(b: SweptBullet, e: Box): boolean {
  return Math.abs(b.x - e.x) <= e.halfW && b.zTo >= e.z - e.halfD && b.zFrom <= e.z + e.halfD;
}

// Hazards never stop bullets; a gate stops them only while shooting can still
// raise it, so a maxed gate doesn't shield the crowd behind it.
const isShootable = (e: Entity) => e.type !== 'hazard' && !(e.type === 'gate' && e.value >= e.max);

export function updateCombat(state: GameState, dt: number): void {
  for (const e of state.entities) e.flash = Math.max(0, e.flash - dt);
  if (state.boss) state.boss.flash = Math.max(0, state.boss.flash - dt);

  fire(state, dt);

  const survivors = [];
  for (const b of state.bullets) {
    const swept = { x: b.x, zFrom: b.z, zTo: b.z + BULLET_SPEED * dt };
    let target: Entity | null = null;
    for (const e of state.entities) {
      if (isShootable(e) && hitTest(swept, e) && (!target || e.z < target.z)) target = e;
    }
    if (target) {
      applyHit(state, target, b.damage);
      continue;
    }
    if (hitsBoss(state, swept)) {
      applyBossHit(state, b.damage);
      continue;
    }
    b.z = swept.zTo;
    b.x += b.vx * dt;
    if (b.z <= BULLET_RANGE) survivors.push(b);
  }
  state.bullets = survivors;
}

function fire(state: GameState, dt: number): void {
  const { squad } = state;
  if (squad.count <= 0) return;
  const desired = (squad.count / FIRE_INTERVAL) * (state.burstTime > 0 ? BURST_MULTIPLIER : 1);
  const actual = Math.min(desired, MAX_BULLETS_PER_SEC);
  const damage = desired / actual;
  const slots = formationSlots(squad.count);
  // Random gaps from random soldiers, so a squad sounds and looks like a
  // crowd firing at will rather than a sweep on a fixed beat.
  const rand = (lo: number, hi: number) => {
    const [r, next] = nextFloat(state.rngState);
    state.rngState = next;
    return lo + r * (hi - lo);
  };
  state.nextShot -= dt;
  while (state.nextShot <= 0) {
    state.nextShot += (1 / actual) * rand(1 - SHOT_GAP_JITTER, 1 + SHOT_GAP_JITTER);
    const slot = slots[Math.floor(rand(0, slots.length))];
    const x = squad.x + slot.dx + rand(-SHOT_X_JITTER, SHOT_X_JITTER);
    const z = slot.dz + rand(0, SHOT_Z_JITTER);
    state.bullets.push({ x, z, damage, vx: rand(-BULLET_DRIFT, BULLET_DRIFT) });
    state.events.push({ type: 'shot', x, z });
  }
}

function applyHit(state: GameState, e: Entity, damage: number): void {
  e.flash = 0.1;
  state.events.push({ type: 'hit', x: e.x, z: e.z, target: e.type });
  if (e.type === 'gate') {
    // +1 per hit regardless of damage, up to the gate's cap; otherwise a big
    // squad snowballs gates into thousands of soldiers.
    e.value = Math.min(e.max, e.value + 1);
    return;
  }
  e.hp -= damage;
  if (e.hp > 0) return;
  state.entities = state.entities.filter((x) => x !== e);
  state.events.push({ type: 'destroyed', x: e.x, z: e.z, target: e.type });
  if (e.type === 'cage') changeCount(state, e.value, e.x, e.z);
  if (e.type === 'enemy' || e.type === 'heavy') charge(state, e.type === 'heavy' ? HEAVY_CHARGE : 1);
}

// Kills charge the meter, except during a burst (no chaining bursts).
function charge(state: GameState, amount: number): void {
  const full = state.level.burstKills;
  if (state.burstTime > 0 || state.meter >= full) return;
  state.meter = Math.min(full, state.meter + amount);
  if (state.meter === full) state.events.push({ type: 'burstReady' });
}

function hitsBoss(state: GameState, b: SweptBullet): boolean {
  const boss = state.boss;
  return !!boss && state.phase === 'boss' && hitTest(b, { x: boss.x, z: boss.z, halfW: BOSS_HALF_W, halfD: BOSS_HALF_D });
}

function applyBossHit(state: GameState, damage: number): void {
  const boss = state.boss!;
  boss.hp -= damage;
  boss.flash = 0.1;
  state.events.push({ type: 'hit', x: boss.x, z: boss.z, target: 'boss' });
  if (boss.hp > 0) return;
  boss.hp = 0;
  state.phase = 'won';
  state.projectiles = [];
  state.events.push({ type: 'bossDead', x: boss.x, z: boss.z }, { type: 'won' });
}
