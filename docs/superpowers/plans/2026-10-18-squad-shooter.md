# Squad Shooter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build game one of `hypercaz`, a 2.5D auto-firing squad shooter played in the browser, with ~10 levels, placeholder art, and a self-contained art brief for Codex.

**Architecture:** A shared, game-agnostic `engine/` (loop, input, scenes, perspective, assets, particles, tween, audio, storage) plus `games/squad/`. The game is split into pure `sim/` logic (`step(state, input, dt)`, with no DOM) and a read-only `render/` layer. Levels are validated JSON. Missing art falls back to labelled placeholder shapes.

**Tech Stack:** TypeScript (strict, erasable syntax only), Canvas 2D, Vite, Vitest, ESLint (typescript-eslint), Node 24 (runs `.ts` scripts natively), GitHub Actions + GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-18-squad-shooter-design.md`

## Global Constraints

- No runtime dependencies. Dev dependencies only: `vite`, `typescript`, `vitest`, `eslint`, `@eslint/js`, `typescript-eslint`, `@types/node`.
- TypeScript `strict: true` and `erasableSyntaxOnly: true` (no enums, namespaces or parameter properties), so Node 24 can run `scripts/*.ts` directly.
- `sim/` must not touch DOM, canvas, `Date`, `performance` or `Math.random`. Randomness comes only from the seeded PRNG in state.
- World coordinates: `x` ∈ [−1, 1] across the road; `z` in metres up the road (0 = squad front line, positive = further away).
- Formation width cap: **38% of road width** (total span 0.76 in x units). Fire interval: **0.4 s** per soldier. Draw cap: **150** soldiers.
- Logical canvas: **540 × 960** portrait, letterboxed to fit the window, scaled by `devicePixelRatio`.
- Content: cartoon only. Losses show confetti, never gore.
- No monetisation, ads, currencies, timers, upgrades or analytics.
- `localStorage` access is always wrapped in try/catch. The game must work without it.
- Git: all work happens on branch `feat/squad-shooter`. Never commit to or push `main` directly. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Dependabot: every ecosystem block has `cooldown: default-days: 7`. CI runs `npm audit`.
- Creating the GitHub repo and pushing are outward-facing. Ask the user before doing either (Task 16).

### Deliberate refinements of the spec (flag these to the user at hand-off)

1. **Firepower above 150 soldiers:** bullets are capped at 375/s (150 ÷ 0.4). Firepower the cap removes is carried as extra damage per bullet, so total damage per second stays at `count / 0.4`, as the spec intends, without unbounded bullet objects.
2. **Manifest entries may have `"file": null`** to mean "not delivered yet". `check-assets` validates only non-null files, so CI passes before any art exists.
3. **`hazard_barricade`** is added to the asset list, since the spec defines a barricade hazard but no sprite for it.

## Review Focus

1. **Huge squad counts (e.g. 5000 after gates):** the frame rate must hold. Bullets stay capped and damage scales (test in Task 6).
2. **A long stall or background tab:** returning must not run thousands of steps or let bullets tunnel. The loop clamps the frame delta to 0.25 s, i.e. at most 15 steps (test in Task 10).
3. **A negative gate or hazard bigger than the squad:** the count clamps at 0 and `lost` fires exactly once, even with several contacts in one step (test in Task 7).
4. **Corrupted or missing saved progress:** garbage JSON or the wrong shape in storage falls back to defaults, so level 1 stays unlocked (test in Task 13).
5. **Window resize or an unusual aspect ratio:** pointer-to-world mapping stays correct after the letterbox changes (test in Task 10).

---

## File Map

```
package.json, tsconfig.json, vite.config.ts, eslint.config.js, index.html, .gitignore
.github/dependabot.yml, .github/workflows/ci.yml, .github/workflows/deploy.yml
engine/rng.ts           seeded PRNG (mulberry32)
engine/perspective.ts   world ↔ screen projection
engine/loop.ts          fixed-step loop with clamped frame delta
engine/input.ts         pointer/keys → canvas coords; letterbox mapping
engine/scenes.ts        scene stack
engine/storage.ts       safe namespaced JSON storage
engine/tween.ts         easings + tween values
engine/particles.ts     pooled particles
engine/audio.ts         Web Audio synthesized SFX + mute
engine/assets.ts        manifest types, loader, drawSprite with placeholders
games/squad/sim/constants.ts  all tuning constants
games/squad/sim/level.ts      Level types + validateLevel
games/squad/sim/formation.ts  formationSlots
games/squad/sim/state.ts      GameState types + createState
games/squad/sim/step.ts       step(): movement, scroll, spawn, despawn, phase
games/squad/sim/combat.ts     firing, bullets, hits
games/squad/sim/contact.ts    enemy contact, gates, hazards, count changes
games/squad/sim/boss.ts       boss entry, firing, projectiles
games/squad/sim/stars.ts      starsFor
games/squad/sim/bot.ts        botInput (test tool)
games/squad/levels/01.json … 10.json, games/squad/levels/index.ts
games/squad/assets/manifest.json
games/squad/render/draw.ts    renderGame
games/squad/render/squadView.ts  smoothed soldier display positions
games/squad/render/effects.ts    events → particles, pop-ups, shake, SFX
games/squad/progress.ts       saved progress (pure + storage)
games/squad/scenes/{title,levelSelect,play,results,error}.ts
games/squad/ui.ts             shared button/text drawing + hit testing
games/squad/main.ts           boot
scripts/check-assets.ts       asset validation (exported fn + CLI)
docs/art-brief.md             brief for Codex
tests/…                       mirrors source paths
```

---

### Task 1: Scaffold, tooling and seeded RNG

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `index.html`, `.gitignore`, `games/squad/main.ts` (stub), `.github/dependabot.yml`, `.github/workflows/ci.yml`, `engine/rng.ts`
- Test: `tests/engine/rng.test.ts`

**Interfaces:**
- Produces: `createRng(seed: number): number` (returns the initial state), `nextFloat(state: number): [value: number, nextState: number]` with value in [0, 1). A pure, state-passing design so the sim can keep `rngState` in `GameState`.

- [ ] **Step 1: Check the branch.** `git branch --show-current` must print `feat/squad-shooter` (the branch already exists and holds the plan).
- [ ] **Step 2: Scaffold.** `npm init -y`, then `npm i -D vite typescript vitest eslint @eslint/js typescript-eslint @types/node`.
  - `package.json`: `"type": "module"`, `"private": true`. Scripts: `dev: vite`, `build: tsc --noEmit && vite build`, `test: vitest run`, `lint: eslint .`, `check-assets: node scripts/check-assets.ts games/squad/assets`.
  - `tsconfig.json`: `strict`, `target ES2022`, `module ESNext`, `moduleResolution bundler`, `resolveJsonModule`, `allowImportingTsExtensions`, `noEmit`, `erasableSyntaxOnly`, `lib ["ES2022","DOM"]`, `types ["node"]`. Include `engine`, `games`, `scripts`, `tests`.
  - `vite.config.ts`: `defineConfig` from `vitest/config`, with `base: './'` and `test: { include: ['tests/**/*.test.ts'] }`.
  - `index.html`: a full-window black body containing `<canvas id="game">` and `<script type="module" src="/games/squad/main.ts">`. The `main.ts` stub draws "Squad Shooter" text.
  - `.gitignore`: `node_modules`, `dist`.
  - Imports between source files use explicit `.ts` extensions.
