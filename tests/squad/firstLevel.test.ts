import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { botInput, runLevel } from '../../games/squad/sim/bot.ts';
import { validateLevel } from '../../games/squad/sim/level.ts';
import { createState } from '../../games/squad/sim/state.ts';
import { step } from '../../games/squad/sim/step.ts';

const level = validateLevel(JSON.parse(readFileSync(new URL('../../games/squad/levels/01.json', import.meta.url), 'utf8')), '01.json');

test.each([1, 2, 3])('missing the opening rescue leaves a viable recovery route (seed %i)', seed => {
  const end = runLevel(level, seed, s => s.time < 5 ? { targetX: -0.9 } : botInput(s), 60);
  expect(end.phase).toBe('won');
  expect(end.squad.count).toBeGreaterThanOrEqual(level.stars[0]);
});

test.each([1, 2, 3])('a new player can finish within a minute without using Rapid Fire (seed %i)', seed => {
  const end = runLevel(level, seed, s => ({ ...botInput(s), burst: false }), 60);
  expect(end.phase).toBe('won');
});

test.each([1, 2, 3])('Rapid Fire charges early and allows time to discover the control (seed %i)', seed => {
  const state = createState(level, seed);
  let readyAt: number | undefined;
  let burstAt: number | undefined;
  let lossAt: number | undefined;
  for (let i = 0; i < 60 * 60 && state.phase !== 'won' && state.phase !== 'lost'; i++) {
    // Follow the coaching: allow reading time, then spend a charge on a
    // visible crowd. The general bot deliberately saves small encounters.
    const input = botInput(state);
    input.burst = readyAt !== undefined && state.time - readyAt > 2
      && state.entities.some(e => e.type === 'enemy' && e.z > 0 && e.z < 45);
    step(state, input, 1 / 60);
    for (const e of state.events) {
      if (e.type === 'burstReady') readyAt ??= state.time;
      if (e.type === 'burstStart') burstAt ??= state.time;
      if (e.type === 'lose') lossAt ??= state.time;
    }
  }
  expect(readyAt).toBeDefined();
  expect(readyAt!).toBeLessThan(12);
  expect(burstAt).toBeDefined();
  expect(burstAt!).toBeLessThan(25);
  expect(burstAt! - readyAt!).toBeGreaterThan(2);
  if (lossAt !== undefined) expect(lossAt - readyAt!).toBeGreaterThan(3);
});
