import { describe, expect, it } from 'vitest';
import { MUTE_BUTTON, takeClick } from '../../games/squad/controls.ts';
import { LevelSelectScene } from '../../games/squad/scenes/levelSelect.ts';
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