- [ ] **Step 3: Dependabot + CI.**
  - `.github/dependabot.yml`: ecosystems `npm` and `github-actions`, directory `/`, weekly, each block with `cooldown: { default-days: 7 }`.
  - `ci.yml`: on `pull_request` and `push` to `main`. Steps: `actions/checkout@v4`, `actions/setup-node@v4` (node 24, npm cache), `npm ci`, `npm run lint`, `npm test`, `npm run check-assets`, `npm audit --audit-level=high`, `npm run build`.
  - Add the `check-assets` step now, and keep it as a no-op until Task 11: the script path won't exist yet, so guard it with `if: hashFiles('scripts/check-assets.ts') != ''`.
- [ ] **Step 4: Write the failing test** `tests/engine/rng.test.ts`:
```ts
test('same seed gives same sequence', () => {
  let a = createRng(42), b = createRng(42);
  for (let i = 0; i < 5; i++) { const [va, na] = nextFloat(a); const [vb, nb] = nextFloat(b); expect(va).toBe(vb); a = na; b = nb; }
});
test('values are in [0,1) and different seeds differ', () => {
  let s = createRng(1); const seen: number[] = [];
  for (let i = 0; i < 1000; i++) { const [v, n] = nextFloat(s); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); seen.push(v); s = n; }
  expect(nextFloat(createRng(1))[0]).not.toBe(nextFloat(createRng(2))[0]);
});
```
- [ ] **Step 5: Run** `npx vitest run tests/engine/rng.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 6: Implement** `engine/rng.ts` using mulberry32 over 32-bit unsigned state.
- [ ] **Step 7: Verify** that `npm test`, `npm run lint` and `npm run build` all pass, and that `npm run dev` shows the stub text.
- [ ] **Step 8: Commit** with `git add -A && git commit -m "chore: scaffold project, CI, dependabot; add seeded rng"`.

---

### Task 2: Perspective projection

**Files:**
- Create: `engine/perspective.ts`
- Test: `tests/engine/perspective.test.ts`

**Interfaces:**
- Produces:
```ts
export interface PerspectiveConfig { width: number; height: number; horizonY: number; squadLineY: number; focal: number; roadHalfWidthPx: number }
export interface Projected { sx: number; sy: number; scale: number }
export const DEFAULT_VIEW: PerspectiveConfig // { width: 540, height: 960, horizonY: 220, squadLineY: 800, focal: 20, roadHalfWidthPx: 230 }
export function project(cfg: PerspectiveConfig, x: number, z: number): Projected
export function unprojectX(cfg: PerspectiveConfig, sx: number, z: number): number
```
- Formulas: `scale = focal / (focal + z)`, `sy = horizonY + (squadLineY − horizonY) × scale`, `sx = width/2 + x × roadHalfWidthPx × scale`. `z` is clamped to ≥ `−focal × 0.9` so the projection never divides by zero or flips.

- [ ] **Step 1: Write failing tests:**
```ts
expect(project(DEFAULT_VIEW, 0, 0)).toEqual({ sx: 270, sy: 800, scale: 1 });
const p = project(DEFAULT_VIEW, 1, 20); expect(p.scale).toBeCloseTo(0.5); expect(p.sx).toBeCloseTo(385); expect(p.sy).toBeCloseTo(510);
expect(unprojectX(DEFAULT_VIEW, project(DEFAULT_VIEW, 0.3, 10).sx, 10)).toBeCloseTo(0.3);
expect(Number.isFinite(project(DEFAULT_VIEW, 0, -50).scale)).toBe(true); // clamp
```
- [ ] **Step 2: Run** `npx vitest run tests/engine/perspective.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `engine/perspective.ts`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(engine): perspective projection`.

---

### Task 3: Level types and validation

**Files:**
- Create: `games/squad/sim/level.ts`
- Test: `tests/squad/sim/level.test.ts`

**Interfaces:**
- Produces:
```ts
export type SpawnType = 'enemy' | 'heavy' | 'cage' | 'gate' | 'hazard';
export type HazardKind = 'blade' | 'fire' | 'barricade';
export type BossPattern = 'single' | 'volley3' | 'spread5';
export interface Spawn { z: number; x: number; type: SpawnType; hp: number; value: number; width: number; kind: HazardKind | null; kills: number }
export interface Level { id: number; name: string; speed: number; startSquad: number; length: number; stars: [number, number]; spawns: Spawn[]; boss: { hp: number; pattern: BossPattern; fireEvery: number } }
export class LevelError extends Error {}
export function validateLevel(raw: unknown, file: string): Level
```
- Rules (each failure throws `LevelError` with the message `` `${file}: ${path} ${problem}` ``, e.g. `"03.json: spawns[2].x must be between -1 and 1"`):
  - `id` must be an integer ≥ 1. `name` must be a non-empty string. `speed` must be in (0, 30]. `startSquad` must be an integer ≥ 1. `length` must be > 0. `stars` must be two integers with 1 ≤ stars[0] ≤ stars[1].
  - Spawn `x` must be in [−1, 1] and `z` in [0, length]. `type` must be known.
  - `enemy`/`heavy`/`cage` need an integer `hp` ≥ 1. `cage` needs an integer `value` ≥ 1. `gate` needs an integer `value` and `width` in (0, 2]. `hazard` needs a `kind` from the list and `width` in (0, 2].
  - `kills` defaults to 1 for enemy and 3 for heavy. Unused fields default to `hp: 1, value: 0, width: 0, kind: null, kills: 0`.
  - `boss.hp` must be an integer ≥ 1, `pattern` must be known, and `fireEvery` must be > 0.
  - The returned spawns are sorted by ascending `z`.

- [ ] **Step 1: Write failing tests:**
  - A valid minimal level round-trips, with defaults filled in (`kills` = 1 for an enemy and 3 for a heavy).
  - Spawns given out of order come back sorted by `z`.
  - Each rule throws with the exact message, tested with `it.each` over at least: bad x (`"t.json: spawns[0].x must be between -1 and 1"`), unknown type, gate missing width, hazard bad kind, `stars` reversed, boss bad pattern, and non-object input (`"t.json: level must be an object"`).
- [ ] **Step 2: Run** `npx vitest run tests/squad/sim/level.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `validateLevel` with small field helpers (`num`, `int`, `oneOf`) that build the path string.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(sim): level schema and validation`.

---

### Task 4: Formation layout

**Files:**
- Create: `games/squad/sim/constants.ts`, `games/squad/sim/formation.ts`
- Test: `tests/squad/sim/formation.test.ts`

**Interfaces:**
- Produces in `constants.ts` (all later sim tasks import from here, so add their constants now):
```ts
export const FORMATION_MAX_WIDTH = 0.76, SLOT_DX = 0.07, SLOT_DZ = 0.9, MAX_DRAWN = 150;
export const FIRE_INTERVAL = 0.4, MAX_BULLETS_PER_SEC = MAX_DRAWN / FIRE_INTERVAL; // 375
export const BULLET_SPEED = 40, BULLET_RANGE = 60, SPAWN_HORIZON = 60, DESPAWN_Z = -5;
export const ENEMY_SPEED = 1.5, HEAVY_SPEED = 0.8, SQUAD_OMEGA = 12;
export const BOSS_Z = 18, BOSS_ENTRY_Z = 38, BOSS_ENTRY_SPEED = 5, BOSS_HALF_W = 0.5, BOSS_HALF_D = 2;
export const PROJECTILE_SPEED = 10, PROJECTILE_RADIUS = 0.12, BOSS_AIM_JITTER = 0.1;
export const SIZES = { enemy: { halfW: 0.05, halfD: 0.5 }, heavy: { halfW: 0.08, halfD: 0.8 }, cage: { halfW: 0.08, halfD: 0.6 }, gate: { halfD: 0.3 }, hazard: { halfD: 0.4 } } as const;
export const PATTERNS = { single: [0], volley3: [-0.25, 0, 0.25], spread5: [-0.5, -0.25, 0, 0.25, 0.5] } as const;
```
- Produces: `export interface Slot { dx: number; dz: number }`, `export function formationSlots(count: number): Slot[]`, `export function formationHalfWidth(slots: Slot[]): number` (max |dx|, minimum 0.03).
- Layout: `perRow = floor(FORMATION_MAX_WIDTH / SLOT_DX) + 1` (= 11). `drawn = min(count, MAX_DRAWN)`. Row *r* (0 = front) has `dz = −r × SLOT_DZ`. Rows fill front first, and each row is centred, including a partial last row.

- [ ] **Step 1: Write failing tests:**
```ts
expect(formationSlots(0)).toEqual([]);
expect(formationSlots(1)).toEqual([{ dx: 0, dz: 0 }]);
expect(formationSlots(5).every(s => s.dz === 0)).toBe(true);
const s12 = formationSlots(12); expect(s12.filter(s => s.dz === 0)).toHaveLength(11); expect(s12[11]).toEqual({ dx: 0, dz: -0.9 });
const big = formationSlots(5000); expect(big).toHaveLength(150); expect(Math.max(...big.map(s => Math.abs(s.dx)))).toBeLessThanOrEqual(0.38);
expect(formationHalfWidth(formationSlots(1))).toBe(0.03);
```
- [ ] **Step 2: Run** `npx vitest run tests/squad/sim/formation.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(sim): formation layout with width cap`.

---

### Task 5: Game state, movement, scrolling and spawning

**Files:**
- Create: `games/squad/sim/state.ts`, `games/squad/sim/step.ts`
- Test: `tests/squad/sim/step.test.ts`, plus `tests/squad/fixtures.ts` (a `makeLevel(overrides)` helper that returns a validated `Level`)

**Interfaces:**
- Consumes: `Level`, `Spawn` (Task 3); constants and `formationSlots`/`formationHalfWidth` (Task 4); `createRng` (Task 1).
- Produces:
```ts
export type Phase = 'advance' | 'boss' | 'won' | 'lost';
export interface Squad { x: number; vx: number; count: number; peak: number }
export interface Entity { id: number; type: SpawnType; x: number; z: number; hp: number; value: number; halfW: number; halfD: number; kind: HazardKind | null; kills: number; resolved: boolean; flash: number }
export interface Bullet { x: number; z: number; damage: number }
export interface Projectile { x: number; z: number }
export interface Boss { hp: number; maxHp: number; x: number; z: number; fireTimer: number; flash: number }
export type GameEvent =
  | { type: 'shot'; x: number; z: number }
  | { type: 'hit'; x: number; z: number; target: SpawnType | 'boss' }
  | { type: 'destroyed'; x: number; z: number; target: SpawnType }
  | { type: 'gain' | 'lose'; amount: number; x: number; z: number }
  | { type: 'bossArrive' } | { type: 'bossFire'; x: number } | { type: 'bossDead'; x: number; z: number }
  | { type: 'won' } | { type: 'lost' };
