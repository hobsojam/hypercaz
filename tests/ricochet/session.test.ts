import { expect, test } from 'vitest';
import { createStorage } from '../../engine/storage.ts';
import { Session } from '../../games/ricochet/session.ts';

const finish = (s: Session) => { for (let i = 0; i < 2000 && s.state.phase === 'flying'; i++) s.update(1 / 60); };

test('winning records best stars in a dedicated session store', () => {
  const storage = createStorage('ricochet-test', null);
  const s = new Session(storage);
  expect(s.fire()).toBe(true);
  finish(s);
  expect(s.state.phase).toBe('won');
  expect(s.best[1]).toBe(3);
  expect(new Session(storage).best[1]).toBe(3);
});

test('retry resets cages, shots, effects and the in-flight ball', () => {
  const s = new Session();
  s.fire(); s.update(0.2);
  expect(s.state.ball).not.toBeNull();
  s.retry();
  expect(s.state.phase).toBe('aiming');
  expect(s.state.ball).toBeNull();
  expect(s.state.shotsUsed).toBe(0);
  expect(s.effects).toHaveLength(0);
});

test('pause freezes the attempt and resume preserves its position', () => {
  const s = new Session();
  s.fire(); s.update(0.1); s.togglePause();
  const before = structuredClone(s.state);
  s.update(1); expect(s.state).toEqual(before);
  expect(s.fire()).toBe(false);
  s.togglePause(); s.update(0.1);
  expect(s.state.ball!.y).toBeLessThan(before.ball!.y);
});

test('level selection interrupts flight cleanly and every puzzle is selectable', () => {
  const s = new Session(); s.fire(); s.showLevels();
  s.select(7);
  expect(s.state.level.id).toBe(8);
  expect(s.state.ball).toBeNull();
  expect(s.state.shotsUsed).toBe(0);
  expect(s.paused).toBe(false);
  expect(s.select(99)).toBe(false);
  expect(s.state.level.id).toBe(8);
});

test('next is only available after winning and leaves best results intact', () => {
  const s = new Session();
  expect(s.next()).toBe(false);
  s.fire(); finish(s);
  expect(s.next()).toBe(true);
  expect(s.state.level.id).toBe(2);
  expect(s.best[1]).toBe(3);
});

test('corrupt saved progress is ignored without blocking play', () => {
  const storage = createStorage('bad', null);
  storage.set('progress', { best: { 1: 3, 2: 8, 3: -1, 4: '3', 1000: 3 }, muted: 'yes' });
  const s = new Session(storage);
  expect(s.best).toEqual({ 1: 3 });
  expect(s.muted).toBe(false);
  expect(s.fire()).toBe(true);
});

test('best scores never decrease and mute is remembered separately from Squad progress', () => {
  const storage = createStorage('ricochet-test', null);
  storage.set('progress', { best: { 1: 3 }, muted: false });
  const s = new Session(storage);
  s.state.shotsUsed = 1; s.fire(); finish(s);
  expect(s.best[1]).toBe(3);
  s.toggleMute();
  expect(new Session(storage).muted).toBe(true);
});

test('sounds are consumed once and the guide follows new aim without spending shots', () => {
  const s = new Session();
  const before = s.guide;
  s.aimAt({ x: 460, y: 300 });
  expect(s.guide).not.toEqual(before);
  expect(s.state.shotsUsed).toBe(0);
  s.fire();
  expect(s.takeSounds()).toContain('shot');
  expect(s.takeSounds()).toEqual([]);
});
