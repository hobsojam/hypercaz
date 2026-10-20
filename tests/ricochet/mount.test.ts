import { afterEach, expect, test, vi } from 'vitest';
import { AssetStore } from '../../engine/assets.ts';
import { MANIFEST } from '../../games/ricochet/assets.ts';
import { mountRicochet } from '../../games/ricochet/mount.ts';

afterEach(() => vi.unstubAllGlobals());

function environment() {
  const win = Object.assign(new EventTarget(), { devicePixelRatio: 1 });
  const doc = Object.assign(new EventTarget(), { hidden: false });
  const frames = new Map<number, FrameRequestCallback>(); let frameId = 0;
  vi.stubGlobal('window', win); vi.stubGlobal('document', doc);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.set(++frameId, cb); return frameId; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  const ctx: object = new Proxy({}, { get: (_t, name) => name === 'measureText' ? (text: string) => ({ width: text.length * 8 }) : () => ctx, set: () => true });
  const canvas = Object.assign(new EventTarget(), {
    width: 0, height: 0, tabIndex: -1, style: { touchAction: 'pan-y' },
    getContext: () => ctx, getBoundingClientRect: () => ({ left: 0, top: 0, width: 540, height: 960 }),
    focus: () => undefined, setPointerCapture: () => undefined, hasPointerCapture: () => false, releasePointerCapture: () => undefined,
  });
  const sounds: string[] = [], statuses: string[] = []; let hides = 0;
  const options = { assets: AssetStore.fromManifest(MANIFEST), audio: { muted: false, unlock: () => undefined, hide: () => hides++, play: (s: string) => sounds.push(s) }, onStatus: (s: string) => statuses.push(s) };
  const key = (key: string, repeat = false) => canvas.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key, repeat, shiftKey: false }));
  return { win, doc, frames, canvas: canvas as unknown as HTMLCanvasElement, options, sounds, statuses, key, hides: () => hides };
}

test('disposing stops the loop, removes input and restores the host canvas; remount does not duplicate shots', async () => {
  const e = environment(); const dispose = await mountRicochet(e.canvas, e.options);
  expect(e.frames.size).toBe(1);
  expect(e.canvas.tabIndex).toBe(0);
  expect(e.canvas.style.touchAction).toBe('none');
  e.key(' '); expect(e.sounds.filter(s => s === 'shot')).toHaveLength(1);
  dispose(); dispose();
  expect(e.frames.size).toBe(0); expect(e.hides()).toBe(1);
  expect(e.canvas.tabIndex).toBe(-1); expect(e.canvas.style.touchAction).toBe('pan-y');
  e.key(' '); expect(e.sounds.filter(s => s === 'shot')).toHaveLength(1);
  const disposeAgain = await mountRicochet(e.canvas, e.options);
  e.key(' '); expect(e.sounds.filter(s => s === 'shot')).toHaveLength(2);
  disposeAgain();
});

test('the hidden page pauses and becoming visible does not resume without a gesture', async () => {
  const e = environment(); const dispose = await mountRicochet(e.canvas, e.options);
  e.key(' '); e.doc.hidden = true; e.doc.dispatchEvent(new Event('visibilitychange'));
  expect(e.statuses.at(-1)).toContain('Paused');
  e.doc.hidden = false; e.doc.dispatchEvent(new Event('visibilitychange'));
  expect(e.statuses.at(-1)).toContain('Paused');
  e.key('Enter'); expect(e.statuses.at(-1)).toContain('in flight');
  dispose();
});

test('held Space does not spend repeated shots and resize uses the device pixel ratio', async () => {
  const e = environment(); const dispose = await mountRicochet(e.canvas, e.options);
  e.key(' ', true); expect(e.sounds).not.toContain('shot');
  e.win.devicePixelRatio = 2; e.win.dispatchEvent(new Event('resize'));
  expect(e.canvas.width).toBe(1080); expect(e.canvas.height).toBe(1920);
  dispose(); e.win.devicePixelRatio = 3; e.win.dispatchEvent(new Event('resize'));
  expect(e.canvas.width).toBe(1080);
});


test('failed startup releases resources and a later mount works normally', async () => {
  const e = environment();
  await expect(mountRicochet(e.canvas, { ...e.options, onStatus: () => { throw new Error('host callback failed'); } })).rejects.toThrow('host callback failed');
  expect(e.frames.size).toBe(0);
  expect(e.canvas.tabIndex).toBe(-1);
  expect(e.canvas.style.touchAction).toBe('pan-y');
  e.key(' '); expect(e.sounds).not.toContain('shot');
  e.win.devicePixelRatio = 2; e.win.dispatchEvent(new Event('resize'));
  expect(e.canvas.width).toBe(540);
  const dispose = await mountRicochet(e.canvas, e.options);
  e.key(' '); expect(e.sounds.filter(s => s === 'shot')).toHaveLength(1);
  dispose(); expect(e.frames.size).toBe(0);
});
