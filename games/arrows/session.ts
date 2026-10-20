import type { Sfx } from '../../engine/audio.ts';
import type { createStorage } from '../../engine/storage.ts';
import { PUZZLES } from './levels.ts';
import { loadProgress } from './progress.ts';
import { blocker, cells, createState, removable, remove, type Arrow, type Cell, type State } from './sim.ts';

export interface Flight { readonly arrow: Arrow; readonly duration: number; age: number }
export interface Feedback { readonly id: number; readonly blocker: number; age: number }

export class Session {
  readonly completed: Set<number>;
  state: State;
  index: number;
  menuIndex: number;
  screen: 'play' | 'levels' | 'won' = 'play';
  paused = false;
  muted: boolean;
  focus: Cell;
  cursorVisible = false;
  flight: Flight | null = null;
  feedback: Feedback | null = null;
  hintId: number | null = null;
  private returnScreen: 'play' | 'won' = 'play';
  private sounds: Sfx[] = [];
  private readonly storage: ReturnType<typeof createStorage>;

  constructor(storage: ReturnType<typeof createStorage>) {
    this.storage = storage;
    const progress = loadProgress(storage);
    this.completed = new Set(progress.completed);
    this.muted = progress.muted;
    this.index = Math.max(0, PUZZLES.findIndex(p => !this.completed.has(p.id)));
    this.menuIndex = this.index;
    this.state = createState(PUZZLES[this.index]);
    this.focus = cells(this.state.puzzle.arrows[0])[0];
  }

  get status(): string {
    if (this.screen === 'levels') return `Choose a puzzle. ${this.completed.size} of ${PUZZLES.length} cleared. Use arrows and Enter, or tap a card.`;
    if (this.paused) return 'Paused. Press Escape or Enter to resume.';
    if (this.screen === 'won') return `Puzzle ${this.index + 1} clear! All arrows escaped. Press Enter to continue.`;
    if (this.feedback) return 'Blocked. Clear the highlighted arrow ahead first.';
    if (this.flight) return 'Arrow escaping.';
    if (this.hintId !== null) return 'Hint: the glowing arrow has a clear path. Tap it, or press Enter.';
    return `Puzzle ${this.index + 1}: ${this.state.puzzle.name}. ${this.state.remaining.size} arrows left. ${this.state.puzzle.lesson}`;
  }

  select(index: number): boolean {
    if (!Number.isInteger(index) || !PUZZLES[index]) return false;
    this.index = index; this.menuIndex = index;
    this.state = createState(PUZZLES[index]);
    this.focus = cells(this.state.puzzle.arrows[0])[0];
    this.screen = 'play'; this.paused = false; this.cursorVisible = false;
    this.flight = null; this.feedback = null; this.hintId = null; this.sounds = [];
    return true;
  }

  retry(): void { this.select(this.index); }
  showPuzzles(): void {
    if (this.screen !== 'levels') this.returnScreen = this.screen;
    this.screen = 'levels'; this.menuIndex = this.index; this.paused = false;
  }
  returnToPuzzle(): void { if (this.screen === 'levels') this.screen = this.returnScreen; }
  next(): void { if (this.screen === 'won' && !this.select(this.index + 1)) this.showPuzzles(); }
  togglePause(): void { if (this.screen === 'play') this.paused = !this.paused; }
  suspend(): void { if (this.screen === 'play') this.paused = true; }
  setMuted(muted: boolean): void { this.muted = muted; this.save(); }

  attempt(id: number): boolean {
    if (this.screen !== 'play' || this.paused || this.flight) return false;
    const hit = blocker(this.state.puzzle, this.state.remaining, id);
    const result = remove(this.state, id);
    if (result === 'ignored') return false;
    this.hintId = null;
    if (result === 'blocked') {
      this.feedback = { id, blocker: hit!.id, age: 0 };
      this.sounds.push('hit');
      return false;
    }
    this.feedback = null;
    const arrow = this.state.puzzle.arrows.find(a => a.id === id)!;
    this.flight = { arrow, age: 0, duration: 0.38 };
    this.sounds.push('place');
    return true;
  }

  hint(): void {
    if (this.screen !== 'play' || this.paused || this.flight) return;
    const arrow = removable(this.state.puzzle, this.state.remaining)[0];
    if (!arrow) return;
    this.hintId = arrow.id; this.feedback = null;
    this.focus = cells(arrow)[0]; this.cursorVisible = true;
  }

  moveFocus(dx: number, dy: number): void {
    if (this.screen === 'levels') {
      this.menuIndex = Math.max(0, Math.min(PUZZLES.length - 1, this.menuIndex + dx + dy * 3));
    } else if (this.screen === 'play' && !this.paused) {
      const max = this.state.puzzle.size - 1;
      this.focus = { x: Math.max(0, Math.min(max, this.focus.x + dx)), y: Math.max(0, Math.min(max, this.focus.y + dy)) };
      this.cursorVisible = true;
    }
  }

  attemptFocus(): boolean {
    const arrow = this.state.puzzle.arrows.find(a => this.state.remaining.has(a.id) && cells(a).some(c => c.x === this.focus.x && c.y === this.focus.y));
    return arrow ? this.attempt(arrow.id) : false;
  }

  update(dt: number): void {
    if (this.screen !== 'play' || this.paused || !Number.isFinite(dt) || dt <= 0) return;
    if (this.feedback && (this.feedback.age += dt) >= 0.9) this.feedback = null;
    if (!this.flight) return;
    this.flight.age += dt;
    if (this.flight.age < this.flight.duration) return;
    this.flight = null;
    if (!this.state.remaining.size) {
      this.screen = 'won'; this.completed.add(this.state.puzzle.id);
      this.save(); this.sounds.push('win');
    }
  }

  takeSounds(): readonly Sfx[] { const sounds = this.sounds; this.sounds = []; return sounds; }
  private save(): void { this.storage.set('progress', { completed: [...this.completed], muted: this.muted }); }
}
