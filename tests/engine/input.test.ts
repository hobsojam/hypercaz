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
    fire('pointerdown', { button: 0, clientX: 0, clientY: 0, pointerType: 'mouse' });
    expect(input.touch).toBe(false);
  });
});
