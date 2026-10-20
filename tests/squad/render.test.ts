import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { AssetStore, parseManifest } from '../../engine/assets.ts';
import { DEFAULT_VIEW, project } from '../../engine/perspective.ts';
import { drawRoad, renderGame } from '../../games/squad/render/draw.ts';
import { SquadView } from '../../games/squad/render/squadView.ts';
import { botInput } from '../../games/squad/sim/bot.ts';
import { formationSlots } from '../../games/squad/sim/formation.ts';
import { validateLevel } from '../../games/squad/sim/level.ts';
import { createState, spawnEntity } from '../../games/squad/sim/state.ts';
import { step } from '../../games/squad/sim/step.ts';
import { makeLevel } from './fixtures.ts';
import { stubCtx } from './stubCtx.ts';

const root = join(import.meta.dirname, '../..');
const assets = AssetStore.fromManifest(parseManifest(JSON.parse(readFileSync(join(root, 'games/squad/assets/manifest.json'), 'utf8'))));

test('renders a whole bot run of level 1 without throwing', () => {
  const level = validateLevel(JSON.parse(readFileSync(join(root, 'games/squad/levels/01.json'), 'utf8')), '01.json');
  const state = createState(level, 1);
  const ctx = stubCtx();
  const squadView = new SquadView();
  let frames = 0;
  for (let i = 0; i < 60 * 300 && state.phase !== 'won' && state.phase !== 'lost'; i++) {
    step(state, botInput(state), 1 / 60);
    squadView.update(formationSlots(state.squad.count), 1 / 60);
    if (i % 10 === 0) {
      renderGame(ctx, state, { persp: DEFAULT_VIEW, assets, time: state.time, squadView, shake: { x: 0, y: 0 } });
      frames++;
    }
  }
  expect(state.phase).toBe('won');
  expect(frames).toBeGreaterThan(100);
  const drawn = ['fillRect', 'fill', 'drawImage'].reduce((n, m) => n + (ctx.calls[m]?.length ?? 0), 0);
  expect(drawn).toBeGreaterThan(0);
});

test('squad view eases displayed slots to their targets', () => {
  const view = new SquadView();
  const slots = formationSlots(12);
  for (let i = 0; i < 60; i++) view.update(slots, 1 / 60);
  expect(view.positions).toHaveLength(12);
  view.positions.forEach((p, i) => {
    expect(Math.abs(p.dx - slots[i].dx)).toBeLessThan(0.01);
    expect(Math.abs(p.dz - slots[i].dz)).toBeLessThan(0.01);
  });
});

test('new soldiers appear at the squad centre', () => {
  const view = new SquadView();
  view.update(formationSlots(1), 1);
  view.update(formationSlots(3), 0);
  expect(view.positions.map((p) => p.dx)).toEqual([0, 0, 0]);
});

test('the road tile is drawn inside the road edges, with no overhang', () => {
  const persp = DEFAULT_VIEW;
  const ctx = stubCtx();
  drawRoad(ctx, persp, 123.4, { width: 512, height: 256 } as HTMLImageElement);
  const slices = (ctx.calls.drawImage as number[][]).map(([, , , , , dx, dy, dw, dh]) => ({ dx, dy, dw, dh }));

  expect(slices.length).toBeGreaterThan(500);
  // The road edge at screen row y, from the projection's inverse.
  const edgeAt = (y: number) => {
    const scale = (y - persp.horizonY) / (persp.squadLineY - persp.horizonY);
    const z = persp.focal / scale - persp.focal;
    return { left: project(persp, -1, z).sx, right: project(persp, 1, z).sx };
  };
  for (const s of slices) {
    expect(s.dh).toBeLessThanOrEqual(1.01);
    for (const y of [s.dy, s.dy + s.dh]) {
      const { left, right } = edgeAt(y);
      expect(s.dx).toBeGreaterThanOrEqual(Math.min(left, edgeAt(s.dy + s.dh).left) - 0.5);
      expect(s.dx + s.dw).toBeLessThanOrEqual(Math.max(right, edgeAt(s.dy + s.dh).right) + 0.5);
    }
  }
});

// Every piece of text drawn for one frame of `state`.
function textsDrawn(state: ReturnType<typeof createState>): string[] {
  const ctx = stubCtx();
  renderGame(ctx, state, { persp: DEFAULT_VIEW, assets, time: 0, squadView: new SquadView(), shake: { x: 0, y: 0 } });
  return (ctx.calls.fillText ?? []).map(([text]) => text as string);
}

