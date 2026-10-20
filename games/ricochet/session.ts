import type { Sfx } from '../../engine/audio.ts';
import type { createStorage } from '../../engine/storage.ts';
import { LEVELS } from './levels.ts';
import { LAUNCHER, MAX_ANGLE, MIN_ANGLE } from './sim/constants.ts';
import { createState, preview, shoot, starsFor, step, type GameEvent, type State } from './sim/game.ts';
import type { Point } from './sim/geometry.ts';

type Storage = ReturnType<typeof createStorage>;
export interface Effect extends Point { kind: 'rescue' | 'bank'; age: number }

function savedProgress(raw: unknown): { best: Record<number, number>; muted: boolean } {
  const out = { best: {} as Record<number, number>, muted: false };
  if (!raw || typeof raw !== 'object') return out;
  const data = raw as Record<string, unknown>;
  out.muted = data.muted === true;
  if (data.best && typeof data.best === 'object' && !Array.isArray(data.best)) {
    for (const level of LEVELS) {
      const score = (data.best as Record<number, unknown>)[level.id];
      if (score === 1 || score === 2 || score === 3) out.best[level.id] = score;
    }
  }
  return out;
}

export class Session {
  state: State = createState(LEVELS[0]);
  index = 0;
  menuIndex = 0;
  screen: 'play' | 'levels' = 'play';
  paused = false;
  angle = -Math.PI / 2;
  guide: Point[] = preview(this.state, this.angle);
  effects: Effect[] = [];
  best: Record<number, number>;
  muted: boolean;
  time = 0;
  private sounds: Sfx[] = [];
  private storage?: Storage;

  constructor(storage?: Storage) {
    this.storage = storage;
    const progress = savedProgress(storage?.get('progress', null));
    this.best = progress.best;
    this.muted = progress.muted;
  }

  aimAt(point: Point): void {
    this.aimAngle(Math.atan2(point.y - LAUNCHER.y, point.x - LAUNCHER.x));
  }

  aimAngle(angle: number): void {
    if (this.screen !== 'play' || this.paused || this.state.phase !== 'aiming' || !Number.isFinite(angle)) return;
    this.angle = Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, angle));
    this.guide = preview(this.state, this.angle);
  }

  fire(): boolean {
    if (this.screen !== 'play' || this.paused || !shoot(this.state, this.angle)) return false;
    this.guide = [];
    this.consume(this.state.events);
    return true;
  }

  update(dt: number): void {
    if (this.paused || this.screen !== 'play') return;
    this.time += dt;
    for (const effect of this.effects) effect.age += dt;
    this.effects = this.effects.filter(e => e.age < 0.8);
    const wasFlying = this.state.phase === 'flying';
    step(this.state, dt);
    this.consume(this.state.events);
    if (wasFlying && this.state.phase === 'aiming') this.guide = preview(this.state, this.angle);
  }

  retry(): void { this.select(this.index); }

  select(index: number): boolean {
    if (!Number.isInteger(index) || !LEVELS[index]) return false;
    this.index = index;
    this.menuIndex = index;
    this.state = createState(LEVELS[index]);
    this.screen = 'play';
    this.paused = false;
    this.effects = [];
    this.sounds = [];
    this.angle = -Math.PI / 2;
    this.guide = preview(this.state, this.angle);
    return true;
  }

  next(): boolean {
    if (this.state.phase !== 'won') return false;
    if (this.index === LEVELS.length - 1) { this.showLevels(); return true; }
    return this.select(this.index + 1);
  }

  showLevels(): void {
    this.screen = 'levels';
    this.menuIndex = this.index;
    this.paused = false;
    this.state.ball = null;
    this.sounds = [];
  }

  togglePause(): void {
    if (this.screen === 'play' && (this.state.phase === 'aiming' || this.state.phase === 'flying')) this.paused = !this.paused;
  }

  toggleMute(): void { this.muted = !this.muted; this.save(); }
  takeSounds(): Sfx[] { const sounds = this.sounds; this.sounds = []; return sounds; }

  private save(): void { this.storage?.set('progress', { best: this.best, muted: this.muted }); }

  private consume(events: readonly GameEvent[]): void {
    for (const event of events) {
      if (event.type === 'bank' || event.type === 'rescue') {
        this.effects.push({ x: event.x, y: event.y, age: 0, kind: event.type });
        this.sounds.push(event.type === 'bank' ? 'hit' : 'gain');
      }
      if (event.type === 'shot') this.sounds.push('shot');
      if (event.type === 'lost') this.sounds.push('fail');
      if (event.type === 'won') {
        this.sounds.push('win');
        this.best[this.state.level.id] = Math.max(this.best[this.state.level.id] ?? 0, starsFor(this.state));
        this.save();
      }
    }
  }
}
