// Later bosses' signature attacks: the Strafer slides across the road, the
// Charger lunges down the squad's lane, and the Fortress alternates barrages
// with a shield. Each one is announced on the road before it lands.
import {
  BARRAGE_COUNT,
  BARRAGE_COUNT_ENRAGED,
  BARRAGE_GAP,
  BARRAGE_MAX_SHIFT,
  BARRAGE_SPACING,
  BARRAGE_SPACING_ENRAGED,
  BARRAGE_WARN,
  CHARGE_ENRAGED,
  CHARGE_EXPOSED,
  CHARGE_HALF_W,
  CHARGE_LUNGE,
  CHARGE_REACH_Z,
  CHARGE_RETURN,
  CHARGE_SLIDE,
  CHARGE_WARN,
  EXPOSED_DAMAGE,
  SHIELD_BURST,
  SHIELD_DAMAGE,
  STRAFE_PERIOD,
  STRAFE_PERIOD_ENRAGED,
  STRAFE_RANGE,
  STUN_SECONDS,
} from './constants.ts';
import { nextFloat } from '../../../engine/rng.ts';
import { changeCount, soldiersHit, soldiersOutside } from './contact.ts';
import { formationSlots } from './formation.ts';
import type { GameState } from './state.ts';

export function updateSignature(state: GameState, dt: number): void {
  const signature = state.level.boss.signature;
  if (signature === 'strafe') strafe(state, dt);
  if (signature === 'charge') charge(state, dt);
  if (signature === 'fortress') fortress(state, dt);
}

// A Fortress holds its ground while its shield is up.
export function holdsGround(state: GameState): boolean {
  return state.boss?.attack?.kind === 'shield';
}

// The Fortress only summons crowds while its shield is up or broken.
export function summonsNow(state: GameState): boolean {
  if (state.level.boss.signature !== 'fortress') return true;
  const kind = state.boss?.attack?.kind;
  return kind === 'shield' || kind === 'stunned';
}

// True while the attack takes over the boss: no advancing or volleys.
export function signatureBusy(state: GameState): boolean {
  return state.boss?.attack?.kind === 'charge';
}

// How much of a bullet's damage reaches the boss.
export function bossDamageFactor(state: GameState): number {
  const attack = state.boss?.attack;
  if (attack?.kind === 'charge' && attack.stage === 'exposed') return EXPOSED_DAMAGE;
  if (attack?.kind === 'shield') return SHIELD_DAMAGE;
  return 1;
}

// Applies a bullet's damage to the shield, if one is up, and returns the
// damage that reaches the boss. Rapid Fire hits the shield extra hard.
export function absorbHit(state: GameState, damage: number): number {
  const boss = state.boss;
  const attack = boss?.attack;
  if (attack?.kind === 'shield') {
    attack.hp -= damage * (state.burstTime > 0 ? SHIELD_BURST : 1);
    if (attack.hp <= 0) {
      boss!.attack = { kind: 'stunned', t: STUN_SECONDS };
      state.events.push({ type: 'shieldBreak' });
    }
    return damage * SHIELD_DAMAGE;
  }
  return damage * bossDamageFactor(state);
}

// Advancing the phase (rather than deriving it from time) keeps the slide
// smooth when enraging changes its speed.
function strafe(state: GameState, dt: number): void {
  const boss = state.boss!;
  const period = boss.enraged ? STRAFE_PERIOD_ENRAGED : STRAFE_PERIOD;
  boss.strafeT += (dt * 2 * Math.PI) / period;
  boss.x = STRAFE_RANGE * Math.sin(boss.strafeT);
}

const lerp = (a: number, b: number, f: number) => a + (b - a) * Math.min(1, Math.max(0, f));

