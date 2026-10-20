import { describe, expect, it } from 'vitest';
import { updateContacts } from '../../../games/squad/sim/contact.ts';
import { createState, spawnEntity, type GameState } from '../../../games/squad/sim/state.ts';
import { step } from '../../../games/squad/sim/step.ts';
import { DT, makeLevel } from '../fixtures.ts';

function runCollect(s: GameState, seconds: number, targetX = 0) {
  const events: GameState['events'] = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    step(s, { targetX }, DT);
    events.push(...s.events);
  }
  return events;
}

describe('enemy contact', () => {
  it('an enemy reaching the squad kills one soldier', () => {
    const s = createState(makeLevel({ startSquad: 5, spawns: [{ z: 20, x: 0, type: 'enemy', hp: 1000 }] }), 1);
    runCollect(s, 3);
    expect(s.squad.count).toBe(4);
    expect(s.entities.filter((e) => e.type === 'enemy')).toHaveLength(0);
  });

  it('a heavy kills its kills value', () => {
    const s = createState(makeLevel({ startSquad: 5, spawns: [{ z: 20, x: 0, type: 'heavy', hp: 1000, kills: 3 }] }), 1);
    runCollect(s, 3);
    expect(s.squad.count).toBe(2);
  });

  it('enemies that miss the squad walk past harmlessly', () => {
    const s = createState(makeLevel({ startSquad: 5, spawns: [{ z: 30, x: 0.9, type: 'enemy', hp: 1000 }] }), 1);
    runCollect(s, 4, -0.5);
    expect(s.squad.count).toBe(5);
  });
});

describe('gates', () => {
  it('walking through a gate applies its value', () => {
    const s = createState(makeLevel({ spawns: [{ z: 1, x: 0, type: 'gate', width: 0.4, value: 6 }] }), 1);
    runCollect(s, 0.2);
    expect(s.squad.count).toBe(7);
  });

  it('passing beside a gate does nothing', () => {
    const s = createState(makeLevel({ spawns: [{ z: 1, x: 0.8, type: 'gate', width: 0.3, value: 6 }] }), 1);
    runCollect(s, 0.2);
    expect(s.squad.count).toBe(1);
  });
});

describe('hazards', () => {
  it('kills the soldiers it overlaps', () => {
    const s = createState(makeLevel({ startSquad: 11, spawns: [{ z: 1, x: 0, type: 'hazard', kind: 'blade', width: 0.2 }] }), 1);
    runCollect(s, 0.2);
    // Rows of 7 + 4: the blade covers 3 of the front row and 2 of the row behind.
    expect(s.squad.count).toBe(6);
  });
});

describe('losing', () => {
  it('several fatal contacts in one step clamp to zero and lose once', () => {
    const s = createState(
      makeLevel({
        startSquad: 3,
        spawns: [
          { z: 0.1, x: 0, type: 'gate', width: 0.4, value: -10 },
          { z: 0.5, x: 0, type: 'enemy', hp: 1000 },
        ],
      }),
      1,
    );
    step(s, { targetX: 0 }, DT);
    expect(s.squad.count).toBe(0);
    expect(s.phase).toBe('lost');
    expect(s.events.filter((e) => e.type === 'lost')).toHaveLength(1);
  });
});

describe('loss attribution', () => {
  it.each([
    { type: 'enemy', hp: 1000, kills: 2, cause: 'enemy', amount: 2 },
    { type: 'heavy', hp: 1000, kills: 3, cause: 'heavy', amount: 3 },
    { type: 'gate', width: 1, value: -99, cause: 'gate', amount: 5 },
    { type: 'hazard', width: 2, kind: 'blade', cause: 'blade', amount: 5 },
    { type: 'hazard', width: 2, kind: 'fire', cause: 'fire', amount: 5 },
    { type: 'hazard', width: 2, kind: 'barricade', cause: 'barricade', amount: 5 },
  ])('$cause reports the soldiers actually lost', ({ cause, amount, ...spawn }) => {
    const s = createState(makeLevel({ startSquad: 5, spawns: [{ z: 0, x: 0, ...spawn }] }), 1);
    s.entities = [spawnEntity(s, s.level.spawns[0], 0)];
    updateContacts(s);
    expect(s.events).toContainEqual(expect.objectContaining({ type: 'lose', cause, amount }));
  });
});