export interface GameState { level: Level; rngState: number; time: number; distance: number; phase: Phase; squad: Squad; entities: Entity[]; bullets: Bullet[]; projectiles: Projectile[]; boss: Boss | null; nextSpawn: number; fireAcc: number; shotIndex: number; nextId: number; events: GameEvent[] }
export interface Input { targetX: number }
export function createState(level: Level, seed: number): GameState
export function step(state: GameState, input: Input, dt: number): GameState // mutates and returns the same object
```
- `step` order: clear `events` → return early if `won`/`lost` → move the squad → scroll and spawn (advance phase only) → move entities → `updateCombat` (Task 6) → `updateContacts` (Task 7) → `updateBoss` (Task 8) → despawn entities with `z < DESPAWN_Z` → `time += dt`. Tasks 6–8 add their calls. In this task, leave them as no-ops imported from their modules.
- Movement: target = `clamp(input.targetX, −(1 − hw), 1 − hw)` where `hw = formationHalfWidth(formationSlots(count))`. Critically damped spring: `vx += (ω²(target − x) − 2ω·vx)·dt; x += vx·dt` with ω = `SQUAD_OMEGA`, then clamp `x` to the same range.
- Scrolling: `distance += speed × dt`. A spawn becomes an entity when `spawn.z − distance ≤ SPAWN_HORIZON`, placed at `z = spawn.z − distance`. Every entity's `z −= speed × dt`, and enemies/heavies also move by their own `ENEMY_SPEED`/`HEAVY_SPEED`. In the boss phase, scrolling stops but enemies keep walking.
- Phase: when `distance ≥ level.length`, the phase becomes `boss` (Task 8 spawns the boss).

- [ ] **Step 1: Write failing tests:**
  - `createState` sets `squad.count = startSquad`, `peak = startSquad`, `phase 'advance'`, `x 0`.
  - After 2 s of 1/60 steps with targetX 0.5, `squad.x` is within 0.01 of 0.5 and never overshoots beyond 0.5 + 0.01.
  - With targetX 5 (and −5), `squad.x` stays ≤ `1 − formationHalfWidth` (≥ the negative bound).
  - A spawn at z 100 with speed 10: no entity at t = 3.9 s, and one entity after 4.1 s with z within 0.5 of 59.
  - An enemy entity moves faster than a cage (it closes `speed + 1.5` m/s).
  - After `length/speed` seconds the phase is `boss` and `distance` stops increasing.
  - Entities past `DESPAWN_Z` are removed.
  - `step` in a `lost` state changes nothing (deep-equal before and after).
- [ ] **Step 2: Run** `npx vitest run tests/squad/sim/step.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `state.ts` and `step.ts`. Entity `halfW` comes from `SIZES`, or `width/2` for gates and hazards.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(sim): state, squad movement, scrolling, spawning`.

---

### Task 6: Firing and bullet hits

**Files:**
- Create: `games/squad/sim/combat.ts`
- Modify: `games/squad/sim/step.ts` (call `updateCombat`)
- Test: `tests/squad/sim/combat.test.ts`

**Interfaces:**
- Consumes: Task 5 types; `formationSlots`; constants.
- Produces: `export function updateCombat(state: GameState, dt: number): void`, and `export function hitTest(b: { x: number; zFrom: number; zTo: number }, e: { x: number; z: number; halfW: number; halfD: number }): boolean`.
- Firing: the desired rate is `count / FIRE_INTERVAL`. The actual bullet rate is `min(desired, MAX_BULLETS_PER_SEC)`, and each bullet's `damage = desired / actual` (≥ 1). Accumulate `fireAcc += actualRate × dt`. Each whole unit fires one bullet from slot `shotIndex % slots.length` at `(squad.x + dx, dz)`, then `shotIndex++`. Each bullet emits `shot`.
- Bullets move `BULLET_SPEED × dt` and are removed beyond `BULLET_RANGE`. Hits use the **swept** z interval `[zFrom, zTo]` against `[e.z − halfD, e.z + halfD]`, with `|b.x − e.x| ≤ halfW`. A bullet hits the first (lowest-z) shootable entity it overlaps, then is removed.
- Effects on hit (emit `hit`, set `flash = 0.1`):
  - enemy/heavy: `hp −= damage`. At ≤ 0, remove it and emit `destroyed`.
  - cage: `hp −= damage`. At ≤ 0, remove it, emit `destroyed`, and call `changeCount(state, +value, x, z)` (from Task 7). For this task, import it from `contact.ts`, created here with just `changeCount`.
  - gate: `value += round(damage)`.
  - Hazards are not shootable, so bullets pass through them.
  - Boss hits are added in Task 8.
- `flash` decays by `dt` each step.
- `changeCount(state, delta, x, z): void` in `contact.ts`: `count = max(0, count + delta)`, `peak = max(peak, count)`. Emit `gain`/`lose` with `|applied delta|`. If count reaches 0 and the phase isn't `lost`, set the phase to `lost` and emit `lost` once.

- [ ] **Step 1: Write failing tests:**
  - `hitTest` catches a bullet that jumps over a 0.6 m-deep gate in one step (zFrom 9, zTo 11, gate at z 10, halfD 0.3).
  - A squad of 10 fires 25 ± 1 bullets in 1 s.
  - A squad of 3000 fires ≤ 376 bullets in 1 s, and the summed `damage` of those bullets is within 2% of 7500.
  - A cage with hp 3 and value 4 directly ahead breaks, and the count goes from 1 to 5 with a `gain` event of amount 4.
  - A gate at −5 hit 3 times has value −2.
  - A bullet passes through a hazard and hits the enemy behind it.
  - A bullet stops at the first entity: of two enemies in line, only the nearer one loses hp.
- [ ] **Step 2: Run** `npx vitest run tests/squad/sim/combat.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `combat.ts` and the `changeCount` part of `contact.ts`, and wire them into `step`.
- [ ] **Step 4: Run** `npm test`. Expected: all PASS.
- [ ] **Step 5: Commit** `feat(sim): auto-fire, bullets, hits, capped bullet rate`.