// Warn (slide into the squad's lane, stripe on the road) → lunge down the lane
// → stay exposed at the front → walk back. Then wait for the next one.
function charge(state: GameState, dt: number): void {
  const boss = state.boss!;
  const attack = boss.attack;
  if (attack?.kind !== 'charge') {
    boss.signatureTimer -= dt;
    if (boss.signatureTimer > 0) return;
    const reach = 1 - CHARGE_HALF_W;
    const laneX = Math.min(reach, Math.max(-reach, state.squad.x));
    boss.attack = { kind: 'charge', stage: 'warn', t: 0, laneX, fromX: boss.x, fromZ: boss.z };
    boss.charging = true;
    state.events.push({ type: 'bossWindup' });
    return;
  }
  attack.t += dt;
  switch (attack.stage) {
    case 'warn':
      boss.x = lerp(attack.fromX, attack.laneX, attack.t / CHARGE_SLIDE);
      if (attack.t < CHARGE_WARN) return;
      boss.charging = false;
      next(attack, 'lunge');
      state.events.push({ type: 'bossCharge', x: attack.laneX });
      return;
    case 'lunge': {
      boss.z = lerp(attack.fromZ, CHARGE_REACH_Z, attack.t / CHARGE_LUNGE);
      if (attack.t < CHARGE_LUNGE) return;
      next(attack, 'exposed');
      const kills = soldiersHit(state, formationSlots(state.squad.count), attack.laneX, CHARGE_HALF_W);
      if (kills > 0) changeCount(state, -kills, attack.laneX, 0, 'bossCharge');
      return;
    }
    case 'exposed':
      if (attack.t >= CHARGE_EXPOSED) next(attack, 'return');
      return;
    case 'return':
      boss.z = lerp(CHARGE_REACH_Z, attack.fromZ, attack.t / CHARGE_RETURN);
      if (attack.t < CHARGE_RETURN) return;
      boss.attack = null;
      boss.signatureTimer = state.level.boss.chargeEvery * (boss.enraged ? CHARGE_ENRAGED : 1);
  }
}

// Barrages (shadows everywhere but one gap, then shells) → shield → stunned
// once the shield breaks → barrages again.
function fortress(state: GameState, dt: number): void {
  const boss = state.boss!;
  const attack = boss.attack;
  if (attack === null) {
    boss.signatureTimer -= dt;
    if (boss.signatureTimer <= 0) startBarrage(state, boss.enraged ? BARRAGE_COUNT_ENRAGED : BARRAGE_COUNT, state.squad.x);
    return;
  }
  if (attack.kind === 'stunned') {
    attack.t -= dt;
    if (attack.t <= 0) startBarrage(state, boss.enraged ? BARRAGE_COUNT_ENRAGED : BARRAGE_COUNT, state.squad.x);
    return;
  }
  if (attack.kind !== 'barrage') return;
  const wasHidden = attack.t > BARRAGE_WARN;
  attack.t -= dt;
  if (wasHidden && attack.t <= BARRAGE_WARN) announceBarrage(state);
  if (attack.t > 0) return;
  const kills = soldiersOutside(state, formationSlots(state.squad.count), attack.gapX, BARRAGE_GAP / 2);
  if (kills > 0) changeCount(state, -kills, attack.gapX, 0, 'bossShot');
  boss.charging = false;
  if (attack.left > 1) {
    // The next one lands a spacing later; it shows for the last BARRAGE_WARN seconds.
    const spacing = boss.enraged ? BARRAGE_SPACING_ENRAGED : BARRAGE_SPACING;
    boss.attack = { kind: 'barrage', t: spacing, gapX: nextGap(state, attack.gapX), left: attack.left - 1 };
    if (spacing <= BARRAGE_WARN) announceBarrage(state);
    return;
  }
  boss.attack = { kind: 'shield', hp: state.level.boss.shieldHp, maxHp: state.level.boss.shieldHp };
  state.events.push({ type: 'shieldUp' });
}

function startBarrage(state: GameState, count: number, fromX: number): void {
  state.boss!.attack = { kind: 'barrage', t: BARRAGE_WARN, gapX: nextGap(state, fromX), left: count };
  announceBarrage(state);
}

function announceBarrage(state: GameState): void {
  state.boss!.charging = true;
  state.events.push({ type: 'bossBarrage' });
}

// Somewhere new, but never further than the squad can get in the warning.
function nextGap(state: GameState, from: number): number {
  const [r, next] = nextFloat(state.rngState);
  state.rngState = next;
  const reach = 1 - BARRAGE_GAP / 2;
  return Math.min(reach, Math.max(-reach, from + (r * 2 - 1) * BARRAGE_MAX_SHIFT));
}

function next(attack: { stage: string; t: number }, stage: 'lunge' | 'exposed' | 'return'): void {
  attack.stage = stage;
  attack.t = 0;
}
