import { afterEach, describe, expect, it, test, vi } from 'vitest';
import { fitLetterbox, Input, toLogical } from '../../engine/input.ts';

test('wide window letterboxes the portrait canvas horizontally', () => {
  const lb = fitLetterbox(1920, 1080, 540, 960);
  expect(lb.scale).toBeCloseTo(1.125);
  expect(lb.offsetX).toBeCloseTo(656.25);
  expect(lb.offsetY).toBeCloseTo(0);
  const c = toLogical(lb, 960, 540);
  expect(c.x).toBeCloseTo(270);
  expect(c.y).toBeCloseTo(480);
});

test('mapping stays correct after a resize to a tall window', () => {
  const lb = fitLetterbox(800, 2000, 540, 960);
  const c = toLogical(lb, 400, 1000);
  expect(c.x).toBeCloseTo(270);
  expect(c.y).toBeCloseTo(480);
});

describe('Input', () => {
  afterEach(() => vi.unstubAllGlobals());

  // A window that only dispatches events, and an identity letterbox.
  function setup() {
    const win = new EventTarget();
    vi.stubGlobal('window', win);
    const input = new Input(() => ({ offsetX: 0, offsetY: 0, scale: 1 }));
    const fire = (type: string, props: Record<string, unknown> = {}) => {
      const e = Object.assign(new Event(type, { cancelable: true }), props);
      win.dispatchEvent(e);
      return e;
    };
    return { input, fire };
  }

  it('counts a primary press as a click', () => {
    const { input, fire } = setup();
    fire('pointerdown', { button: 0, clientX: 10, clientY: 20, pointerType: 'mouse' });
    expect(input.consumeClick()).toEqual({ x: 10, y: 20 });
  });

  it('tracks a primary drag and exposes its release once', () => {
    const { input, fire } = setup();
    fire('pointerdown', { button: 0, clientX: 10, clientY: 20, pointerType: 'touch' });
    expect(input.held).toBe(true);
    fire('pointermove', { clientX: 44, clientY: 25 });
    expect(input.pointerX).toBe(44);
    fire('pointerup', { button: 0, clientX: 50, clientY: 30 });
    expect(input.held).toBe(false);
    expect(input.consumeRelease()).toEqual({ x: 50, y: 30 });
    expect(input.consumeRelease()).toBeNull();
  });

  it('keeps the active drag with its first pointer when a second finger touches', () => {
    const { input, fire } = setup();
    fire('pointerdown', { button: 0, pointerId: 1, clientX: 10, clientY: 20, pointerType: 'touch' });
    fire('pointerdown', { button: 0, pointerId: 2, clientX: 80, clientY: 90, pointerType: 'touch' });
    fire('pointermove', { pointerId: 2, clientX: 100, clientY: 100 });
    fire('pointerup', { button: 0, pointerId: 2, clientX: 100, clientY: 100 });
    expect(input.pointerX).toBe(10);
    expect(input.held).toBe(true);
    expect(input.consumeRelease()).toBeNull();
    fire('pointermove', { pointerId: 1, clientX: 40, clientY: 30 });
    fire('pointerup', { button: 0, pointerId: 1, clientX: 45, clientY: 30 });
    expect(input.consumeRelease()).toEqual({ x: 45, y: 30 });
  });

  it('ignores right and middle clicks', () => {
    const { input, fire } = setup();
    fire('pointerdown', { button: 2, clientX: 10, clientY: 20, pointerType: 'mouse' });
    fire('pointerdown', { button: 1, clientX: 10, clientY: 20, pointerType: 'mouse' });
    expect(input.consumeClick()).toBeNull();
  });

  it('suppresses the browser context menu (right-click, long-press)', () => {
    const { fire } = setup();
    expect(fire('contextmenu').defaultPrevented).toBe(true);
  });

  it('knows whether the player is using touch', () => {
    const { input, fire } = setup();
    expect(input.touch).toBe(false);
    fire('pointerdown', { button: 0, clientX: 0, clientY: 0, pointerType: 'touch' });
    expect(input.touch).toBe(true);
    fire('pointerup', { button: 0, clientX: 0, clientY: 0 });
    fire('pointerdown', { button: 0, clientX: 0, clientY: 0, pointerType: 'mouse' });
    expect(input.touch).toBe(false);
  });

  it('reports a primary release where it happened', () => {
    const { input, fire } = setup();
    expect(input.held).toBe(false);
    fire('pointerdown', { button: 0, clientX: 10, clientY: 20, pointerType: 'touch' });
    expect(input.held).toBe(true);
    fire('pointerup', { button: 0, clientX: 30, clientY: 40 });
    expect(input.held).toBe(false);
    expect(input.consumeRelease()).toEqual({ x: 30, y: 40 });
    expect(input.consumeRelease()).toBeNull();
  });

  it('ignores non-primary releases and drops releases at end of frame', () => {
    const { input, fire } = setup();
    fire('pointerup', { button: 2, clientX: 30, clientY: 40 });
    expect(input.consumeRelease()).toBeNull();
    fire('pointerup', { button: 0, clientX: 30, clientY: 40 });
    input.endFrame();
    expect(input.consumeRelease()).toBeNull();
  });

  it('a cancelled pointer is no longer held and does not release', () => {
    const { input, fire } = setup();
    fire('pointerdown', { button: 0, clientX: 10, clientY: 20, pointerType: 'touch' });
    fire('pointercancel');
    expect(input.held).toBe(false);
    expect(input.consumeRelease()).toBeNull();
  });
});