test('a cage shows its remaining hit points as well as its reward', () => {
  const state = createState(makeLevel({ speed: 6, spawns: [{ z: 20, x: 0.5, type: 'cage', hp: 37, value: 5 }] }), 1);
  step(state, { targetX: -0.9 }, 1 / 60);
  expect(textsDrawn(state)).toEqual(expect.arrayContaining(['+5', '37']));
});

test('the boss shows its remaining health as a number', () => {
  const state = createState(makeLevel({ startSquad: 5 }), 1);
  state.phase = 'boss';
  state.boss = { hp: 1234.4, maxHp: 5000, x: 0, z: 18, fireTimer: 5, summonTimer: 5, enraged: false, charging: false, flash: 0 };
  expect(textsDrawn(state)).toContain('1235');
});

test.each([
  { z: 20, sx: 293, sy: 452.5 },
  { z: 10, sx: 346.6666667, sy: 565 },
  { z: 0, sx: 454, sy: 790 },
])('a boss shell travels from the muzzle to its landing point (z=$z)', ({ z, sx, sy }) => {
  const state = createState(makeLevel(), 1);
  // The tank has since moved: an in-flight shell must retain its own origin.
  state.phase = 'boss';
  state.boss = { hp: 100, maxHp: 100, x: -0.4, z: 8, fireTimer: 5, summonTimer: 5, enraged: false, charging: false, flash: 0 };
  state.projectiles = [{ x: 0.8, z, originX: 0.2, originZ: 20 }];
  const before = structuredClone(state);
  const ctx = stubCtx();
  renderGame(ctx, state, { persp: DEFAULT_VIEW, assets, time: 0, squadView: new SquadView(), shake: { x: 0, y: 0 } });
  expect(ctx.calls.arc).toHaveLength(1);
  const [x, y] = ctx.calls.arc[0] as number[];
  expect(x).toBeCloseTo(sx);
  expect(y).toBeCloseTo(sy);
  expect(state).toEqual(before);
});

test('a full kill meter prompts the player to fire', () => {
  const state = createState(makeLevel({ startSquad: 5 }), 1);
  expect(textsDrawn(state)).not.toContain('RAPID FIRE!');
  state.meter = state.level.burstKills;
  expect(textsDrawn(state)).toContain('RAPID FIRE!');
});

// Supply decoded sprite dimensions while recording the real renderer's output.
function squadFrame(count: number, x = 0, bullets: ReturnType<typeof createState>['bullets'] = [], entities: ReturnType<typeof createState>['entities'] = []) {
  const store = AssetStore.fromManifest(parseManifest(JSON.parse(readFileSync(join(root, 'games/squad/assets/manifest.json'), 'utf8'))));
  const soldier = { width: 256, height: 80 } as HTMLImageElement;
  const bullet = { width: 16, height: 24 } as HTMLImageElement;
  const cage = { width: 96, height: 112 } as HTMLImageElement;
  store.image = id => id === 'soldier_run' ? soldier : id === 'bullet' ? bullet : id === 'cage' ? cage : null;
  const state = createState(makeLevel({ startSquad: count }), 1);
  state.squad.x = x;
  state.bullets = bullets;
  state.entities = entities;
  const before = structuredClone(state);
  const squadView = new SquadView();
  squadView.update(formationSlots(count), 1);
  const ctx = stubCtx();
  renderGame(ctx, state, { persp: DEFAULT_VIEW, assets: store, time: 0, squadView, shake: { x: 0, y: 0 } });
  expect(state).toEqual(before);
  const rectangles = (image: HTMLImageElement) => (ctx.calls.drawImage ?? [])
    .filter(call => call[0] === image)
    .map(call => ({ x: call[5] as number, y: call[6] as number, w: call[7] as number, h: call[8] as number }));
  return { soldiers: rectangles(soldier), bullets: rectangles(bullet), cages: rectangles(cage), texts: (ctx.calls.fillText ?? []).map(call => call[0]) };
}

