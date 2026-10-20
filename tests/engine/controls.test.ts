import { describe, expect, it } from 'vitest';
import { ALL_GAMES_BUTTON, hitAllGames, hitRect, MUTE_BUTTON, PAUSE_BUTTON, takeClick, titleAction, toggleMute } from '../../engine/controls.ts';

function fakeGame() {
  const keys = new Set<string>();
  const unlocks: number[] = [];
  let click: { x: number; y: number } | null = null;
  const game = {
    input: {
      consumeKey: (k: string) => keys.delete(k),
      consumeClick: () => {
        const c = click;
        click = null;
        return c;
      },
    },
    audio: { muted: false, unlock: () => unlocks.push(1) },
  };
  return { game, unlocks, press: (k: string) => keys.add(k), tap: (x: number, y: number) => (click = { x, y }) };
}

const centre = (r: { x: number; y: number; w: number; h: number }) => [r.x + r.w / 2, r.y + r.h / 2] as const;

describe('hitRect', () => {
  it('includes the edge and the slop around it', () => {
    const r = { x: 10, y: 10, w: 20, h: 20 };
    expect(hitRect(r, { x: 10, y: 30 }, 0)).toBe(true);
    expect(hitRect(r, { x: 9, y: 20 }, 0)).toBe(false);
    expect(hitRect(r, { x: 5, y: 20 }, 6)).toBe(true);
    expect(hitRect(r, { x: 40, y: 40 })).toBe(true);
    expect(hitRect(r, { x: 41, y: 20 })).toBe(false);
  });

  it('keeps the buttons apart', () => {
    expect(hitRect(MUTE_BUTTON, { x: centre(PAUSE_BUTTON)[0], y: centre(PAUSE_BUTTON)[1] }, 0)).toBe(false);
  });
});

describe('hitAllGames', () => {
  it('needs a click inside the button', () => {
    expect(hitAllGames(null)).toBe(false);
    expect(hitAllGames({ x: centre(ALL_GAMES_BUTTON)[0], y: centre(ALL_GAMES_BUTTON)[1] })).toBe(true);
    expect(hitAllGames({ x: 300, y: 500 })).toBe(false);
  });
});

describe('takeClick', () => {
  it('passes ordinary clicks through without touching mute', () => {
    const { game, tap } = fakeGame();
    const saved: boolean[] = [];
    tap(100, 500);
    expect(takeClick(game, (m) => saved.push(m))).toEqual({ x: 100, y: 500 });
    expect(game.audio.muted).toBe(false);
    expect(saved).toEqual([]);
  });

  it('a tap on the mute button toggles, remembers, and is swallowed', () => {
    const { game, tap } = fakeGame();
    const saved: boolean[] = [];
    tap(...centre(MUTE_BUTTON));
    expect(takeClick(game, (m) => saved.push(m))).toBeNull();
    tap(...centre(MUTE_BUTTON));
    takeClick(game, (m) => saved.push(m));
    expect(saved).toEqual([true, false]);
    expect(game.audio.muted).toBe(false);
  });

  it('M toggles mute and leaves the click alone', () => {
    const { game, press, tap } = fakeGame();
    press('m');
    tap(100, 500);
    expect(takeClick(game, () => undefined)).toEqual({ x: 100, y: 500 });
    expect(game.audio.muted).toBe(true);
  });
});

describe('toggleMute', () => {
  it('flips the flag and reports it', () => {
    const { game } = fakeGame();
    const saved: boolean[] = [];
    toggleMute(game, (m) => saved.push(m));
    expect(saved).toEqual([true]);
  });
});

describe('titleAction', () => {
  it('goes to the picker from the All games button without unlocking', () => {
    const { game, unlocks } = fakeGame();
    expect(titleAction(game, { x: centre(ALL_GAMES_BUTTON)[0], y: centre(ALL_GAMES_BUTTON)[1] })).toBe('games');
    expect(unlocks).toEqual([]);
  });

  it('starts on any other click, Enter or Space, unlocking audio', () => {
    const a = fakeGame();
    expect(titleAction(a.game, { x: 300, y: 500 })).toBe('start');
    expect(a.unlocks).toHaveLength(1);
    const b = fakeGame();
    b.press('Enter');
    expect(titleAction(b.game, null)).toBe('start');
    const c = fakeGame();
    c.press(' ');
    expect(titleAction(c.game, null)).toBe('start');
  });

  it('does nothing without input', () => {
    expect(titleAction(fakeGame().game, null)).toBeNull();
  });
});