---

### Task 7: Contacts — enemies, gates and hazards

**Files:**
- Modify: `games/squad/sim/contact.ts` (add `updateContacts`), `games/squad/sim/step.ts`
- Test: `tests/squad/sim/contact.test.ts`

**Interfaces:**
- Produces: `export function updateContacts(state: GameState): void`.
- Rules (`hw = formationHalfWidth(slots)`, `slots = formationSlots(count)`):
  - **enemy/heavy:** when `e.z − e.halfD ≤ 0` and `|e.x − squad.x| ≤ hw + e.halfW`, call `changeCount(−e.kills)` and remove the entity. Enemies outside that x range walk past harmlessly.
  - **gate:** when `e.z ≤ 0` and not yet resolved, set `resolved = true`. If `|squad.x − e.x| ≤ e.halfW`, apply `changeCount(+e.value)` and remove the gate. Otherwise it scrolls on.
  - **hazard:** when `e.z ≤ 0` and not yet resolved, set `resolved = true`. Let `hit` be the number of slots with `|squad.x + dx − e.x| ≤ e.halfW`. If `hit > 0`, apply `changeCount(−ceil(hit × count / slots.length))`. The hazard then scrolls on and despawns.
  - Contacts stop being processed as soon as the phase becomes `lost`.

- [ ] **Step 1: Write failing tests:**
  - An enemy reaching a 5-man squad head-on leaves 4. A heavy with kills 3 leaves 2.
  - An enemy at x 0.9 passing a squad at x −0.5 leaves the count unchanged.
  - Passing through a gate with value +6 takes 1 to 7. Passing beside it leaves the count unchanged.
  - A 0.2-wide hazard at the squad centre with count 11 (one row, slots spaced 0.07 apart) removes the slots within ±0.1, i.e. 3, so the count becomes 8.
  - **Review Focus 3:** a squad of 3 meets a −10 gate *and* an enemy in the same step: the count is 0, the phase is `lost`, and the events contain exactly one `lost`.
- [ ] **Step 2: Run** `npx vitest run tests/squad/sim/contact.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** and wire into `step`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(sim): enemy contact, gates, hazards`.

---

### Task 8: Boss phase, winning and stars

**Files:**
- Create: `games/squad/sim/boss.ts`, `games/squad/sim/stars.ts`
- Modify: `games/squad/sim/combat.ts` (bullets hit the boss), `games/squad/sim/step.ts`
- Test: `tests/squad/sim/boss.test.ts`, `tests/squad/sim/stars.test.ts`

