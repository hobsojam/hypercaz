// Later bosses' signature attacks: the Strafer slides across the road, the
// Charger lunges down the squad's lane, and the Fortress alternates barrages
// with a shield. Each one is announced on the road before it lands.
import { STRAFE_PERIOD, STRAFE_PERIOD_ENRAGED, STRAFE_RANGE } from './constants.ts';
import type { GameState } from './state.ts';

export function updateSignature(state: GameState, dt: number): void {
  if (state.level.boss.signature === 'strafe') strafe(state, dt);
}

// Advancing the phase (rather than deriving it from time) keeps the slide
// smooth when enraging changes its speed.
function strafe(state: GameState, dt: number): void {
  const boss = state.boss!;
  const period = boss.enraged ? STRAFE_PERIOD_ENRAGED : STRAFE_PERIOD;
  boss.strafeT += (dt * 2 * Math.PI) / period;
  boss.x = STRAFE_RANGE * Math.sin(boss.strafeT);
}
