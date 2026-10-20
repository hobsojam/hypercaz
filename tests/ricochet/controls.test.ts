import { expect, test } from 'vitest';
import { Controls, buttonsFor } from '../../games/ricochet/controls.ts';
import { Session } from '../../games/ricochet/session.ts';

const setup = () => { const session = new Session(); return { session, input: new Controls(session) }; };

test('a drag aims and its release fires, while cancellation never spends a shot', () => {
  const { session, input } = setup();
  expect(input.down(1, { x: 270, y: 760 })).toBe(true);
  input.move(1, { x: 270, y: 330 });
  input.cancel(1);
  input.up(1, { x: 270, y: 330 });
  expect(session.state.shotsUsed).toBe(0);
  input.down(2, { x: 270, y: 760 }); input.move(2, { x: 270, y: 330 }); input.up(2, { x: 270, y: 330 });
  expect(session.state.shotsUsed).toBe(1);
});

test('another finger cannot steal or fire the active gesture', () => {
  const { session, input } = setup();
  input.down(1, { x: 270, y: 760 });
  expect(input.down(2, { x: 100, y: 300 })).toBe(false);
  input.up(2, { x: 100, y: 300 });
  expect(session.state.shotsUsed).toBe(0);
  input.up(1, { x: 270, y: 330 });
  expect(session.state.shotsUsed).toBe(1);
});

test.each([{ x: 0, y: 300 }, { x: 270, y: 780 }])('an invalid release cancels rather than firing at %j', point => {
  const { session, input } = setup();
  input.down(1, { x: 270, y: 500 }); input.up(1, point);
  expect(session.state.shotsUsed).toBe(0);
});

test('HUD buttons never aim or fire and require release over the same button', () => {
  const { session, input } = setup();
  const retry = buttonsFor(session).find(b => b.id === 'retry')!;
  input.down(1, { x: retry.x + 20, y: retry.y + 20 });
  input.up(1, { x: 270, y: 330 });
  expect(session.state.shotsUsed).toBe(0);
  const mute = buttonsFor(session).find(b => b.id === 'mute')!;
  input.down(2, { x: mute.x + 10, y: mute.y + 10 }); input.up(2, { x: mute.x + 10, y: mute.y + 10 });
  expect(session.muted).toBe(true);
  expect(session.state.shotsUsed).toBe(0);
});

test('keyboard controls aim, fire, retry, pause and navigate the puzzle grid', () => {
  const { session, input } = setup();
  input.key('ArrowRight'); expect(session.angle).toBeGreaterThan(-Math.PI / 2);
  input.key(' '); expect(session.state.phase).toBe('flying');
  input.key('r'); expect(session.state.shotsUsed).toBe(0);
  input.key('Escape'); expect(session.paused).toBe(true);
  input.key(' '); expect(session.state.shotsUsed).toBe(0);
  input.key('Escape'); expect(session.paused).toBe(false);
  session.showLevels(); input.key('ArrowRight'); input.key('Enter');
  expect(session.state.level.id).toBe(2);
});
