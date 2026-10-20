import { nextFloat } from '../../../engine/rng.ts';
import {
  BARRAGE_WARN,
  BOSS_AIM_JITTER,
  BOSS_ENRAGE_AT,
  BOSS_ENRAGE_FIRE,
  BOSS_ENRAGE_SUMMON,
  BOSS_ENTRY_SPEED,
  BOSS_ENTRY_Z,
  BOSS_FIRST_VOLLEY,
  BOSS_HALF_D,
  BOSS_SUMMON_WIDTH,
  BOSS_WINDUP,
  FORTRESS_FIRST_BARRAGE,
  BOSS_Z,
  ENRAGED_PATTERN,
  PATTERNS,
  PROJECTILE_BLAST_DEPTH,
  PROJECTILE_RADIUS,
  PROJECTILE_SPEED,
} from './constants.ts';
import { changeCount, soldiersHit } from './contact.ts';
import { formationSlots } from './formation.ts';
import { expandHorde } from './level.ts';
import { holdsGround, quietBeforeCharge, signatureBusy, summonsNow, updateSignature } from './signature.ts';
import { spawnEntity, type GameState } from './state.ts';

export function updateBoss(state: GameState, dt: number): void {
  const cfg = state.level.boss;
  if (state.phase === 'boss' && !state.boss) {
    state.boss = {
      hp: cfg.hp,
      maxHp: cfg.hp,
      x: 0,
      z: BOSS_ENTRY_Z,
      fireTimer: Math.min(BOSS_FIRST_VOLLEY, cfg.fireEvery),
      summonTimer: cfg.summonEvery,
      enraged: false,
      charging: false,
      flash: 0,
      attack: null,
      signatureTimer: cfg.signature === 'fortress' ? FORTRESS_FIRST_BARRAGE : cfg.chargeEvery,
      strafeT: 0,
    };
    state.events.push({ type: 'bossArrive' });
  }

  const boss = state.boss;
  if (boss && state.phase === 'boss') {
    if (!boss.enraged && boss.hp <= boss.maxHp * BOSS_ENRAGE_AT) {
      boss.enraged = true;
      state.events.push({ type: 'bossEnrage' });
    }
    if (boss.z > BOSS_Z) {
      boss.z = Math.max(BOSS_Z, boss.z - BOSS_ENTRY_SPEED * dt);
    } else {
      fight(state, dt);
    }
  }

  updateProjectiles(state, dt);
}

// Once settled: creep forward, fire volleys after a warning glow, and summon
// crowds. Enraged bosses do both faster.
function fight(state: GameState, dt: number): void {
  const boss = state.boss!;
  const cfg = state.level.boss;
  updateSignature(state, dt);
  if (state.phase !== 'boss') return;
  // A charge takes over the boss: it neither creeps forward nor fires.
  if (signatureBusy(state)) return;

  if (!holdsGround(state)) boss.z -= cfg.advance * dt;
  if (boss.z - BOSS_HALF_D <= 0) {
    boss.z = BOSS_HALF_D;
    changeCount(state, -state.squad.count, boss.x, 0, 'bossContact');
    return;
  }

  const quiet = quietBeforeCharge(state);
  if (!quiet) boss.fireTimer -= dt;
  if (boss.fireTimer <= 0) {
    boss.fireTimer += cfg.fireEvery * (boss.enraged ? BOSS_ENRAGE_FIRE : 1);
    fireVolley(state);
    // The Fortress opens with a volley; after that its barrages are its attack.
    if (cfg.signature === 'fortress') boss.fireTimer = Infinity;
  }
  const charging = !quiet && boss.fireTimer <= BOSS_WINDUP;
  if (charging && !boss.charging) state.events.push({ type: 'bossWindup' });
  // A showing barrage glows the same way as a volley's warning.
  const barrage = boss.attack?.kind === 'barrage' && boss.attack.t <= BARRAGE_WARN;
  boss.charging = charging || barrage;

  if (cfg.summonEvery > 0 && summonsNow(state)) {
    boss.summonTimer -= dt;
    if (boss.summonTimer <= 0) {
      boss.summonTimer += cfg.summonEvery * (boss.enraged ? BOSS_ENRAGE_SUMMON : 1);
      summon(state);
    }
  }
}

function summon(state: GameState): void {
  const boss = state.boss!;
  const cfg = state.level.boss;
  const [r, next] = nextFloat(state.rngState);
  state.rngState = next;
  const depth = 1.5 + cfg.summonCount * 0.05;
  const front = boss.z - BOSS_HALF_D - 0.5 - depth;
  const crowd = expandHorde(
    { z: 0, x: boss.x, count: cfg.summonCount, hp: cfg.summonHp, width: BOSS_SUMMON_WIDTH, depth },
    Math.floor(r * 2 ** 31),
  );
  for (const s of crowd) state.entities.push(spawnEntity(state, s, front + s.z));
  state.events.push({ type: 'bossSummon', x: boss.x });
}

function fireVolley(state: GameState): void {
  const boss = state.boss!;
  const pattern = boss.enraged ? ENRAGED_PATTERN[state.level.boss.pattern] : state.level.boss.pattern;
  for (const offset of PATTERNS[pattern]) {
    const [r, next] = nextFloat(state.rngState);
    state.rngState = next;
    const jitter = (r * 2 - 1) * BOSS_AIM_JITTER;
    state.projectiles.push({
      x: Math.min(1, Math.max(-1, state.squad.x + offset + jitter)),
      z: boss.z,
      originX: boss.x,
      originZ: boss.z,
    });
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
    const kills = soldiersHit(state, formationSlots(state.squad.count), p.x, PROJECTILE_RADIUS, PROJECTILE_BLAST_DEPTH);
    if (kills > 0) changeCount(state, -kills, p.x, 0, 'bossShot');
  }
  state.projectiles = remaining;
}
