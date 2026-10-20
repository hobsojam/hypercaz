import { describe, expect, it } from 'vitest';
import { formationSlots } from '../../games/squad/sim/formation.ts';
import { SquadView } from '../../games/squad/render/squadView.ts';

describe('SquadView', () => {
  it('new soldiers start at the centre of the squad', () => {
    const view = new SquadView();
    view.update(formationSlots(5), 1);
    view.update(formationSlots(8), 0);
    expect(view.positions.slice(5)).toEqual([{ dx: 0, dz: 0 }, { dx: 0, dz: 0 }, { dx: 0, dz: 0 }]);
  });

  it('rescued soldiers start where they were rescued and run into formation', () => {
    const view = new SquadView();
    view.update(formationSlots(5), 1);
    view.update(formationSlots(8), 0, { dx: 0.5, dz: 10 });
    expect(view.positions.slice(5)).toEqual([{ dx: 0.5, dz: 10 }, { dx: 0.5, dz: 10 }, { dx: 0.5, dz: 10 }]);
    // Soldiers already in the squad stay where they were.
    expect(view.positions.slice(0, 5)).toEqual(formationSlots(5).map(({ dx, dz }) => ({ dx, dz })));
    for (let i = 0; i < 60; i++) view.update(formationSlots(8), 1 / 60);
    const slots = formationSlots(8);
    view.positions.forEach((p, i) => {
      expect(p.dx).toBeCloseTo(slots[i].dx, 2);
      expect(p.dz).toBeCloseTo(slots[i].dz, 2);
    });
  });
});
