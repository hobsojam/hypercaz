import { expect, test } from 'vitest';
import { createStorage } from '../../engine/storage.ts';
import type { ArrowGame } from '../../games/arrows/game.ts';
import { EscapeScene } from '../../games/arrows/scene.ts';
import { boardFor, cellAt, buttonsFor } from '../../games/arrows/layout.ts';
import { PUZZLES } from '../../games/arrows/levels.ts';
import { render } from '../../games/arrows/render.ts';
import { Session } from '../../games/arrows/session.ts';
import { stubCtx } from '../squad/stubCtx.ts';

function fixture() {
  const keys = new Set<string>(); let click: { x: number; y: number } | null = null;
  const sounds: string[] = [], statuses: string[] = [], links: string[] = [];
  const game = {
    input: { endFrame: () => { keys.clear(); click = null; }, consumeKey: (key: string) => keys.delete(key), consumeClick: () => { const p = click; click = null; return p; }, touch: false },
    audio: { muted: false, play: (s: string) => sounds.push(s), unlock: () => undefined },
    storage: createStorage('test', null), announce: (s: string) => statuses.push(s),
  } as unknown as ArrowGame;
  const scene = new EscapeScene(game); scene.navigate = url => links.push(url);
  return { game, scene, sounds, statuses, links, queue: (key: string) => keys.add(key), press: (key: string) => { keys.add(key); scene.update(1 / 60); }, tap: (x: number, y: number) => { click = { x, y }; scene.update(1 / 60); } };
}

function tapCell(f: ReturnType<typeof fixture>, x: number, y: number) {
  const b = boardFor(f.scene.session.state.puzzle);
  f.tap(b.x + (x + 0.5) * b.cell, b.y + (y + 0.5) * b.cell);
}

test('touch/mouse can select any cell of a long shaft; outside clicks do nothing', () => {
  const f = fixture(); f.scene.session.select(1);
  f.tap(-10, 300); expect(f.scene.session.state.remaining.size).toBe(4);
  tapCell(f, 1, 2); expect(f.scene.session.feedback?.id).toBe(1);
  expect(f.scene.session.state.remaining.size).toBe(4);
  tapCell(f, 3, 0); expect(f.scene.session.flight?.arrow.id).toBe(3);
});

test('keyboard hint and Enter remove an arrow; repeated activation during flight is ignored', () => {
  const f = fixture(); f.press('h'); f.press('Enter'); f.press(' ');
  expect(f.scene.session.state.remaining.size).toBe(2);
  expect(f.sounds.filter(s => s === 'place')).toHaveLength(1);
  expect(f.statuses.at(-1)).toContain('escaping');
});

test('pause blocks board and hint input; hide freezes the animation', () => {
  const f = fixture(); f.press('Escape'); tapCell(f, 2, 0); f.press('h');
  expect(f.scene.session.state.remaining.size).toBe(3);
  f.press('Enter'); f.press('h'); f.press(' '); f.scene.suspend();
  const age = f.scene.session.flight!.age; f.scene.update(1);
  expect(f.scene.session.flight!.age).toBe(age);
  expect(f.scene.session.paused).toBe(true);
});

test('puzzle grid supports keyboard selection, retry resets and mute never removes a piece', () => {
  const f = fixture(); f.press('l'); f.press('ArrowRight'); f.press('ArrowDown'); f.press('Enter');
  expect(f.scene.session.index).toBe(4);
  f.press('h'); f.press(' '); f.press('r'); expect(f.scene.session.flight).toBeNull();
  const remaining = f.scene.session.state.remaining.size;
  f.tap(512, 24); expect(f.game.audio.muted).toBe(true);
  expect(f.scene.session.muted).toBe(true); expect(f.scene.session.state.remaining.size).toBe(remaining);
  f.tap(45, 24); expect(f.links).toEqual(['../']);
});

test('every board maps its edge cells correctly and footer buttons stay outside the board', () => {
  for (const p of PUZZLES) {
    const b = boardFor(p);
    expect(b.cell).toBeGreaterThanOrEqual(60);
    expect(cellAt(p, { x: b.x + b.cell / 2, y: b.y + b.cell / 2 })).toEqual({ x: 0, y: 0 });
    expect(cellAt(p, { x: b.x + b.w - 1, y: b.y + b.h - 1 })).toEqual({ x: p.size - 1, y: p.size - 1 });
    expect(cellAt(p, { x: b.x + b.w, y: b.y })).toBeNull();
    expect(cellAt(p, { x: b.x, y: b.y - 1 })).toBeNull();
  }
  const s = new Session(createStorage('test', null));
  for (const b of buttonsFor(s)) { expect(b.h).toBeGreaterThanOrEqual(56); expect(b.y).toBeGreaterThan(710); }
});

test('rendering play, pause, grid and win is read-only and gives visible instructions and results', () => {
  const s = new Session(createStorage('test', null)); const ctx = stubCtx();
  const before = JSON.stringify({ remaining: [...s.state.remaining], focus: s.focus, screen: s.screen });
  render(ctx, s);
  expect(JSON.stringify({ remaining: [...s.state.remaining], focus: s.focus, screen: s.screen })).toBe(before);
  s.togglePause(); render(ctx, s); s.showPuzzles(); render(ctx, s); s.select(0); s.screen = 'won'; render(ctx, s);
  const text = ctx.calls.fillText.map(c => c[0]);
  expect(text).toContain('ARROW ESCAPE'); expect(text).toContain('Paused');
  expect(text).toContain('Choose a puzzle'); expect(text).toContain('Board clear!');
});


test.each(['Enter', 'Escape', ' '])('hiding clears a queued %s so returning cannot resume without fresh input', key => {
  const f = fixture();
  f.queue(key); f.scene.suspend(); f.scene.update(1 / 60);
  expect(f.scene.session.paused).toBe(true);
  expect(f.scene.session.state.remaining.size).toBe(3);
  f.press('Enter'); expect(f.scene.session.paused).toBe(false);
});

test('Back to puzzle preserves the attempt instead of performing Retry', () => {
  const f = fixture(); f.press('h'); f.press('Enter'); f.scene.update(1);
  f.press('l'); f.tap(270, 850);
  expect(f.scene.session.screen).toBe('play');
  expect(f.scene.session.state.remaining.size).toBe(2);
});
