// Draws the game state. Read-only: never changes gameplay.
import { type AssetStore, drawSprite } from '../../../engine/assets.ts';
import { type PerspectiveConfig, project } from '../../../engine/perspective.ts';
import { BARRAGE_GAP, BARRAGE_WARN, BOSS_HALF_W, BURST_SECONDS, CHARGE_HALF_W, MAX_DRAWN, SPAWN_HORIZON } from '../sim/constants.ts';
import type { Boss, Entity, GameState, Projectile } from '../sim/state.ts';
import { projectPlayfieldPoint } from './projection.ts';
import type { SquadView } from './squadView.ts';

export interface RenderView {
  persp: PerspectiveConfig;
  assets: AssetStore;
  time: number;
  squadView: SquadView;
  shake: { x: number; y: number };
  drawEffects?: (ctx: CanvasRenderingContext2D) => void;
}

const ROAD_NEAR = -3;
const ROAD_FAR = 400;
const TILE_LENGTH = 8; // metres of road per road_tile image
const PROP_SPACING = 12;
const UNIT_SCALE = 0.8;
// Cannon centre is 160 px above the feet in the 2x boss art.
const BOSS_MUZZLE_HEIGHT = 80;
const FONT = '"Trebuchet MS", "Segoe UI", sans-serif';

type Draw = { z: number; draw: () => void };

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState, view: RenderView): void {
  const { persp } = view;
  ctx.save();
  ctx.translate(view.shake.x, view.shake.y);
  drawBackground(ctx, persp);
  drawRoad(ctx, view.persp, state.distance, view.assets.image('road_tile'));
  if (state.boss) drawAttackWarnings(ctx, state.boss, view);

  const items: Draw[] = [];
  addProps(items, ctx, state, view);
  for (const e of state.entities) {
    items.push({
      z: e.z,
      draw: () => {
        ctx.save();
        ctx.globalAlpha = fadeIn(e.z);
        drawEntity(ctx, e, view);
        ctx.restore();
      },
    });
  }
  if (state.boss) {
    const boss = state.boss;
    items.push({
      z: boss.z,
      draw: () => drawBoss(ctx, boss, view),
    });
  }
  for (const b of state.bullets) {
    items.push({
      z: b.z,
      draw: () => {
        const p = projectPlayfieldPoint(persp, b.x, b.z);
        // Once shot count is capped, extra soldiers increase each shot's
        // damage. Make that extra firepower visible without moving its aim.
        const weight = Math.min(2.5, Math.sqrt(Math.max(1, b.damage)));
        drawSprite(ctx, view.assets, 'bullet', view.time, p.sx, p.sy - 18 * p.scale, p.scale * weight);
      },
    });
  }
  const positions = view.squadView.positions;
  for (let i = positions.length - 1; i >= 0; i--) {
    const s = positions[i];
    items.push({
      z: s.dz,
      draw: () => {
        const p = projectPlayfieldPoint(persp, state.squad.x + s.dx, s.dz);
        drawSprite(ctx, view.assets, 'soldier_run', view.time + i * 0.07, p.sx, p.sy, p.scale * UNIT_SCALE);
      },
    });
  }
  items.sort((a, b) => b.z - a.z);
  for (const item of items) item.draw();
  view.drawEffects?.(ctx);
  // Threats and target numbers stay readable over cosmetic particles.
  drawBossProjectiles(ctx, state.projectiles, view);
  drawCombatLabels(ctx, state, view);

  ctx.restore();
  drawHud(ctx, state, view);
}

function bossArtScale(persp: PerspectiveConfig): number {
  return (2 * BOSS_HALF_W * persp.roadHalfWidthPx) / 160;
}

// A quad on the road surface between two lanes and two distances.
function roadQuad(ctx: CanvasRenderingContext2D, persp: PerspectiveConfig, x0: number, x1: number, z0: number, z1: number): void {
  const a = project(persp, x0, z0);
  const b = project(persp, x1, z0);
  const c = project(persp, x1, z1);
  const d = project(persp, x0, z1);
  ctx.beginPath();
  ctx.moveTo(a.sx, a.sy);
  ctx.lineTo(b.sx, b.sy);
  ctx.lineTo(c.sx, c.sy);
  ctx.lineTo(d.sx, d.sy);
  ctx.closePath();
}

