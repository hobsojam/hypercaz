import { FORMATION_MAX_WIDTH, MAX_DRAWN, SLOT_DX, SLOT_DZ } from './constants.ts';

export interface Slot {
  dx: number;
  dz: number;
}

const PER_ROW = Math.floor(FORMATION_MAX_WIDTH / SLOT_DX + 1e-9) + 1;

// Rows fill front-first; each row (including a partial last row) is centred.
// Beyond the width cap the squad grows deeper, never wider.
export function formationSlots(count: number): Slot[] {
  const drawn = Math.min(Math.max(0, Math.floor(count)), MAX_DRAWN);
  const slots: Slot[] = [];
  for (let start = 0, row = 0; start < drawn; start += PER_ROW, row++) {
    const inRow = Math.min(PER_ROW, drawn - start);
    for (let i = 0; i < inRow; i++) {
      slots.push({ dx: (i - (inRow - 1) / 2) * SLOT_DX, dz: row === 0 ? 0 : -row * SLOT_DZ });
    }
  }
  return slots;
}

export function formationHalfWidth(slots: Slot[]): number {
  let max = 0.03;
  for (const s of slots) max = Math.max(max, Math.abs(s.dx));
  return max;
}
