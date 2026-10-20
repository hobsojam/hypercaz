import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { AssetStore, parseManifest } from '../../engine/assets.ts';
import { BUILD } from '../../games/squad/build.ts';
import { TitleScene } from '../../games/squad/scenes/title.ts';
import { stubCtx } from './stubCtx.ts';
import { stubGame } from './stubGame.ts';

const root = join(import.meta.dirname, '../..');

test('the title screen names the build, so playtest reports can say which one', () => {
  const { game } = stubGame();
  game.assets = AssetStore.fromManifest(parseManifest(JSON.parse(readFileSync(join(root, 'games/squad/assets/manifest.json'), 'utf8'))));
  const ctx = stubCtx();
  new TitleScene(game).render(ctx);
  const texts = (ctx.calls.fillText ?? []).map(([text]) => text);
  expect(BUILD).toMatch(/^\d{4}-\d{2}-\d{2} \w+$/);
  expect(texts).toContainEqual(expect.stringContaining(BUILD));
});
