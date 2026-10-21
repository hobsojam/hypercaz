import { expect, test } from 'vitest';
import { createStorage } from '../../engine/storage.ts';
import type { CarGame } from '../../games/car/game.ts';
import { ParkScene } from '../../games/car/scene.ts';
import { render } from '../../games/car/render.ts';
import { Session } from '../../games/car/session.ts';
import { stubCtx } from '../squad/stubCtx.ts';

function fixture() {
  const keys = new Set<string>(); let click: { x: number; y: number } | null = null;
  let release: { x: number; y: number } | null = null;
  const links: string[] = [], statuses: string[] = [];
  const input = {
    pointerX: null as number | null, pointerY: null as number | null, held: false,
    consumeKey: (key: string) => keys.delete(key), consumeClick: () => { const p = click; click = null; return p; },
    consumeRelease: () => { const p = release; release = null; return p; }, endFrame: () => { keys.clear(); click = null; release = null; },
  };
  const game = {
    input, audio: { muted: false, play: () => undefined }, storage: createStorage('test', null), announce: (s: string) => statuses.push(s),
  } as unknown as CarGame;
  const scene = new ParkScene(game); scene.navigate = url => links.push(url);
  return {
    scene, input, statuses, links,
    press: (key: string) => { keys.add(key); scene.update(); },
    tap: (x: number, y: number) => { click = { x, y }; input.pointerX = x; input.pointerY = y; input.held = true; scene.update(); release = { x, y }; input.held = false; scene.update(); },
    drag: (x: number, y: number, toX: number, toY: number) => {
      click = { x, y }; input.pointerX = x; input.pointerY = y; input.held = true; scene.update();
      input.pointerX = toX; input.pointerY = toY; scene.update();
      release = { x: toX, y: toY }; input.held = false; scene.update();
    },
  };
}

test('a drag previews legal positions, commits once and supports undo after winning', () => {
  const f = fixture(), s = f.scene.session;
  f.drag(297, 358, 297, 720); // clamp vertical car to last legal cell
  expect(s.state.positions[1]).toBe(4);
  expect(s.history).toHaveLength(1);
  f.drag(117, 430, 500, 430);
  expect(s.screen).toBe('won');
  expect(s.state.positions[0]).toBe(4);
  f.press('u');
  expect(s.screen).toBe('play');
  expect(s.state.positions[0]).toBe(0);
});

test('keyboard selects and moves a car, while pause and puzzle controls work', () => {
  const f = fixture(), s = f.scene.session;
  f.press('Enter'); expect(s.selected).toBe(0);
  f.press('ArrowRight'); expect(s.state.positions[0]).toBe(1);
  f.press('Enter'); expect(s.selected).toBeNull();
  f.press('Escape'); expect(s.paused).toBe(true);
  f.press('ArrowRight'); expect(s.state.positions[0]).toBe(1);
  f.press('Enter'); expect(s.paused).toBe(false);
  f.press('l'); expect(s.screen).toBe('levels');
  f.press('ArrowDown'); f.press('Enter'); expect(s.index).toBe(2);
  f.tap(42, 24); expect(f.links).toEqual(['../']);
});

test('rendering selection, a drag preview, pause and win does not mutate the board', () => {
  const s = new Session(createStorage('test', null)), ctx = stubCtx();
  const before = [...s.state.positions];
  render(ctx, s, { index: 1, position: 2.5 });
  s.togglePause(); render(ctx, s); s.togglePause(); s.screen = 'won'; render(ctx, s);
  expect(s.state.positions).toEqual(before);
  expect(ctx.calls.fillText.map(c => c[0])).toContain('CAR PARK');
  expect(ctx.calls.fillText.map(c => c[0])).toContain('The lane is clear!');
});