// Signature attack warnings, painted on the road under everything else: the
// Charger's red stripe down the squad's lane, and the Fortress's shell shadows
// with the one safe gap outlined in green.
function drawAttackWarnings(ctx: CanvasRenderingContext2D, boss: Boss, view: RenderView): void {
  const attack = boss.attack;
  const { persp } = view;
  const pulse = 0.5 + 0.5 * Math.sin(view.time * 18);
  ctx.save();
  if (attack?.kind === 'charge' && (attack.stage === 'warn' || attack.stage === 'lunge')) {
    ctx.globalAlpha = attack.stage === 'lunge' ? 0.55 : 0.25 + 0.25 * pulse;
    ctx.fillStyle = '#E04040';
    roadQuad(ctx, persp, attack.laneX - CHARGE_HALF_W, attack.laneX + CHARGE_HALF_W, -3, boss.z);
    ctx.fill();
  }
  if (attack?.kind === 'barrage' && attack.t <= BARRAGE_WARN) {
    const left = attack.gapX - BARRAGE_GAP / 2;
    const right = attack.gapX + BARRAGE_GAP / 2;
    // Darker as the shells get closer to landing.
    ctx.globalAlpha = 0.3 + 0.35 * (1 - attack.t / BARRAGE_WARN);
    ctx.fillStyle = '#1A1A2E';
    if (left > -1) {
      roadQuad(ctx, persp, -1, left, -3, 2);
      ctx.fill();
    }
    if (right < 1) {
      roadQuad(ctx, persp, right, 1, -3, 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.6 + 0.4 * pulse;
    ctx.strokeStyle = '#5BE37A';
    ctx.lineWidth = 4;
    roadQuad(ctx, persp, left, right, -3, 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBoss(ctx: CanvasRenderingContext2D, boss: Boss, view: RenderView): void {
  const p = project(view.persp, boss.x, boss.z);
  const id = boss.hp < boss.maxHp / 2 ? 'boss_damaged' : 'boss_idle';
  const s = p.scale * bossArtScale(view.persp);
  // Enraged: a red aura. Charging a volley: a fast orange pulse.
  const pulse = 0.5 + 0.5 * Math.sin(view.time * 30);
  if (boss.enraged || boss.charging) {
    ctx.save();
    ctx.globalAlpha = boss.charging ? 0.35 + 0.35 * pulse : 0.3;
    ctx.fillStyle = boss.charging ? '#FF8A1F' : '#E04040';
    ctx.beginPath();
    ctx.ellipse(p.sx, p.sy - 64 * s, 130 * s, 105 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Exposed after a charge, or stunned once its shield breaks: a gold glow
  // that says "hit it now".
  const attack = boss.attack;
  if ((attack?.kind === 'charge' && attack.stage === 'exposed') || attack?.kind === 'stunned') {
    ctx.save();
    ctx.globalAlpha = 0.3 + 0.2 * pulse;
    ctx.fillStyle = '#F5C242';
    ctx.beginPath();
    ctx.ellipse(p.sx, p.sy - 64 * s, 140 * s, 115 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const flash = boss.charging ? Math.max(boss.flash, 0.04 * pulse) : boss.flash;
  drawSprite(ctx, view.assets, id, view.time, p.sx, p.sy, s, { flash });
  if (attack?.kind === 'shield') {
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#7FD8FF';
    ctx.beginPath();
    ctx.ellipse(p.sx, p.sy - 64 * s, 125 * s, 100 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = '#7FD8FF';
    ctx.lineWidth = Math.max(2, 8 * s);
    ctx.stroke();
    ctx.restore();
  }
}

function drawBossProjectiles(ctx: CanvasRenderingContext2D, projectiles: readonly Projectile[], view: RenderView): void {
  const { persp } = view;
  const muzzleHeight = BOSS_MUZZLE_HEIGHT * bossArtScale(persp);
  for (const pr of projectiles) {
    // Fan out from the captured muzzle, then descend to the landing lane.
    // Boss movement cannot drag shells already in flight.
    const remaining = Math.min(1, Math.max(0, pr.z / pr.originZ));
    const x = pr.x + (pr.originX - pr.x) * remaining;
    const p = project(persp, x, pr.z);
    const height = 10 + (muzzleHeight - 10) * remaining;
    ctx.fillStyle = '#FF8A1F';
    ctx.strokeStyle = '#1A1A2E';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.sx, p.sy - height * p.scale, 9 * p.scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

// Objects appear at the spawn horizon; fade them in rather than popping.
function fadeIn(z: number): number {
  return Math.min(1, Math.max(0, (SPAWN_HORIZON - z) / 12));
}

function drawBackground(ctx: CanvasRenderingContext2D, persp: PerspectiveConfig): void {
  const sky = ctx.createLinearGradient(0, 0, 0, persp.horizonY);
  sky.addColorStop(0, '#8FD3FF');
  sky.addColorStop(1, '#D8F1FF');
  ctx.fillStyle = sky;
  ctx.fillRect(-20, -20, persp.width + 40, persp.horizonY + 20);
  ctx.fillStyle = '#6CBF4B';
  ctx.fillRect(-20, persp.horizonY, persp.width + 40, persp.height - persp.horizonY + 20);
}

export function drawRoad(
  ctx: CanvasRenderingContext2D,
  persp: PerspectiveConfig,
  distance: number,
  tile: HTMLImageElement | null,
): void {
  if (tile) {
    // One slice per screen row, exactly as wide as the road at that row, so
    // the tile never overhangs the road edges.
    const top = Math.floor(project(persp, 0, ROAD_FAR).sy);
    const bottom = Math.min(persp.height, Math.ceil(project(persp, 0, ROAD_NEAR).sy));
    const span = persp.squadLineY - persp.horizonY;
    for (let y = top; y < bottom; y++) {
      const scale = (y + 0.5 - persp.horizonY) / span;
      const z = persp.focal / scale - persp.focal;
      const v = ((((z + distance) % TILE_LENGTH) + TILE_LENGTH) % TILE_LENGTH) / TILE_LENGTH;
      const srcY = Math.floor((1 - v) * (tile.height - 1));
      const halfW = persp.roadHalfWidthPx * scale;
      ctx.drawImage(tile, 0, srcY, tile.width, 1, persp.width / 2 - halfW, y, 2 * halfW, 1);
    }
  } else {
    for (let z = ROAD_FAR; z > ROAD_NEAR; ) {
      const band = Math.max(1, z / 15);
      const far = project(persp, -1, z);
      const near = project(persp, -1, z - band);
      const farR = project(persp, 1, z);
      const nearR = project(persp, 1, z - band);
      ctx.fillStyle = Math.floor((z + distance) / 4) % 2 === 0 ? '#6B6F7A' : '#62666F';
      ctx.beginPath();
      ctx.moveTo(far.sx, far.sy);
      ctx.lineTo(farR.sx, farR.sy);
      ctx.lineTo(nearR.sx, nearR.sy + 1);
      ctx.lineTo(near.sx, near.sy + 1);
      ctx.closePath();
      ctx.fill();
      z -= band;
    }
  }
  // Kerbs
  for (const side of [-1, 1]) {
    const a = project(persp, side, ROAD_FAR);
    const b = project(persp, side, ROAD_NEAR);
    ctx.strokeStyle = '#F4F4F4';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.stroke();
  }
}

const PROPS = ['prop_tree', 'prop_rock', 'prop_tree', 'prop_crate'];

function addProps(items: Draw[], ctx: CanvasRenderingContext2D, state: GameState, view: RenderView): void {
  const first = Math.ceil((state.distance + ROAD_NEAR) / PROP_SPACING);
  const last = Math.floor((state.distance + SPAWN_HORIZON) / PROP_SPACING);
  for (let k = first; k <= last; k++) {
    const z = k * PROP_SPACING - state.distance;
    for (const side of [-1, 1]) {
      const i = Math.abs(k * 2 + (side > 0 ? 1 : 0));
      const x = side * (1.3 + (i % 3) * 0.18);
      items.push({
        z,
        draw: () => {
          const p = projectPlayfieldPoint(view.persp, x, z);
          drawSprite(ctx, view.assets, PROPS[i % PROPS.length], view.time, p.sx, p.sy, p.scale, { alpha: fadeIn(z) });
        },
      });
    }
  }
}

function drawEntity(ctx: CanvasRenderingContext2D, e: Entity, view: RenderView): void {
  const { persp, assets, time } = view;
  const p = projectPlayfieldPoint(persp, e.x, e.z);
  const widthPx = 2 * e.halfW * persp.roadHalfWidthPx;
  switch (e.type) {
    case 'enemy':
      drawSprite(ctx, assets, 'enemy_walk', time + e.id * 0.13, p.sx, p.sy, p.scale * UNIT_SCALE, { flash: e.flash });
      break;
    case 'heavy':
      drawSprite(ctx, assets, 'heavy_walk', time + e.id * 0.13, p.sx, p.sy, p.scale * UNIT_SCALE, { flash: e.flash });
      break;
    case 'cage': {
      // Bars come off as it takes damage: one per quarter, the last ones together.
      const frames = assets.entry('cage')?.frames ?? 1;
      const frame = Math.min(frames - 1, Math.floor((1 - e.hp / e.maxHp) * frames));
      drawSprite(ctx, assets, 'cage', time, p.sx, p.sy, p.scale, { flash: e.flash, frame });
      break;
    }
    case 'gate': {
      const good = e.value > 0;
      drawSprite(ctx, assets, good ? 'gate_positive' : 'gate_negative', time, p.sx, p.sy, p.scale, {
        stretchX: widthPx / 128,
        flash: e.flash,
      });
      break;
    }
    case 'hazard':
      if (e.kind === 'blade') {
        const n = Math.max(1, Math.round(widthPx / 64));
        for (let i = 0; i < n; i++) {
          const x = e.x - e.halfW + (e.halfW * 2 * (i + 0.5)) / n;
          const q = projectPlayfieldPoint(persp, x, e.z);
          drawSprite(ctx, assets, 'hazard_blade', time, q.sx, q.sy, q.scale * Math.min(1, widthPx / n / 64));
        }
      } else {
        const id = e.kind === 'fire' ? 'hazard_fire' : 'hazard_barricade';
        drawSprite(ctx, assets, id, time, p.sx, p.sy, p.scale, { stretchX: widthPx / 128 });
      }
      break;
  }
}

// Annotation pass: particles and player bullets cannot cover rescue goals.
function drawCombatLabels(ctx: CanvasRenderingContext2D, state: GameState, view: RenderView): void {
  for (const e of state.entities) drawEntityLabels(ctx, e, view);
  if (state.boss) drawBossLabels(ctx, state.boss, view);
}

function drawEntityLabels(ctx: CanvasRenderingContext2D, e: Entity, view: RenderView): void {
  const p = projectPlayfieldPoint(view.persp, e.x, e.z);
  ctx.save();
  ctx.globalAlpha = fadeIn(e.z);
  switch (e.type) {
    case 'heavy':
      label(ctx, String(Math.ceil(e.hp)), p.sx, p.sy - 100 * p.scale, 18 * p.scale + 6, '#FFFFFF');
      break;
    case 'cage':
      label(ctx, `+${e.value}`, p.sx, p.sy - 66 * p.scale, 22 * p.scale + 6, '#F5C242');
      label(ctx, String(Math.ceil(e.hp)), p.sx, p.sy - 28 * p.scale, 18 * p.scale + 6, '#FFFFFF');
      break;
    case 'gate': {
      let text = '0';
      if (e.value > 0) text = `+${e.value}`;
      else if (e.value < 0) text = `−${-e.value}`;
      label(ctx, text, p.sx, p.sy - 26 * p.scale, 30 * p.scale + 6, e.value > 0 ? '#7CFC6A' : '#FF6B6B');
      break;
    }
  }
  ctx.restore();
}

function drawBossLabels(ctx: CanvasRenderingContext2D, boss: Boss, view: RenderView): void {
  const p = project(view.persp, boss.x, boss.z);
  const s = p.scale * bossArtScale(view.persp);
  label(ctx, String(Math.ceil(boss.hp)), p.sx, p.sy - 150 * s, 30 * s + 12, '#FFFFFF');
  if (boss.charging) label(ctx, '!', p.sx, p.sy - 200 * s, 44 * s + 12, '#FF8A1F');
  if (boss.attack?.kind === 'shield') label(ctx, String(Math.ceil(boss.attack.hp)), p.sx, p.sy - 20 * s, 26 * s + 10, '#7FD8FF');
}

export function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string): void {
  ctx.font = `bold ${Math.round(size)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size / 5);
  ctx.strokeStyle = '#1A1A2E';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

// The kill meter, under the top bar; tapping it while full fires the burst.
export const BURST_BUTTON = { x: 160, y: 84, w: 220, h: 34 };

function drawKillMeter(ctx: CanvasRenderingContext2D, state: GameState, time: number): void {
  const { x, y, w, h } = BURST_BUTTON;
  const firing = state.burstTime > 0;
  const full = !firing && state.meter >= state.level.burstKills;
  const frac = firing ? state.burstTime / BURST_SECONDS : state.meter / state.level.burstKills;
  const pulse = 0.5 + 0.5 * Math.sin(time * 8);
  ctx.fillStyle = full ? `rgba(245,194,66,${0.35 + 0.35 * pulse})` : 'rgba(26,26,46,0.55)';
  ctx.strokeStyle = full ? '#FFFFFF' : '#1A1A2E';
  ctx.lineWidth = full ? 3 : 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = firing ? '#FF5A1F' : '#FF8A1F';
  ctx.beginPath();
  ctx.roundRect(x + 4, y + 4, Math.max(0, (w - 8) * Math.min(1, frac)), h - 8, (h - 8) / 2);
  ctx.fill();
  if (full) label(ctx, 'RAPID FIRE!', x + w / 2, y + h / 2 + 1, 20 + 2 * pulse, '#FFFFFF');
  else label(ctx, firing ? 'FIRING' : 'RAPID FIRE', x + w / 2, y + h / 2 + 1, 16, firing ? '#FFFFFF' : 'rgba(255,255,255,0.75)');
}

function drawHud(ctx: CanvasRenderingContext2D, state: GameState, view: RenderView): void {
  const { persp } = view;
  const front = project(persp, state.squad.x, 0);
  const bx = front.sx;
  const by = front.sy - 62;
  const heavyFire = state.squad.count > MAX_DRAWN;
  ctx.fillStyle = heavyFire ? '#F5C242' : '#2F7DE1';
  ctx.strokeStyle = '#1A1A2E';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(bx - 34, by - 18, 68, 36, 12);
  ctx.fill();
  ctx.stroke();
  label(ctx, String(state.squad.count), bx, by + 1, 24, '#FFFFFF');
  if (heavyFire) label(ctx, 'HEAVY FIRE', bx, by - 32, 14, '#F5C242');

  // Top bar: progress along the road, or boss health.
  const x = 70;
  const w = persp.width - 140;
  const y = 52;
  ctx.fillStyle = 'rgba(26,26,46,0.55)';
  ctx.beginPath();
  ctx.roundRect(x - 4, y - 4, w + 8, 22, 11);
  ctx.fill();
  let frac: number;
  let color: string;
  if (state.boss) {
    frac = state.boss.hp / state.boss.maxHp;
    color = '#E04040';
  } else {
    frac = state.distance / state.level.length;
    color = '#F5C242';
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(0, w * Math.min(1, frac)), 14, 7);
  ctx.fill();
  label(ctx, state.boss ? 'BOSS' : `Level ${state.level.id}`, persp.width / 2, y - 22, 20, '#FFFFFF');
  ctx.font = `bold 14px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1A1A2E';
  ctx.fillText(state.level.name, 16, 24);
  drawKillMeter(ctx, state, view.time);
  const targetStars = state.squad.count < state.level.stars[0] ? 2 : 3;
  const target = state.level.stars[targetStars - 2];
  label(ctx, `${targetStars} stars: finish with ${target}`, persp.width / 2, 142, 18, '#F5C242');
}
