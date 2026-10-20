import { expect, test } from 'vitest';
import { createStorage } from '../../engine/storage.ts';
import { PUZZLES } from '../../games/arrows/levels.ts';
import { Session } from '../../games/arrows/session.ts';
import { loadProgress } from '../../games/arrows/progress.ts';
import { removable } from '../../games/arrows/sim.ts';

function win(s: Session) {
  while (s.screen === 'play') {
    const arrow = removable(s.state.puzzle, s.state.remaining)[0];
    expect(s.attempt(arrow.id)).toBe(true);
    s.update(1);
  }
}

test('blocked attempt marks the first blocker and never removes an arrow', () => {
  const s = new Session(createStorage('test', null));
  expect(s.attempt(1)).toBe(false);
  expect(s.state.remaining.size).toBe(3);
  expect(s.feedback).toMatchObject({ id: 1, blocker: 2 });
  expect(s.status).toContain('Blocked');
  s.update(1); expect(s.feedback).toBeNull();
});

test('hint highlights a legal move, moves focus and costs nothing', () => {
  const s = new Session(createStorage('test', null));
  s.hint();
  expect(s.hintId).toBe(3);
  expect(s.focus).toEqual({ x: 2, y: 0 });
  expect(s.state.remaining.size).toBe(3);
  expect(s.attemptFocus()).toBe(true);
  expect(s.hintId).toBeNull();
});

test('flight locks further input and success waits for the last exit animation', () => {
  const s = new Session(createStorage('test', null));
  s.attempt(3);
  expect(s.attempt(2)).toBe(false);
  expect(s.state.remaining.size).toBe(2);
  s.update(1); s.attempt(2); s.update(1); s.attempt(1);
  expect(s.screen).toBe('play');
  expect(s.completed.has(1)).toBe(false);
  s.update(1);
  expect(s.screen).toBe('won');
  expect(s.completed.has(1)).toBe(true);
  s.update(1); expect(s.takeSounds().filter(s => s === 'win')).toHaveLength(1);
});

test('pause and hiding freeze flight and require explicit resume', () => {
  const s = new Session(createStorage('test', null));
  s.attempt(3); s.suspend(); s.suspend();
  expect(s.paused).toBe(true);
  s.update(1); expect(s.flight?.age).toBe(0);
  expect(s.attempt(2)).toBe(false);
  s.togglePause(); s.update(1); expect(s.flight).toBeNull();
});

test('retry and puzzle selection clear transient state; invalid selection is a no-op', () => {
  const s = new Session(createStorage('test', null));
  s.attempt(3); s.retry();
  expect(s.state.remaining.size).toBe(3); expect(s.flight).toBeNull();
  s.hint(); s.attempt(1); s.togglePause();
  expect(s.select(8)).toBe(true);
  expect(s.index).toBe(8); expect(s.paused).toBe(false);
  expect(s.feedback).toBeNull(); expect(s.hintId).toBeNull();
  expect(s.select(NaN)).toBe(false); expect(s.select(12)).toBe(false); expect(s.index).toBe(8);
  s.showPuzzles(); expect(s.screen).toBe('levels');
});

test('completion and mute persist separately; launch finds the first incomplete puzzle', () => {
  const m = new Map<string, string>();
  const storage = createStorage('test', { getItem: k => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); } });
  const s = new Session(storage); win(s); s.setMuted(true);
  const again = new Session(storage);
  expect(again.index).toBe(1); expect(again.completed.has(1)).toBe(true); expect(again.muted).toBe(true);
  again.select(0); win(again); expect([...again.completed]).toEqual([1]);
  storage.set('progress', { completed: PUZZLES.map(p => p.id) });
  const all = new Session(storage); expect(all.index).toBe(0);
  all.select(11); win(all); all.next(); expect(all.screen).toBe('levels');
});

test('corrupt ids and scores are sanitized; blocked storage still allows completion', () => {
  const storage = createStorage('test', null);
  storage.set('progress', { completed: [1, 1, 99, '2', -1, 2.5], muted: 'yes' });
  expect(loadProgress(storage)).toEqual({ completed: [1], muted: false });
  storage.set('progress', null); expect(loadProgress(storage)).toEqual({ completed: [], muted: false });
  const blocked = createStorage('blocked', { getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('full'); } });
  const s = new Session(blocked); win(s); expect(loadProgress(blocked).completed).toEqual([1]);
});

test('keyboard cursor clamps to the board and missing or stale ids are harmless', () => {
  const s = new Session(createStorage('test', null));
  s.moveFocus(-100, 100); expect(s.focus).toEqual({ x: 0, y: 3 });
  expect(s.attemptFocus()).toBe(false); expect(s.attempt(99)).toBe(false);
  s.moveFocus(100, -100); expect(s.focus).toEqual({ x: 3, y: 0 });
});
