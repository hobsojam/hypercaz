import type { Sfx } from '../../engine/audio.ts';
import type { createStorage } from '../../engine/storage.ts';
import { PUZZLES } from './levels.ts';
import { loadProgress } from './progress.ts';
import { createState, isWon, move, occupied, solve, type Car, type Move, type State } from './sim.ts';

function hintDirection(car: Car, distance: number): string {
  if (car.axis === 'H') return distance > 0 ? 'right' : 'left';
  return distance > 0 ? 'down' : 'up';
}

export class Session {
  readonly completed: Set<number>;
  readonly history: number[][] = [];
  state: State;
  index: number;
  menuIndex: number;
  screen: 'play' | 'levels' | 'won' = 'play';
  paused = false;
  muted: boolean;
  selected: number | null = null;
  focus = { x: 0, y: 2 };
  cursorVisible = false;
  hintMove: Move | null = null;
  hintUnavailable = false;
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
  }

  get status(): string {
    if (this.screen === 'levels') return `Choose a puzzle. ${this.completed.size} of ${PUZZLES.length} cleared.`;
    if (this.paused) return 'Paused. Press Escape or Enter to resume.';
    if (this.screen === 'won') return `Puzzle ${this.index + 1} clear! The red car reached the exit.`;
    if (this.hintMove) return this.hintStatus(this.hintMove);
    if (this.hintUnavailable) return 'No route from here. Undo a move or reset the puzzle.';
    if (this.selected !== null) return this.selectedStatus(this.selected);
    if (this.cursorVisible) return this.cursorStatus();
    return `Puzzle ${this.index + 1}: ${this.state.puzzle.name}. ${this.state.puzzle.lesson}`;
  }

  private hintStatus(step: Move): string {
    const index = this.state.puzzle.cars.findIndex(car => car.id === step.carId);
    const car = this.state.puzzle.cars[index];
    const distance = step.to - this.state.positions[index];
    const spaces = Math.abs(distance) === 1 ? 'space' : 'spaces';
    return `Hint: move car ${car.id} ${hintDirection(car, distance)} ${Math.abs(distance)} ${spaces}.`;
  }

  private selectedStatus(index: number): string {
    const car = this.state.puzzle.cars[index], position = this.state.positions[index];
    if (car.axis === 'H') {
      return `Car ${car.id} selected at row ${car.y + 1}, columns ${position + 1} through ${position + car.length}. Drag it or use Left and Right.`;
    }
    return `Car ${car.id} selected at column ${car.x + 1}, rows ${position + 1} through ${position + car.length}. Drag it or use Up and Down.`;
  }

  private cursorStatus(): string {
    const index = this.state.puzzle.cars.findIndex((car, i) => occupied(car, this.state.positions[i], this.focus.x, this.focus.y));
    let cell = 'Empty cell.';
    if (index >= 0) cell = `Car ${this.state.puzzle.cars[index].id}. Press Enter to select.`;
    return `Cursor row ${this.focus.y + 1}, column ${this.focus.x + 1}. ${cell}`;
  }

  select(index: number): boolean {
    if (!Number.isInteger(index) || !PUZZLES[index]) return false;
    this.index = index; this.menuIndex = index; this.state = createState(PUZZLES[index]);
    this.history.length = 0; this.selected = null; this.hintMove = null; this.hintUnavailable = false;
    this.focus = { x: 0, y: 2 }; this.cursorVisible = false;
    this.screen = 'play'; this.paused = false; this.sounds = [];
    return true;
  }
  reset(): void { this.select(this.index); }
  showPuzzles(): void {
    if (this.screen !== 'levels') this.returnScreen = this.screen;
    this.screen = 'levels'; this.menuIndex = this.index; this.paused = false;
  }
  returnToPuzzle(): void { if (this.screen === 'levels') this.screen = this.returnScreen; }
  next(): void { if (this.screen === 'won' && !this.select(this.index + 1)) this.showPuzzles(); }
  togglePause(): void { if (this.screen === 'play') this.paused = !this.paused; }
  suspend(): void { if (this.screen === 'play') this.paused = true; }
  setMuted(muted: boolean): void { this.muted = muted; this.save(); }

  commit(index: number, to: number): boolean {
    if (this.screen !== 'play' || this.paused) return false;
    const before = [...this.state.positions];
    if (!move(this.state, index, to)) return false;
    this.history.push(before); this.hintMove = null; this.hintUnavailable = false;
    this.sounds.push('place');
    if (isWon(this.state)) {
      this.screen = 'won'; this.completed.add(this.state.puzzle.id);
      this.save(); this.sounds.push('win');
    }
    return true;
  }
  undo(): boolean {
    if (this.screen === 'levels' || this.paused) return false;
    const previous = this.history.pop();
    if (!previous) return false;
    this.state.positions.splice(0, previous.length, ...previous);
    this.screen = 'play'; this.hintMove = null; this.hintUnavailable = false; this.sounds.push('place');
    return true;
  }
  hint(): void {
    if (this.screen !== 'play' || this.paused) return;
    const answer = solve(this.state);
    this.hintMove = answer?.[0] ?? null;
    this.hintUnavailable = !this.hintMove;
    if (this.hintMove) {
      this.selected = this.state.puzzle.cars.findIndex(c => c.id === this.hintMove!.carId);
      const car = this.state.puzzle.cars[this.selected];
      this.focus = { x: car.axis === 'H' ? this.state.positions[this.selected] : car.x, y: car.axis === 'V' ? this.state.positions[this.selected] : car.y };
      this.cursorVisible = true;
    }
  }
  takeSounds(): readonly Sfx[] { const sounds = this.sounds; this.sounds = []; return sounds; }
  private save(): void { this.storage.set('progress', { completed: [...this.completed], muted: this.muted }); }
}
