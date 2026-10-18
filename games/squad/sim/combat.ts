import { BOSS_HALF_D, BOSS_HALF_W, BULLET_RANGE, BULLET_SPEED, FIRE_INTERVAL, MAX_BULLETS_PER_SEC } from './constants.ts';
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

const isShootable = (e: Entity) => e.type !== 'hazard';

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
    if (b.z <= BULLET_RANGE) survivors.push(b);
  }
  state.bullets = survivors;
}

function fire(state: GameState, dt: number): void {
  const { squad } = state;
  if (squad.count <= 0) return;
  const desired = squad.count / FIRE_INTERVAL;
  const actual = Math.min(desired, MAX_BULLETS_PER_SEC);
  const damage = desired / actual;
  const slots = formationSlots(squad.count);
  state.fireAcc += actual * dt;
  while (state.fireAcc >= 1) {
    state.fireAcc -= 1;
    const slot = slots[state.shotIndex % slots.length];
    state.shotIndex++;
    const x = squad.x + slot.dx;
    state.bullets.push({ x, z: slot.dz, damage });
    state.events.push({ type: 'shot', x, z: slot.dz });
  }
}

function applyHit(state: GameState, e: Entity, damage: number): void {
  e.flash = 0.1;
  state.events.push({ type: 'hit', x: e.x, z: e.z, target: e.type });
  if (e.type === 'gate') {
    e.value += Math.round(damage);
    return;
  }
  e.hp -= damage;
  if (e.hp > 0) return;
  state.entities = state.entities.filter((x) => x !== e);
  state.events.push({ type: 'destroyed', x: e.x, z: e.z, target: e.type });
  if (e.type === 'cage') changeCount(state, e.value, e.x, e.z);
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