**Interfaces:**
- Produces: `export function updateBoss(state: GameState, dt: number): void`; `export function starsFor(level: Level, won: boolean, finalCount: number): 0 | 1 | 2 | 3`.
- Boss: on entering the `boss` phase, create the boss at `z = BOSS_ENTRY_Z`, `x 0`, `hp = maxHp = level.boss.hp`, `fireTimer = fireEvery`, and emit `bossArrive`. It moves toward `BOSS_Z` at `BOSS_ENTRY_SPEED` and fires only once it arrives.
- Firing: every `fireEvery` seconds, for each offset in `PATTERNS[pattern]`, add a projectile at `x = clamp(squad.x + offset + jitter, −1, 1)`, `z = boss.z`, with jitter uniform in ±`BOSS_AIM_JITTER` from `nextFloat(rngState)`. Emit `bossFire`.
- Projectiles move toward the squad at `PROJECTILE_SPEED`. When `z ≤ 0`, count the slots with `|squad.x + dx − p.x| ≤ PROJECTILE_RADIUS`. If any, apply `changeCount(−ceil(hit × count / slots.length))`. The projectile is then removed either way.
- Bullets hit the boss with `hitTest` against `{x, z, halfW: BOSS_HALF_W, halfD: BOSS_HALF_D}`. Each hit does `hp −= damage`, sets `flash`, and emits `hit` with target `'boss'`. At ≤ 0 HP: emit `bossDead` and `won`, set the phase to `won`, and clear the projectiles.
- Stars: 0 if not won. Otherwise `1 + (count ≥ stars[0]) + (count ≥ stars[1])`.

- [ ] **Step 1: Write failing tests:**
  - After the advance phase ends, the boss exists and reaches z 18 after 4 s (20 m at 5 m/s).
  - A `volley3` boss fires 3 projectiles per volley, and the same seed gives identical projectile x values.
  - A projectile landing on the centre of an 11-man single row removes `ceil(hits × 11/11)` soldiers, where hits = the number of slots within ±0.12, i.e. 3 at 0.07 spacing.
  - A boss with hp 10 under a 10-man squad dies, with the phase `won`, events containing `won` once, and later steps doing nothing.
  - `starsFor` with stars [15, 30]: (false, 99) → 0, (true, 1) → 1, (true, 15) → 2, (true, 30) → 3.
- [ ] **Step 2: Run** `npx vitest run tests/squad/sim/boss.test.ts tests/squad/sim/stars.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** and wire `updateBoss` into `step`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(sim): boss phase, win condition, stars`.

---

### Task 9: Bot, ten levels and winnability tests

**Files:**
- Create: `games/squad/sim/bot.ts`, `games/squad/levels/01.json` … `10.json`, `games/squad/levels/index.ts`
- Test: `tests/squad/levels.test.ts`

**Interfaces:**
- Produces:
  - `export function botInput(state: GameState): Input`
  - `export function runLevel(level: Level, seed: number, policy: (s: GameState) => Input, maxSeconds = 300): GameState` (in `bot.ts`, stepping at 1/60)
  - `levels/index.ts`: `export const levels: { file: string; level: Level | null; error: string | null }[]`, built from `import.meta.glob('./*.json', { eager: true, import: 'default' })` through `validateLevel`, sorted by file name. Invalid files are captured as `error`, never thrown.
- Bot policy, in priority order:
  1. A hazard or a gate with value < 0 within z ∈ (0, 8] overlapping the squad span → steer to the closest x clear of it (± its halfW + squad half-width + 0.05), on whichever side has room.
  2. An enemy/heavy within z < 25 → steer to its x.
  3. A cage, or a gate with value ≤ 0, within z < 40 → steer to its x. A gate with value > 0 within z < 10 → steer to its x so it walks through.
  4. Boss present → steer to `boss.x`. Otherwise steer to 0.
- Level arc (each file is valid per Task 3):
  - 01 "First Steps": cages and a few weak enemies, no gates or hazards.
  - 02: introduces gates.
  - 03: introduces hazards.
  - 04: introduces heavies.
  - 05–09: mixes these with rising density, more angled placements (alternating x), and boss HP ramping roughly 300 → 3000.
  - 10: the hardest.
  - Lengths run from 300 to 600 m, at speeds of 6–10.
  - Star thresholds are set to about 60% and 90% of the bot's final count.

- [ ] **Step 1: Write failing tests** in `tests/squad/levels.test.ts`. Load the JSON with `fs` + `validateLevel`, since there is no Vite glob in tests:
  - All 10 files validate.
  - For each level and seeds `[1, 2, 3]`: `runLevel(level, seed, botInput).phase === 'won'`.
  - For levels 3–10, the idle policy `() => ({ targetX: 0 })` does **not** win with seed 1. This protects the spec's "no watching it play itself" goal.
  - For each level, the bot's final count is ≥ `stars[0]`, so 2 stars are achievable.
- [ ] **Step 2: Run** `npx vitest run tests/squad/levels.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `bot.ts` and `levels/index.ts`, and write the 10 levels.
- [ ] **Step 4: Tune** the level JSON (never sim constants) until `npx vitest run tests/squad/levels.test.ts` passes. Record each level's bot final count in the commit message body.
- [ ] **Step 5: Commit** `feat(squad): bot, ten levels, winnability tests`.

---

### Task 10: Engine runtime — loop, input, scenes, storage, tween, particles, audio

**Files:**
- Create: `engine/loop.ts`, `engine/input.ts`, `engine/scenes.ts`, `engine/storage.ts`, `engine/tween.ts`, `engine/particles.ts`, `engine/audio.ts`
- Test: `tests/engine/{loop,input,scenes,storage,tween,particles}.test.ts`

**Interfaces:**
- Produces:
```ts
// loop.ts
export const STEP = 1 / 60, MAX_FRAME = 0.25;
export function advance(acc: number, frameDt: number): { steps: number; acc: number; alpha: number } // pure
export function startLoop(update: (dt: number) => void, render: (alpha: number) => void): () => void // rAF; returns stop
// input.ts
export interface Letterbox { offsetX: number; offsetY: number; scale: number } // CSS px → logical px
export function fitLetterbox(winW: number, winH: number, logicalW: number, logicalH: number): Letterbox
export function toLogical(lb: Letterbox, clientX: number, clientY: number): { x: number; y: number }
export class Input { constructor(canvas: HTMLCanvasElement, getLetterbox: () => Letterbox); pointerX: number | null; pointerY: number | null; isDown(key: string): boolean; consumeClick(): { x: number; y: number } | null; consumeKey(key: string): boolean }
// scenes.ts
export interface Scene { enter?(): void; exit?(): void; update(dt: number): void; render(ctx: CanvasRenderingContext2D, alpha: number): void }
export class SceneStack { push(s: Scene): void; pop(): void; replace(s: Scene): void; get top(): Scene | undefined }
// storage.ts
export interface Backend { getItem(k: string): string | null; setItem(k: string, v: string): void }
export function createStorage(ns: string, backend?: Backend | null): { get<T>(key: string, fallback: T): T; set(key: string, value: unknown): void }
// tween.ts
export const ease: Record<'linear' | 'outCubic' | 'outBack' | 'inOutQuad', (t: number) => number>
export function tweenValue(from: number, to: number, t: number, e?: (t: number) => number): number // t clamped to [0,1]
// particles.ts
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number; spin: number }
export class ParticlePool { constructor(capacity: number); emit(p: Omit<Particle, 'maxLife'>): void; update(dt: number, gravity: number): void; forEach(fn: (p: Particle) => void): void; get count(): number }
// audio.ts
export type Sfx = 'shot' | 'hit' | 'gain' | 'lose' | 'win' | 'fail' | 'boss';
export class GameAudio { unlock(): void; play(s: Sfx): void; muted: boolean } // not `Audio`, which would shadow the DOM global
```
- Notes:
  - `createStorage` uses `window.localStorage` when `backend` is undefined. It falls back to an in-memory map if the backend is null, if any access throws, or if JSON parsing fails (returning `fallback`).
  - `ParticlePool` overwrites the oldest particle when full, and does no allocation per frame after construction.
  - `GameAudio` synthesizes each SFX with an oscillator and gain envelope (no audio files), throttles `shot` to at most one per 50 ms, and does nothing before `unlock()`.
  - `Input` listens to `pointermove`/`pointerdown`/`keydown`/`keyup` on the window, and calls `preventDefault` on arrow keys.

- [ ] **Step 1: Write failing tests:**
  - **Review Focus 2:** `advance(0, 10)` → `steps === 15`. `advance(0, 1/60)` → `steps === 1`. `alpha` is in [0, 1).
  - **Review Focus 5:** `fitLetterbox(1920, 1080, 540, 960)` → scale 1.125, offsetX ≈ 656.25, offsetY 0. `toLogical` of the window centre → (270, 480). After refitting for 800 × 2000, `toLogical` of the centre is still (270, 480).
  - `SceneStack`: `replace` calls the old scene's `exit` and the new one's `enter`. `top` reflects the latest push.
  - Storage: round-trips values. A backend whose `getItem` throws → returns the fallback, and `set` doesn't throw. A stored `"{bad json"` → returns the fallback. A null backend works from memory.
  - Tween: `tweenValue(0, 10, 0.5)` → 5. `t` values outside [0, 1] clamp. `ease.outBack(1)` → 1.
  - Particles: a capacity-3 pool with 5 emits has count 3. After `update` past `life`, the count is 0.
- [ ] **Step 2: Run** `npx vitest run tests/engine`. Expected: FAIL.
- [ ] **Step 3: Implement** all seven modules. `audio.ts` and the DOM parts of `input.ts`/`loop.ts` are verified manually in Task 13.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(engine): loop, input, scenes, storage, tween, particles, audio`.

