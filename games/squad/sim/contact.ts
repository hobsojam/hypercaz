import type { GameState } from './state.ts';

// Every change to the squad size goes through here so peak tracking, events
// and the lose condition stay consistent.
export function changeCount(state: GameState, delta: number, x: number, z: number): void {
  const { squad } = state;
  const before = squad.count;
  squad.count = Math.max(0, squad.count + delta);
  squad.peak = Math.max(squad.peak, squad.count);
  const applied = squad.count - before;
  if (applied !== 0) state.events.push({ type: applied > 0 ? 'gain' : 'lose', amount: Math.abs(applied), x, z });
  if (squad.count === 0 && state.phase !== 'lost') {
    state.phase = 'lost';
    state.events.push({ type: 'lost' });
  }
}

export function updateContacts(state: GameState): void {
  void state;
}
