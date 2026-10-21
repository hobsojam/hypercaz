// Pointer and keyboard input, mapped into the logical (letterboxed) canvas.

export interface Letterbox {
  offsetX: number;
  offsetY: number;
  scale: number; // CSS px per logical px
}

export function fitLetterbox(winW: number, winH: number, logicalW: number, logicalH: number): Letterbox {
  const scale = Math.min(winW / logicalW, winH / logicalH);
  return { offsetX: (winW - logicalW * scale) / 2, offsetY: (winH - logicalH * scale) / 2, scale };
}

// Window mode draws in CSS pixels, so a click needs no mapping.
export function viewFor(fit: 'letterbox' | 'window', winW: number, winH: number, logicalW: number, logicalH: number): Letterbox {
  return fit === 'window' ? { offsetX: 0, offsetY: 0, scale: 1 } : fitLetterbox(winW, winH, logicalW, logicalH);
}

export function toLogical(lb: Letterbox, clientX: number, clientY: number): { x: number; y: number } {
  return { x: (clientX - lb.offsetX) / lb.scale, y: (clientY - lb.offsetY) / lb.scale };
}

const PREVENT = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ']);

export class Input {
  pointerX: number | null = null;
  pointerY: number | null = null;
  touch = false; // whether the last press was a finger, for "tap"/"click" wording
  private down = new Set<string>();
  private pressed = new Set<string>();
  private click: { x: number; y: number } | null = null;
  private getLetterbox: () => Letterbox;

  constructor(getLetterbox: () => Letterbox) {
    this.getLetterbox = getLetterbox;
    window.addEventListener('pointermove', (e) => this.move(e));
    window.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return; // right/middle clicks are not taps
      this.touch = e.pointerType === 'touch';
      this.move(e);
      this.click = toLogical(this.getLetterbox(), e.clientX, e.clientY);
    });
    // Right-click and long-press menus would cover the game.
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (PREVENT.has(e.key)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.key.toLowerCase());
      this.down.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.down.clear());
  }

  private move(e: PointerEvent): void {
    const p = toLogical(this.getLetterbox(), e.clientX, e.clientY);
    this.pointerX = p.x;
    this.pointerY = p.y;
  }

  isDown(key: string): boolean {
    return this.down.has(key.toLowerCase());
  }

  consumeClick(): { x: number; y: number } | null {
    const c = this.click;
    this.click = null;
    return c;
  }

  consumeKey(key: string): boolean {
    return this.pressed.delete(key.toLowerCase());
  }

  // Drop presses that nobody consumed this frame.
  endFrame(): void {
    this.pressed.clear();
    this.click = null;
  }
}
