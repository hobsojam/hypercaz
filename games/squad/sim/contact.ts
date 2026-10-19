import { formationHalfWidth, formationSlots, type Slot } from './formation.ts';
import type { Entity, GameState } from './state.ts';

// Every change to the squad size goes through here so peak tracking, events
// and the lose condition stay consistent.
export function changeCount(state: GameState, delta: number, x: number, z: number): void {
  const { squad } = state;
  const before = squad.count;
  squad.count = Math.max(0, squad.count + delta);
  squad.peak = Math.max(squad.peak, squad.count);
  const applied = squad.count - before;
  if (applied !== 0) state.events.push({ type: applied > 0 ? 'gain' : 'lose', amount: Math.abs(applied), x, z });
  if (squad.count === 0 && (state.phase === 'advance' || state.phase === 'boss')) {
    state.phase = 'lost';
    state.events.push({ type: 'lost' });
  }
}

// How many soldiers sit within `halfW` of `x` (and, if given, within `depth`
// metres of the front line), scaled from drawn slots to the real count (only
// up to 150 slots exist even for much bigger squads).
export function soldiersHit(state: GameState, slots: Slot[], x: number, halfW: number, depth = Infinity): number {
  let hit = 0;
  for (const s of slots) if (Math.abs(state.squad.x + s.dx - x) <= halfW && -s.dz <= depth) hit++;
  return hit === 0 ? 0 : Math.ceil((hit * state.squad.count) / slots.length);
}

export function updateContacts(state: GameState): void {
  const removed = new Set<Entity>();
  for (const e of state.entities) {
    if (state.phase === 'lost' || state.phase === 'won') break;
    const slots = formationSlots(state.squad.count);
    const { x } = state.squad;
    switch (e.type) {
      case 'enemy':
      case 'heavy':
        if (e.z - e.halfD <= 0 && Math.abs(e.x - x) <= formationHalfWidth(slots) + e.halfW) {
          changeCount(state, -e.kills, e.x, 0);
          removed.add(e);
        }
        break;
      case 'gate':
        if (e.z <= 0 && !e.resolved) {
          e.resolved = true;
          if (Math.abs(x - e.x) <= e.halfW) {
            changeCount(state, e.value, e.x, 0);
            removed.add(e);
          }
        }
        break;
      case 'hazard':
        if (e.z <= 0 && !e.resolved) {
          e.resolved = true;
          const kills = soldiersHit(state, slots, e.x, e.halfW);
          if (kills > 0) changeCount(state, -kills, e.x, 0);
        }
        break;
    }
  }
  if (removed.size > 0) state.entities = state.entities.filter((e) => !removed.has(e));
}
