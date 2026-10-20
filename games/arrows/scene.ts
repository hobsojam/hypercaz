import { hitAllGames, hitRect, PAUSE_BUTTON, takeClick } from '../../engine/controls.ts';
import type { Scene } from '../../engine/scenes.ts';
import type { ArrowGame } from './game.ts';
import { buttonsFor, cellAt } from './layout.ts';
import { render } from './render.ts';
import { Session } from './session.ts';

export class EscapeScene implements Scene {
  readonly session: Session;
  private readonly game: ArrowGame;
  private lastStatus = '';
  navigate: (url: string) => void = url => { window.location.href = url; };

  constructor(game: ArrowGame) {
    this.game = game;
    this.session = new Session(game.storage);
    game.audio.muted = this.session.muted;
    this.announce();
  }

  suspend(): void { this.game.input.endFrame(); this.session.suspend(); this.announce(); }

  update(dt: number): void {
    const s = this.session, input = this.game.input;
    const click = takeClick(this.game, muted => s.setMuted(muted));
    if (click && hitAllGames(click)) { this.navigate('../'); return; }
    if (input.consumeKey('Escape') || (click && hitRect(PAUSE_BUTTON, click, 6))) s.togglePause();
    if (click) this.click(click);
    this.keyboard();
    s.update(dt);
    for (const sound of s.takeSounds()) this.game.audio.play(sound);
    this.announce();
  }

  private click(point: { x: number; y: number }): void {
    const s = this.session;
    const button = buttonsFor(s).find(b => b.enabled && hitRect(b, point, 0));
    if (button) { this.activate(button.id); return; }
    if (s.screen !== 'play' || s.paused) return;
    const cell = cellAt(s.state.puzzle, point);
    if (cell) { s.focus = cell; s.cursorVisible = false; s.attemptFocus(); }
  }

  private keyboard(): void {
    const { input } = this.game, s = this.session;
    if (input.consumeKey('r')) s.retry();
    if (input.consumeKey('l')) s.showPuzzles();
    if (input.consumeKey('h')) s.hint();
    const moves = [['ArrowLeft', -1, 0], ['ArrowRight', 1, 0], ['ArrowUp', 0, -1], ['ArrowDown', 0, 1]] as const;
    for (const [key, dx, dy] of moves) if (input.consumeKey(key)) s.moveFocus(dx, dy);
    if (!input.consumeKey('Enter') && !input.consumeKey(' ')) return;
    if (s.paused) s.togglePause();
    else if (s.screen === 'levels') s.select(s.menuIndex);
    else if (s.screen === 'won') s.next();
    else s.attemptFocus();
  }

  private activate(id: string): void {
    const s = this.session;
    if (id.startsWith('puzzle:')) { s.select(Number(id.slice(7))); return; }
    if (id === 'levels') s.showPuzzles();
    if (id === 'back') s.returnToPuzzle();
    if (id === 'hint') s.hint();
    if (id === 'retry') s.retry();
    if (id === 'next') s.next();
    if (id === 'resume') s.togglePause();
  }

  private announce(): void {
    const message = this.session.status;
    if (message !== this.lastStatus) { this.lastStatus = message; this.game.announce(message); }
  }
  render(ctx: CanvasRenderingContext2D): void { render(ctx, this.session); }
}
