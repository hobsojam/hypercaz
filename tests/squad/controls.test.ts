import { describe, expect, it } from 'vitest';
import { MUTE_BUTTON, takeClick } from '../../games/squad/controls.ts';
import type { Game } from '../../games/squad/game.ts';
import { levels } from '../../games/squad/levels/index.ts';
import { ErrorScene } from '../../games/squad/scenes/error.ts';
import { LevelSelectScene } from '../../games/squad/scenes/levelSelect.ts';
import { PlayScene } from '../../games/squad/scenes/play.ts';
import { ResultsScene } from '../../games/squad/scenes/results.ts';
import { TitleScene } from '../../games/squad/scenes/title.ts';
import { stubGame } from './stubGame.ts';

const muteTap = [MUTE_BUTTON.x + MUTE_BUTTON.w / 2, MUTE_BUTTON.y + MUTE_BUTTON.h / 2] as const;

describe('takeClick', () => {
  it('passes ordinary clicks through', () => {
    const { game, tap } = stubGame();
    tap(100, 500);
    expect(takeClick(game)).toEqual({ x: 100, y: 500 });
  });

  it('the mute button toggles mute, remembers it, and swallows the click', () => {
    const { game, tap, saved } = stubGame();
    tap(...muteTap);
    expect(takeClick(game)).toBeNull();
    expect(game.audio.muted).toBe(true);
    expect(game.progress.muted).toBe(true);
    expect(saved).toContainEqual(expect.objectContaining({ muted: true }));
    tap(...muteTap);
    takeClick(game);
    expect(game.audio.muted).toBe(false);
  });

  it('M toggles mute too', () => {
    const { game, press } = stubGame();
    press('m');
    takeClick(game);
    expect(game.audio.muted).toBe(true);
  });
});

describe('menus', () => {
  it.each([
    [6, 375, 525],
    [10, 375, 805],
  ])('opens level %i on a fresh save', (_id, x, y) => {
    const { game, tap, scenes } = stubGame();
    game.levels = levels;
    tap(x, y);
    new LevelSelectScene(game).update();
    expect(scenes[0]).toBeInstanceOf(PlayScene);
    expect(game.progress.best).toEqual({});
  });

  it('muting on the title screen does not start the game', () => {
    const { game, tap, scenes } = stubGame();
    const title = new TitleScene(game);
    tap(...muteTap);
    title.update(1 / 60);
    expect(scenes).toHaveLength(0);
    expect(game.audio.muted).toBe(true);
    tap(270, 500);
    title.update(1 / 60);
    expect(scenes[0]).toBeInstanceOf(LevelSelectScene);
  });

  it('M mutes on the level select screen', () => {
    const { game, press } = stubGame();
    press('m');
    new LevelSelectScene(game).update();
    expect(game.audio.muted).toBe(true);
  });
});

describe('menu music', () => {
  it.each([
    ['title', (g: Game) => new TitleScene(g)],
    ['level select', (g: Game) => new LevelSelectScene(g)],
    ['results', (g: Game) => new ResultsScene(g, 0, true, 2, 10)],
    ['error', (g: Game) => new ErrorScene(g, 'bad level', () => new TitleScene(g))],
  ])('the %s screen plays the menu music', (_name, open) => {
    const { game, calls } = stubGame();
    open(game);
    expect(calls).toEqual(['start:menu']);
  });
});
