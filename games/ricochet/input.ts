import type { Controls } from './controls.ts';
import type { Viewport } from './viewport.ts';

interface Handlers { readonly gesture: () => void; readonly change: () => void; readonly suspend: () => void }

export function bindInput(canvas: HTMLCanvasElement, viewport: Viewport, controls: Controls, handlers: Handlers, signal: AbortSignal): void {
  const touchAction = canvas.style.touchAction, tabIndex = canvas.tabIndex;
  canvas.style.touchAction = 'none'; canvas.tabIndex = 0;
  const captured = new Set<number>();
  const release = (id: number) => {
    if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    captured.delete(id);
  };
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !controls.down(e.pointerId, viewport.point(e))) return;
    e.preventDefault(); canvas.focus({ preventScroll: true }); handlers.gesture();
    canvas.setPointerCapture(e.pointerId); captured.add(e.pointerId); handlers.change();
  }, { signal });
  canvas.addEventListener('pointermove', e => { controls.move(e.pointerId, viewport.point(e)); handlers.change(); }, { signal });
  canvas.addEventListener('pointerup', e => { controls.up(e.pointerId, viewport.point(e)); release(e.pointerId); handlers.change(); }, { signal });
  canvas.addEventListener('pointercancel', e => { controls.cancel(e.pointerId); release(e.pointerId); }, { signal });
  canvas.addEventListener('lostpointercapture', e => { controls.cancel(e.pointerId); captured.delete(e.pointerId); }, { signal });
  canvas.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.repeat && !e.key.startsWith('Arrow')) { e.preventDefault(); return; }
    if (controls.key(e.key, e.shiftKey)) { e.preventDefault(); handlers.gesture(); handlers.change(); }
  }, { signal });
  canvas.addEventListener('blur', () => handlers.suspend(), { signal });
  signal.addEventListener('abort', () => {
    controls.cancelAll();
    for (const id of captured) release(id);
    canvas.style.touchAction = touchAction; canvas.tabIndex = tabIndex;
  }, { once: true });
  canvas.focus({ preventScroll: true });
}