---

### Task 11: Assets, manifest and check-assets

**Files:**
- Create: `engine/assets.ts`, `games/squad/assets/manifest.json`, `scripts/check-assets.ts`
- Modify: `.github/workflows/ci.yml` (remove the `hashFiles` guard)
- Test: `tests/engine/assets.test.ts`, `tests/scripts/check-assets.test.ts` (with fixture dirs under `tests/fixtures/assets/`)

**Interfaces:**
- Produces:
```ts
export type Group = 'player' | 'enemy' | 'bonus' | 'hazard' | 'scenery' | 'effect';
export interface AssetEntry { id: string; file: string | null; frameW: number; frameH: number; frames: number; fps: number; anchor: 'bottom' | 'center'; group: Group }
export interface Manifest { version: 1; entries: AssetEntry[] }
export const GROUP_COLORS: Record<Group, string> // player #2F7DE1, enemy #E04040, bonus #F5C242, hazard #FF8A1F, scenery #4E9F3D, effect #FFFFFF
export function parseManifest(raw: unknown): Manifest // throws Error naming the bad entry index/field
export class AssetStore { static load(manifest: Manifest, baseUrl: string): Promise<AssetStore>; entry(id: string): AssetEntry | undefined; image(id: string): HTMLImageElement | null }
export function frameAt(entry: AssetEntry, time: number): number // floor(time × fps) % frames
export function drawSprite(ctx: CanvasRenderingContext2D, store: AssetStore, id: string, time: number, sx: number, sy: number, scale: number, opts?: { stretchX?: number; flash?: number }): void
// scripts/check-assets.ts
export function checkAssets(dir: string): string[] // problems; empty = OK. CLI: prints problems, exit 1 if any
```
- `drawSprite`:
  - Draw size = `(frameW / 2) × scale × stretchX` by `(frameH / 2) × scale`, because art is 2×.
  - `anchor 'bottom'` means `(sx, sy)` is the bottom centre.
  - Missing image → fill a rounded rect in `GROUP_COLORS[group]` with a dark outline, plus the `id` in 10 px text if the drawn height is ≥ 20 px.
  - Unknown id → draw a magenta box and `console.warn` once per id.
  - `flash > 0` → overlay white at alpha `min(1, flash × 10)`.
- `AssetStore.load` loads each non-null file. On a failed load, it warns once and treats the asset as missing. It never rejects.
- `checkAssets`:
  - The manifest parses.
  - Every non-null `file` exists.
  - PNG size is read from IHDR (width = bytes 16–19, height = bytes 20–23, big-endian). SVG size is read from the root `width`/`height` attributes. It must equal `frameW × frames` × `frameH`.
  - Files in the dir other than `manifest.json` that aren't referenced → problem `"unlisted file: x.png"`.
- `manifest.json` starting entries (all `file: null`):
  - `soldier_run` 64×80 ×4 @10 fps bottom player
  - `soldier_shoot` 64×80 ×2 @12 player
  - `enemy_walk` 64×80 ×4 @8 enemy
  - `heavy_walk` 96×112 ×4 @6 enemy
  - `boss_idle` 320×256 ×2 @3 enemy
  - `boss_damaged` 320×256 ×2 @3 enemy
  - `cage` 96×112 ×1 bonus
  - `cage_broken` 96×112 ×1 bonus
  - `gate_positive` 256×96 ×1 bonus
  - `gate_negative` 256×96 ×1 bonus
  - `hazard_blade` 128×128 ×4 @12 hazard
  - `hazard_fire` 256×64 ×3 @10 hazard
  - `hazard_barricade` 256×96 ×1 hazard
  - `road_tile` 512×256 ×1 scenery
  - `prop_tree` 128×160 ×1 scenery
  - `prop_rock` 128×96 ×1 scenery
  - `prop_crate` 96×96 ×1 scenery
  - `bullet` 16×24 ×1 center effect
  - `muzzle_flash` 32×32 ×2 @20 center effect

- [ ] **Step 1: Write failing tests:**
  - `parseManifest` accepts the real `games/squad/assets/manifest.json`, and rejects a bad entry with a message naming `entries[2].frames`.
  - `frameAt({ fps: 10, frames: 4 } as AssetEntry, 0.35)` → 3, and at 0.45 → 0.
  - `checkAssets` returns `[]` for the real assets dir, which has no files yet.
  - Fixtures:
    - a good PNG (generate a 128×80 PNG fixture once with a tiny script writing a valid IHDR; check it in) → `[]`
    - wrong width → a message containing `"expected 256x80, got 128x80"`
    - a missing file → `"missing file: soldier_run.png"`
    - an extra file → `"unlisted file: extra.png"`
    - an SVG with the right width/height → `[]`
