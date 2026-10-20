import { expect, test } from 'vitest';
import { PlayScene } from '../../games/squad/scenes/play.ts';
import { ResultsScene } from '../../games/squad/scenes/results.ts';
import { spawnEntity, type GameState } from '../../games/squad/sim/state.ts';
import { makeLevel } from './fixtures.ts';
import { stubGame } from './stubGame.ts';

function renderedTexts(scene: { render(ctx: CanvasRenderingContext2D, alpha: number): void }): string[] {
  const texts: string[] = [];
  const ctx: object = new Proxy({}, {
    get: (_target, key) => key === 'fillText' ? (text: string) => texts.push(text) : () => ctx,
    set: () => true,
  });
  scene.render(ctx as CanvasRenderingContext2D, 0);
  return texts;
}

test('a fatal blade contact survives the end delay and gives an actionable retry hint', () => {
  const { game, scenes } = stubGame();
  game.levels[0].level = makeLevel({ startSquad: 18, spawns: [{ type: 'hazard', kind: 'blade', width: 2, z: 0, x: 0 }] });
  const scene = new PlayScene(game, 0);
  const state = (scene as unknown as { state: GameState }).state;
  state.entities = [spawnEntity(state, state.level.spawns[0], 0)];
  state.nextSpawn = 1;
  for (let i = 0; i < 90 && scenes.length === 0; i++) scene.update(1 / 60);
  expect(state.phase).toBe('lost');
  expect(scenes[0]).toBeInstanceOf(ResultsScene);
  expect(renderedTexts(scenes[0])).toEqual(expect.arrayContaining([
    'Final hit: Blade −18', 'Steer clear of the blade lane.', 'Win to earn your first star.',
  ]));
});

test.each([
  { count: 4, stars: 1 as const, goal: '1 more soldier for 2 stars', target: 'Finish with 5 soldiers.' },
  { count: 5, stars: 2 as const, goal: '5 more soldiers for 3 stars', target: 'Finish with 10 soldiers.' },
  { count: 10, stars: 3 as const, goal: 'All 3 stars earned!', target: '10 soldiers left' },
])('a $stars-star victory explains the replay goal', ({ count, stars, goal, target }) => {
  const { game } = stubGame();
  const scene = new ResultsScene(game, 0, true, stars, count);
  expect(renderedTexts(scene)).toEqual(expect.arrayContaining([goal, target]));
});

test('defeat without a recorded contact gives a recovery goal without inventing a cause', () => {
  const { game } = stubGame();
  const texts = renderedTexts(new ResultsScene(game, 0, false, 0, 0));
  expect(texts).toContain('Win to earn your first star.');
  expect(texts.some(t => t.startsWith('Final hit:'))).toBe(false);
});
