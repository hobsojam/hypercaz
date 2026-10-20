import { expect, test } from 'vitest';
import { AssetStore, parseManifest } from '../../engine/assets.ts';
import { MANIFEST } from '../../games/ricochet/assets.ts';
import { render } from '../../games/ricochet/render.ts';
import { Session } from '../../games/ricochet/session.ts';

function draw(session: Session) {
  const texts: string[] = [];
  const ctx: object = new Proxy({}, {
    get: (_t, name) => {
      if (name === 'fillText') return (text: string) => texts.push(text);
      if (name === 'measureText') return (text: string) => ({ width: text.length * 8 });
      return () => ctx;
    }, set: () => true,
  });
  render(ctx as CanvasRenderingContext2D, session, AssetStore.fromManifest(parseManifest(MANIFEST)));
  return texts;
}

test('the play view gives a shot budget, par and drag instructions without mutating the attempt', () => {
  const s = new Session(); const before = structuredClone(s.state);
  const text = draw(s);
  expect(text).toContain('3 shots left');
  expect(text).toContain('PAR 1');
  expect(text.some(t => /drag/i.test(t))).toBe(true);
  expect(s.state).toEqual(before);
});

test('winning and losing provide clear next actions, and all puzzles can be selected', () => {
  const s = new Session(); s.fire();
  for (let i = 0; i < 1000 && s.state.phase === 'flying'; i++) s.update(1 / 60);
  expect(draw(s)).toContain('Everyone is free!');
  expect(draw(s)).toContain('Next puzzle');
  expect(draw(s)).toContain('All three stars earned.');
  expect(draw(s)).not.toContain('Try fewer shots for more stars.');
  s.retry(); s.state.phase = 'lost';
  expect(draw(s)).toContain('Try a new angle');
  expect(draw(s)).toContain('Retry');
  s.showLevels(); const texts = draw(s);
  expect(texts).toContain('Choose a puzzle');
  expect(texts).toContain('Rescue Party');
});