- [ ] **Step 2: Run** `npx vitest run tests/engine/assets.test.ts tests/scripts`. Expected: FAIL.
- [ ] **Step 3: Implement**, then remove the CI guard.
- [ ] **Step 4: Run** `npm test && npm run check-assets`. Expected: PASS, and check-assets prints `assets OK (0 files, 19 entries)`.
- [ ] **Step 5: Commit** `feat(engine): asset manifest, placeholders, check-assets`.

---

### Task 12: Rendering the game

**Files:**
- Create: `games/squad/render/draw.ts`, `games/squad/render/squadView.ts`
- Test: `tests/squad/render.test.ts`

**Interfaces:**
- Consumes: `GameState` (Task 5), `project`/`DEFAULT_VIEW` (Task 2), `AssetStore`/`drawSprite` (Task 11), `formationSlots` (Task 4).
- Produces:
```ts
export class SquadView { update(slots: Slot[], dt: number): void; get positions(): readonly { dx: number; dz: number }[] } // each displayed slot eases toward its target (rate 10/s); added slots start at the squad centre
export interface RenderView { persp: PerspectiveConfig; assets: AssetStore; time: number; squadView: SquadView; shake: { x: number; y: number } }
export function renderGame(ctx: CanvasRenderingContext2D, state: GameState, view: RenderView): void
```
- Draw order:
  1. Sky/grass background.
  2. The road as a trapezoid from z −2 to z 80, with `road_tile` scrolled by `distance mod tileLength`. Tiles are drawn as horizontal strips projected per row band. A placeholder uses alternating grey bands.
  3. Props on both shoulders at fixed z intervals (offset by distance).
  4. All entities, the boss, projectiles and bullets sorted by descending z (far first).
  5. The squad from back rows to front, using `soldier_run`.
  6. The HUD.
- Each sprite's scale = `project(...).scale`.
- Gates use `stretchX = (e.halfW × 2 × roadHalfWidthPx) / (256 / 2)`, with the value as bold text centred on the gate. They're green-tinted for positive values and red for zero or negative ones.
- Cages show `+value` above them, and heavies show a small HP bar.
- HUD:
  - Count badge above the squad front centre ("12").
  - Level progress bar at the top (`distance / length`).
  - Boss HP bar at the top during the boss phase.
  - Level name, top-left.
- Apply `view.shake` as a canvas translate.

- [ ] **Step 1: Write failing test:** use a recording stub ctx, a `Proxy` whose methods are no-ops and whose property writes are accepted. For level 01 with `botInput`, call `renderGame` every 10 steps until the run ends. It must not throw, and the number of `drawImage` + `fillRect` + `fill` calls must be > 0. Also test that `SquadView` positions converge to the targets within 0.01 after 1 s.
- [ ] **Step 2: Run** `npx vitest run tests/squad/render.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(squad): renderer with perspective, placeholders, HUD`.

---

### Task 13: Progress, scenes and boot (first playable)

**Files:**
- Create: `games/squad/progress.ts`, `games/squad/ui.ts`, `games/squad/scenes/{title,levelSelect,play,results,error}.ts`
- Modify: `games/squad/main.ts`
- Test: `tests/squad/progress.test.ts`, `tests/squad/ui.test.ts`

**Interfaces:**
- Produces:
```ts
// progress.ts
export interface Progress { best: Record<number, 0 | 1 | 2 | 3>; muted: boolean }
export function sanitizeProgress(raw: unknown): Progress // anything malformed → { best: {}, muted: false }; drops invalid entries
export function recordResult(p: Progress, levelId: number, stars: 0 | 1 | 2 | 3): Progress // keeps the max, returns a new object
export function isUnlocked(p: Progress, levelId: number): boolean // 1 always; n if best[n-1] >= 1
export function loadProgress(storage: ReturnType<typeof createStorage>): Progress; export function saveProgress(storage, p: Progress): void
// ui.ts
export interface Button { x: number; y: number; w: number; h: number; label: string; enabled: boolean }
export function hitButton(b: Button, px: number, py: number): boolean
export function drawButton(ctx: CanvasRenderingContext2D, b: Button): void
export function drawCenteredText(ctx, text: string, x: number, y: number, size: number, color?: string): void
```
- Scenes, all at 540 × 960 logical size:
  - **Title:** the name "Squad Shooter" and "Click to start". The click calls `audio.unlock()` and replaces the scene with LevelSelect.
  - **LevelSelect:** a 2 × 5 grid of buttons with the level number and stars. Locked levels are greyed out. An invalid level shows "!", and clicking it opens Error.
  - **Play:**
    - Owns the `GameState` (seed = `Date.now()`), a `SquadView` and `renderGame`.
    - Converts the pointer to `targetX` with `unprojectX(DEFAULT_VIEW, pointerX, 0)`, keeping the last value when the pointer is null.
    - Arrow/A–D keys move `targetX` at 1.6 units/s.
    - `Esc` toggles pause, which skips `step` and shows a "Paused" overlay. `M` toggles mute and saves it.
    - When the phase is `won`/`lost`, it waits 1.2 s, then records progress and replaces the scene with Results.
  - **Results:** "Victory!" or "Defeated", the stars (animated with `ease.outBack`), the final count, and buttons for Next (if won and a next level exists), Retry and Menu.
  - **Error:** the message text and a Menu button.
- `main.ts`:
  - Sizes the canvas to the window with `fitLetterbox` and DPR, refitting on `resize`.
  - Creates the `Input`, `GameAudio`, storage (`createStorage('hypercaz.squad')`), `AssetStore.load(parseManifest(manifestJson), new URL('./assets/', import.meta.url).href)` (with `manifest.json` imported directly) and `SceneStack`, then calls `startLoop`.

- [ ] **Step 1: Write failing tests:**
  - **Review Focus 4:** `sanitizeProgress` returns the defaults for each of `null`, `"x"`, `{ best: 5 }` and `{ best: { "1": 9, "x": 2 } }` (the invalid entries are dropped). `{ best: { "1": 2 }, muted: true }` round-trips.
  - `loadProgress` over a backend containing `"{bad"` returns the defaults.
  - `recordResult` keeps 3 when 1 is recorded later.
  - `isUnlocked(defaults, 1)` is true and `isUnlocked(defaults, 2)` is false. After recording 1 star on level 1, level 2 is unlocked.
  - `hitButton` is inclusive at the edges and false just outside them.
