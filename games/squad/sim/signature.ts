// Later bosses' signature attacks: the Strafer slides across the road, the
// Charger lunges down the squad's lane, and the Fortress alternates barrages
// with a shield. Each one is announced on the road before it lands.
import {
  CHARGE_ENRAGED,
  CHARGE_EXPOSED,
  CHARGE_HALF_W,
  CHARGE_LUNGE,
  CHARGE_REACH_Z,
  CHARGE_RETURN,
  CHARGE_SLIDE,
  CHARGE_WARN,
  EXPOSED_DAMAGE,
  STRAFE_PERIOD,
  STRAFE_PERIOD_ENRAGED,
  STRAFE_RANGE,
} from './constants.ts';
import { changeCount, soldiersHit } from './contact.ts';
import { formationSlots } from './formation.ts';
import type { GameState } from './state.ts';

export function updateSignature(state: GameState, dt: number): void {
  const signature = state.level.boss.signature;
  if (signature === 'strafe') strafe(state, dt);
  if (signature === 'charge') charge(state, dt);
}

// True while the attack takes over the boss: no advancing or volleys.
export function signatureBusy(state: GameState): boolean {
  return state.boss?.attack?.kind === 'charge';
}

// How much of a bullet's damage reaches the boss.
export function bossDamageFactor(state: GameState): number {
  const attack = state.boss?.attack;
  if (attack?.kind === 'charge' && attack.stage === 'exposed') return EXPOSED_DAMAGE;
  return 1;
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

function next(attack: { stage: string; t: number }, stage: 'lunge' | 'exposed' | 'return'): void {
  attack.stage = stage;
  attack.t = 0;
}
