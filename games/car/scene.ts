import { hitAllGames, hitRect, PAUSE_BUTTON, takeClick } from '../../engine/controls.ts';
import type { Scene } from '../../engine/scenes.ts';
import type { CarGame } from './game.ts';
import { BOARD, buttonsFor, carAt, cellAt } from './layout.ts';
import { PUZZLES } from './levels.ts';
import { render, type Preview } from './render.ts';
import { Session } from './session.ts';
import { legalRange } from './sim.ts';

interface Drag { readonly index: number; readonly from: number; readonly pointer: number; readonly low: number; readonly high: number; preview: number }
interface Point { readonly x: number; readonly y: number }
export class ParkScene implements Scene {
  readonly session: Session;
  private readonly game: CarGame;
  private drag: Drag | null = null;
  private lastStatus = '';
  navigate: (url: string) => void = url => { window.location.href = url; };

  constructor(game: CarGame) {
    this.game = game; this.session = new Session(game.storage);
    game.audio.muted = this.session.muted; this.announce();
  }
  suspend(): void { this.game.input.endFrame(); this.drag = null; this.session.suspend(); this.announce(); }
  update(): void {
    const s = this.session, input = this.game.input;
    const click = takeClick(this.game, muted => s.setMuted(muted));
    const release = input.consumeRelease();
    if (click && hitAllGames(click)) { this.navigate('../'); return; }
    if (input.consumeKey('Escape') || (click && hitRect(PAUSE_BUTTON, click, 6) && s.screen === 'play')) { this.drag = null; s.togglePause(); }
    else if (click) this.click(click);
    this.updateDrag(release);
    this.keyboard();
    for (const sound of s.takeSounds()) this.game.audio.play(sound);
    this.announce();
  }
  private updateDrag(release: Point | null): void {
    const drag = this.drag;
    if (!drag) return;
    const input = this.game.input;
    const pointer = release ?? (input.pointerX === null || input.pointerY === null ? null : { x: input.pointerX, y: input.pointerY });
    if (pointer) {
      const car = this.session.state.puzzle.cars[drag.index];
      const coordinate = car.axis === 'H' ? pointer.x : pointer.y;
      drag.preview = Math.max(drag.low, Math.min(drag.high, drag.from + (coordinate - drag.pointer) / BOARD.cell));
    }
    if (release) {
      this.session.commit(drag.index, Math.round(drag.preview));
      this.drag = null;
    } else if (!input.held) this.drag = null;
  }
  private click(point: { x: number; y: number }): void {
    const s = this.session;
    const button = buttonsFor(s).find(b => b.enabled && hitRect(b, point, 0));
    if (button) { this.drag = null; this.activate(button.id); return; }
    if (s.screen !== 'play' || s.paused) return;
    const cell = cellAt(point);
    if (!cell) return;
    s.focus = cell; s.cursorVisible = false;
    const index = carAt(s.state, cell);
    s.selected = index >= 0 ? index : null;
    if (index < 0) return;
    const [low, high] = legalRange(s.state, index), car = s.state.puzzle.cars[index], from = s.state.positions[index];
    this.drag = { index, low, high, from, pointer: car.axis === 'H' ? point.x : point.y, preview: from };
  }
  private keyboard(): void {
    const input = this.game.input, s = this.session;
    if (input.consumeKey('l')) { this.drag = null; s.showPuzzles(); }
    if (input.consumeKey('r') && !s.paused) { this.drag = null; s.reset(); }
    if (input.consumeKey('u')) { this.drag = null; s.undo(); }
    if (input.consumeKey('h')) s.hint();
    const keys = [['ArrowLeft', -1, 0], ['ArrowRight', 1, 0], ['ArrowUp', 0, -1], ['ArrowDown', 0, 1]] as const;
    for (const [key, dx, dy] of keys) if (input.consumeKey(key)) this.arrow(dx, dy);
    if (!input.consumeKey('Enter') && !input.consumeKey(' ')) return;
    this.confirm();
  }
  private arrow(dx: number, dy: number): void {
    const s = this.session;
    if (s.screen === 'levels') {
      s.menuIndex = Math.max(0, Math.min(PUZZLES.length - 1, s.menuIndex + dx + dy * 2));
      return;
    }
    if (s.screen !== 'play' || s.paused) return;
    if (s.selected !== null) {
      const car = s.state.puzzle.cars[s.selected], delta = car.axis === 'H' ? dx : dy;
      if (delta) s.commit(s.selected, s.state.positions[s.selected] + delta);
      return;
    }
    s.focus = { x: Math.max(0, Math.min(5, s.focus.x + dx)), y: Math.max(0, Math.min(5, s.focus.y + dy)) };
    s.cursorVisible = true;
  }
  private confirm(): void {
    const s = this.session;
    if (s.paused) s.togglePause();
    else if (s.screen === 'levels') s.select(s.menuIndex);
    else if (s.screen === 'won') s.next();
    else if (s.selected !== null) s.selected = null;
    else { const index = carAt(s.state, s.focus); if (index >= 0) s.selected = index; }
  }
  private activate(id: string): void {
    const s = this.session;
    if (id.startsWith('puzzle:')) { s.select(Number(id.slice(7))); return; }
    if (id === 'levels') s.showPuzzles();
    if (id === 'back') s.returnToPuzzle();
    if (id === 'hint') s.hint();
    if (id === 'undo') s.undo();
    if (id === 'reset') s.reset();
    if (id === 'next') s.next();
    if (id === 'resume') s.togglePause();
  }
  private announce(): void {
    const message = this.session.status;
    if (message !== this.lastStatus) { this.lastStatus = message; this.game.announce(message); }
  }
  render(ctx: CanvasRenderingContext2D): void {
    const preview: Preview | null = this.drag ? { index: this.drag.index, position: this.drag.preview } : null;
    render(ctx, this.session, preview);
  }
}