test.each([30, 100, 300].flatMap(count => [-0.79, 0, 0.79].map(x => ({ count, x }))))(
  'the whole displayed army fits the play area (count=$count, x=$x)', ({ count, x }) => {
    const { soldiers } = squadFrame(count, x);
    expect(soldiers).toHaveLength(Math.min(count, 150));
    for (const r of soldiers) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(DEFAULT_VIEW.width);
      expect(r.y + r.h).toBeLessThanOrEqual(DEFAULT_VIEW.height - 32);
    }
    expect(Math.min(...soldiers.map(r => r.y + r.h))).toBeCloseTo(DEFAULT_VIEW.squadLineY);
  },
);

test('rear-row shots originate inside the displayed army and stay put when its size changes', () => {
  const rear = formationSlots(150).at(-1)!;
  const bullets = [{ x: rear.dx, z: rear.dz, damage: 1, vx: 0 }];
  const large = squadFrame(150, 0, bullets);
  const shot = large.bullets[0];
  const sx = shot.x + shot.w / 2, sy = shot.y + shot.h / 2;
  expect(large.soldiers.some(r => sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h)).toBe(true);
  expect(sy).toBeLessThan(DEFAULT_VIEW.height);
  expect(squadFrame(30, 0, bullets).bullets[0]).toEqual(shot);
});

test('shots carrying extra army damage look heavier without changing their path', () => {
  const ordinary = squadFrame(150, 0, [{ x: 0.2, z: 10, damage: 1, vx: 0 }]).bullets[0];
  const heavy = squadFrame(300, 0, [{ x: 0.2, z: 10, damage: 2, vx: 0 }]).bullets[0];
  expect(heavy.w).toBeGreaterThan(ordinary.w);
  expect(heavy.h).toBeGreaterThan(ordinary.h);
  expect(heavy.x + heavy.w / 2).toBeCloseTo(ordinary.x + ordinary.w / 2);
  expect(heavy.y + heavy.h / 2).toBeCloseTo(ordinary.y + ordinary.h / 2);
  expect(squadFrame(300).texts).toContain('HEAVY FIRE');
  expect(squadFrame(100).texts).not.toContain('HEAVY FIRE');
});

test('rear-row shots and a rescue target behind the front share the same play area', () => {
  const state = createState(makeLevel({ spawns: [{ z: 4, x: 0.79, type: 'cage', hp: 10, value: 3 }] }), 1);
  const cage = spawnEntity(state, state.level.spawns[0], -4);
  const frame = squadFrame(300, 0.79, [{ x: 0.79, z: -4, damage: 1, vx: 0 }], [cage]);
  const shot = frame.bullets[0], target = frame.cages[0];
  const sx = shot.x + shot.w / 2, sy = shot.y + shot.h / 2;
  expect(sx).toBeGreaterThanOrEqual(target.x);
  expect(sx).toBeLessThanOrEqual(target.x + target.w);
  expect(sy).toBeGreaterThanOrEqual(target.y);
  expect(sy).toBeLessThanOrEqual(target.y + target.h);
});

test.each([
  { count: 3, goal: '2 stars: finish with 5' },
  { count: 5, goal: '3 stars: finish with 10' },
  { count: 10, goal: '3 stars: finish with 10' },
])('the HUD shows the next survival target at $count soldiers', ({ count, goal }) => {
  expect(textsDrawn(createState(makeLevel({ startSquad: count }), 1))).toContain(goal);
});

test('rescue labels and boss shots remain above cosmetic effects', () => {
  const state = createState(makeLevel({ spawns: [{ type: 'cage', x: 0, z: 10, hp: 37, value: 8 }] }), 1);
  state.entities = [spawnEntity(state, state.level.spawns[0], 10)];
  state.projectiles = [{ x: 0, z: 5, originX: 0, originZ: 18 }];
  const ctx = stubCtx();
  renderGame(ctx, state, {
    persp: DEFAULT_VIEW, assets, time: 0, squadView: new SquadView(), shake: { x: 0, y: 0 },
    drawEffects: () => {
      expect(ctx.calls.arc ?? []).toHaveLength(0);
      ctx.fillText('effects', 0, 0);
    },
  });
  const texts = ctx.calls.fillText.map(([text]) => text);
  expect(texts).toContain('effects');
  expect(texts.indexOf('37')).toBeGreaterThan(texts.indexOf('effects'));
  expect(texts.indexOf('+8')).toBeGreaterThan(texts.indexOf('effects'));
  expect(ctx.calls.arc).toHaveLength(1);
});
