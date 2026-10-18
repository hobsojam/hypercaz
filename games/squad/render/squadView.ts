import type { Slot } from '../sim/formation.ts';

// Displayed soldier positions, eased toward the formation layout so the squad
// re-flows smoothly as it grows and shrinks. New soldiers start at the centre.
export class SquadView {
  private points: { dx: number; dz: number }[] = [];

  update(slots: Slot[], dt: number): void {
    if (this.points.length > slots.length) this.points.length = slots.length;
    while (this.points.length < slots.length) this.points.push({ dx: 0, dz: 0 });
    const k = Math.min(1, 10 * dt);
    for (let i = 0; i < slots.length; i++) {
      const p = this.points[i];
      p.dx += (slots[i].dx - p.dx) * k;
      p.dz += (slots[i].dz - p.dz) * k;
    }
  }

  get positions(): readonly { dx: number; dz: number }[] {
    return this.points;
  }
}