- [ ] **Step 2: Run** `npx vitest run tests/squad/progress.test.ts tests/squad/ui.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** progress, ui, the scenes and main.
- [ ] **Step 4: Run** `npm test && npm run build`. Expected: PASS.
- [ ] **Step 5: Manual check** with `npm run dev`:
  - The title appears, and clicking reaches level select.
  - Level 1 plays with placeholder shapes, the squad follows the mouse smoothly, and the count changes on cages and contacts.
  - The boss appears, and a win reaches Results with stars.
  - Retry and Next work. After a reload, level 2 stays unlocked.
  - Resizing the window keeps the mouse mapping correct.
  - Esc pauses and M mutes.
- [ ] **Step 6: Commit** `feat(squad): scenes, progress, first playable`.

---

### Task 14: Juice — effects, pop-ups, shake and sound

**Files:**
- Create: `games/squad/render/effects.ts`
- Modify: `games/squad/scenes/play.ts`, `games/squad/render/draw.ts` (draw particles and pop-ups)
- Test: `tests/squad/effects.test.ts`

**Interfaces:**
- Consumes: `GameEvent` (Task 5), `ParticlePool`, `tweenValue`/`ease`, `GameAudio` (Task 10).
- Produces:
```ts
export interface Popup { text: string; x: number; y: number; age: number; color: string }
export class Effects { constructor(audio: { play(s: Sfx): void }, pool?: ParticlePool); handle(events: readonly GameEvent[], toScreen: (x: number, z: number) => { sx: number; sy: number }): void; update(dt: number): void; draw(ctx: CanvasRenderingContext2D): void; get shake(): { x: number; y: number }; get popups(): readonly Popup[] }
```
- Event mapping:
  - `shot` → sfx `shot` (throttled in GameAudio).
  - `hit` → sfx `hit` and 2 white sparks.
  - `destroyed` → 12 confetti particles in the group colour.
  - `gain` → a green "+N" pop-up and sfx `gain`.
  - `lose` → a red "−N" pop-up, confetti in player blue and sfx `lose`.
  - `bossFire` → nothing visual (projectiles are drawn by the renderer).
  - `hit` on the boss → shake 4 px.
  - `bossDead` → shake 14 px, 60 confetti and sfx `win`.
  - `lost` → sfx `fail`.
- Pop-ups rise 60 px over 0.8 s with `ease.outCubic` and fade out. Shake decays exponentially (×0.85 per 1/60 s) and is randomised in direction each frame.
- The Play scene calls `effects.handle(state.events, …)` after **every** `step`, since events are cleared at the start of each step, and passes `effects.shake` into `RenderView`.

- [ ] **Step 1: Write failing tests** with a fake audio that records calls:
  - A `gain` of 5 creates a pop-up with text "+5" and plays `gain`.
  - A `lose` of 3 creates "−3".
  - `bossDead` makes the shake magnitude ≥ 10, and after 2 s of `update` the magnitude is < 0.5.
  - Pop-ups are removed after 0.8 s.
  - `destroyed` adds 12 particles to the pool.
- [ ] **Step 2: Run** `npx vitest run tests/squad/effects.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** and wire into Play and the renderer.
- [ ] **Step 4: Run** `npm test`. Expected: PASS. Manual check with `npm run dev`: hits flash, confetti pops, numbers float up, the boss shakes the screen, the sounds play, and M mutes them.
- [ ] **Step 5: Commit** `feat(squad): juice — particles, popups, shake, sfx`.

---

### Task 15: Art brief for Codex

**Files:**
- Create: `docs/art-brief.md`

**Interfaces:**
- Consumes: `manifest.json` entries (Task 11) and the spec §4. The brief must match the manifest exactly (ids, sizes, frames).

- [ ] **Step 1: Write `docs/art-brief.md`**, self-contained, with these sections:
  1. **Context:** what the game is, in 3 sentences.
  2. **Your scope:** work only in `games/squad/assets/`, on a branch, and open a PR. Don't touch code. Set each entry's `"file"` in `manifest.json` when you deliver it.
  3. **Style guide:** spec §4.2 verbatim in substance. Palette:
     - outline `#1A1A2E`
     - player blue `#2F7DE1` / shade `#1B4F99` / light `#7FB2F0`
     - enemy red `#E04040` / `#9A2222` / `#F08A8A`
     - bonus gold `#F5C242` / `#B8861B`
     - hazard orange `#FF8A1F` with black `#1A1A1A`
     - road `#6B6F7A`, grass `#6CBF4B`, skin tones free
  4. **Technical rules:** spec §4.3, plus that gates and `hazard_fire`/`hazard_barricade` are **stretched horizontally**, so the middle 60% must be plain and repeatable while the detail goes at the ends. Bullets and muzzle flashes are centre-anchored. The road tile must tile seamlessly in the vertical direction.
  5. **Asset table:** id, file name, frame size, frame count, fps, view (back/front/top), and a one-line description for every manifest entry.
  6. **Content rules:** cartoon only, no blood, nothing sexual. No real-world flags, insignia, brands or trademarked characters.
  7. **Checking your work:** run `npm run check-assets`; `npm run dev` shows the art in-game; missing files fall back to placeholders.
  8. **Delivery order:** soldier_run, enemy_walk, cage, gates, boss, then the rest.
- [ ] **Step 2: Verify** with a script check that every manifest `id` appears in the brief's table: `node -e "const m=require('./games/squad/assets/manifest.json');const b=require('fs').readFileSync('docs/art-brief.md','utf8');const miss=m.entries.filter(e=>!b.includes('\`'+e.id+'\`'));console.log(miss.length?miss.map(e=>e.id):'brief OK')"`. Expected: `brief OK`.
- [ ] **Step 3: Commit** `docs: art brief for Codex`.

---

### Task 16: Deploy workflow, README and hand-off

**Files:**
- Create: `.github/workflows/deploy.yml`, `README.md`

- [ ] **Step 1: `deploy.yml`:** runs on `push` to `main` and `workflow_dispatch`, with permissions `pages: write`, `id-token: write`, `contents: read`.
  - The build job runs `npm ci`, `npm test` and `npm run build`, then `actions/upload-pages-artifact@v3` with `path: dist`.
  - The deploy job uses `actions/deploy-pages@v4` in the `github-pages` environment.
- [ ] **Step 2: `README.md`:** what the project is, `npm run dev` / `test` / `build` / `check-assets`, how levels work (JSON fields, plus the bot test that must pass after tuning), and a pointer to `docs/art-brief.md`.
- [ ] **Step 3: Verify** with `npm run lint && npm test && npm run check-assets && npm run build`, all passing, then `npx vite preview` and play level 1 from `dist/`.
- [ ] **Step 4: Commit** `ci: GitHub Pages deploy; docs: README`.
- [ ] **Step 5: Stop and ask the user** before creating the GitHub repo, pushing `feat/squad-shooter`, opening the PR, or enabling Pages, because these are outward-facing actions. List the three spec refinements from Global Constraints in the hand-off message.
