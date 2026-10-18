import { nextFloat } from '../../../engine/rng.ts';
import { BOSS_AIM_JITTER, BOSS_ENTRY_SPEED, BOSS_ENTRY_Z, BOSS_Z, PATTERNS, PROJECTILE_RADIUS, PROJECTILE_SPEED } from './constants.ts';
import { changeCount, soldiersHit } from './contact.ts';
import { formationSlots } from './formation.ts';
import type { GameState } from './state.ts';

export function updateBoss(state: GameState, dt: number): void {
  if (state.phase === 'boss' && !state.boss) {
    const { hp, fireEvery } = state.level.boss;
    state.boss = { hp, maxHp: hp, x: 0, z: BOSS_ENTRY_Z, fireTimer: fireEvery, flash: 0 };
    state.events.push({ type: 'bossArrive' });
  }

  const boss = state.boss;
  if (boss && state.phase === 'boss') {
    if (boss.z > BOSS_Z) {
      boss.z = Math.max(BOSS_Z, boss.z - BOSS_ENTRY_SPEED * dt);
    } else {
      boss.fireTimer -= dt;
      if (boss.fireTimer <= 0) {
        boss.fireTimer += state.level.boss.fireEvery;
        fireVolley(state);
      }
    }
  }

  updateProjectiles(state, dt);
}

function fireVolley(state: GameState): void {
  const boss = state.boss!;
  for (const offset of PATTERNS[state.level.boss.pattern]) {
    const [r, next] = nextFloat(state.rngState);
    state.rngState = next;
    const jitter = (r * 2 - 1) * BOSS_AIM_JITTER;
    state.projectiles.push({ x: Math.min(1, Math.max(-1, state.squad.x + offset + jitter)), z: boss.z });
  }
  state.events.push({ type: 'bossFire', x: boss.x });
}

function updateProjectiles(state: GameState, dt: number): void {
  const remaining = [];
  for (const p of state.projectiles) {
    p.z -= PROJECTILE_SPEED * dt;
    if (p.z > 0) {
      remaining.push(p);
      continue;
    }
    if (state.phase === 'lost') continue;
    const kills = soldiersHit(state, formationSlots(state.squad.count), p.x, PROJECTILE_RADIUS);
    if (kills > 0) changeCount(state, -kills, p.x, 0);
  }
  state.projectiles = remaining;
}
