import { LEVELS } from './levels.ts';
import { Session } from './session.ts';
import { BOARD, LAUNCHER } from './sim/constants.ts';
import { contains, type Point, type Rect } from './sim/geometry.ts';

export interface Button extends Rect { readonly id: string; readonly label: string; readonly enabled: boolean }
export function buttonsFor(session: Session): readonly Button[] {
  const mute: Button = { id: 'mute', label: session.muted ? 'SOUND' : 'MUTE', x: 444, y: 24, w: 68, h: 52, enabled: true };
  if (session.screen === 'levels') return [mute,
    ...LEVELS.map((l, i) => ({ id: `level:${i}`, label: l.name, x: 44 + (i % 2) * 240, y: 202 + Math.floor(i / 2) * 144, w: 212, h: 128, enabled: true })),
    { id: 'retry', label: 'Back to puzzle', x: 164, y: 818, w: 212, h: 64, enabled: true },
  ];
  const active = session.state.phase === 'aiming' || session.state.phase === 'flying';
  const buttons: Button[] = [mute,
    { id: 'levels', label: 'Puzzles', x: 28, y: 818, w: 144, h: 64, enabled: true },
    { id: 'retry', label: 'Retry', x: 198, y: 818, w: 144, h: 64, enabled: true },
    { id: 'pause', label: session.paused ? 'Resume' : 'Pause', x: 368, y: 818, w: 144, h: 64, enabled: active },
  ];
  if (session.paused) buttons.push({ id: 'resume', label: 'Resume', x: 164, y: 540, w: 212, h: 64, enabled: true });
  else if (session.state.phase === 'won') buttons.push({ id: 'next', label: session.index < LEVELS.length - 1 ? 'Next puzzle' : 'All puzzles', x: 164, y: 556, w: 212, h: 64, enabled: true });
  else if (session.state.phase === 'lost') buttons.push({ id: 'retry', label: 'Retry', x: 164, y: 540, w: 212, h: 64, enabled: true });
  return buttons;
}

export class Controls {
  private readonly session: Session;
  private pointer: number | null = null;
  private button: string | null = null;
  constructor(session: Session) { this.session = session; }

  down(id: number, point: Point): boolean {
    if (this.pointer !== null) return false;
    const button = buttonsFor(this.session).find(b => b.enabled && contains(b, point));
    if (!button && !this.canAim(point)) return false;
    this.pointer = id;
    this.button = button?.id ?? null;
    if (!button && point.y < LAUNCHER.y - 24) this.session.aimAt(point);
    return true;
  }

  move(id: number, point: Point): void {
    if (id === this.pointer && !this.button && this.canAim(point) && point.y < LAUNCHER.y - 24) this.session.aimAt(point);
  }

  up(id: number, point: Point): void {
    if (id !== this.pointer) return;
    const button = this.button;
    this.cancelAll();
    if (button) {
      if (buttonsFor(this.session).some(b => b.id === button && b.enabled && contains(b, point))) this.activate(button);
      return;
    }
    if (this.canAim(point) && point.y < LAUNCHER.y - 24) { this.session.aimAt(point); this.session.fire(); }
  }

  cancel(id: number): void { if (id === this.pointer) this.cancelAll(); }
  cancelAll(): void { this.pointer = null; this.button = null; }

  key(key: string, fine = false): boolean {
    if (key.startsWith('Arrow')) return this.arrow(key, fine);
    if (![' ', 'Enter', 'Escape', 'r', 'R', 'm', 'M'].includes(key)) return false;
    this.cancelAll();
    if (key.toLowerCase() === 'r') this.session.retry();
    else if (key.toLowerCase() === 'm') this.session.toggleMute();
    else if (key === 'Escape') this.session.togglePause();
    else if (key === 'Enter') this.enter();
    else this.session.fire();
    return true;
  }

  private arrow(key: string, fine: boolean): boolean {
    if (this.session.screen === 'levels') {
      const delta: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -2, ArrowDown: 2 };
      this.session.menuIndex = Math.max(0, Math.min(LEVELS.length - 1, this.session.menuIndex + (delta[key] ?? 0)));
      return true;
    }
    if (key !== 'ArrowLeft' && key !== 'ArrowRight') return false;
    this.session.aimAngle(this.session.angle + (key === 'ArrowRight' ? 1 : -1) * (fine ? 0.01 : 0.04));
    return true;
  }

  private enter(): void {
    if (this.session.screen === 'levels') this.session.select(this.session.menuIndex);
    else if (this.session.paused) this.session.togglePause();
    else if (this.session.state.phase === 'won') this.session.next();
    else if (this.session.state.phase === 'lost') this.session.retry();
    else this.session.fire();
  }

  private canAim(point: Point): boolean {
    return this.session.screen === 'play' && !this.session.paused && this.session.state.phase === 'aiming' && contains(BOARD, point);
  }

  private activate(id: string): void {
    if (id.startsWith('level:')) { this.session.select(Number(id.slice(6))); return; }
    if (id === 'mute') this.session.toggleMute();
    if (id === 'levels') this.session.showLevels();
    if (id === 'retry') this.session.retry();
    if (id === 'pause' || id === 'resume') this.session.togglePause();
    if (id === 'next') this.session.next();
  }
}
