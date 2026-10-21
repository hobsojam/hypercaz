# Snowman Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fifth hypercaz game at `/merge/`: drop snowballs into a crate, same sizes merge up to snowmen, two size-9 snowmen become a family that walks off; overflow ends the round; best score saved.

**Architecture:** A pure, deterministic sim in `games/merge/sim/` (a fixed-step circle physics engine, plus game rules: drops, merges, chains, family, game over), drawn by `games/merge/render/draw.ts`, driven by Title and Play scenes on the shared `bootGame` in 540×960 letterbox mode, like Stack. The shared `Input` gains a pointer-release signal for drag-and-release on phones.

**Tech Stack:** TypeScript, Canvas 2D, Vite multi-page, Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-21-snowman-merge-design.md`

## Global Constraints

- No new dependencies, no physics library, no art or audio files: canvas shapes and the shared synthesised `GameAudio` only, no music.
- 540×960 logical column, letterboxed (`bootGame` default fit); the garden backdrop fills the whole window via `paintBackdrop`.
- Page `/merge/`, name "Snowman Merge", storage namespace `hypercaz.merge` (keys `best`, `muted`); paths relative to `base: './'`.
- Reuse the shared engine (`bootGame`, `engine/controls.ts`, `engine/ui.ts`, `GameAudio`, `createStorage`, `createRng`/`nextFloat`, `ParticlePool`); extend it rather than copy (SonarCloud: 3% duplication on new code, cognitive complexity ≤ 15 per function).
- Other games must behave exactly as before; the full suite stays green.
- Sim code is pure and deterministic: no `Math.random`, no `Date.now` inside `sim/`.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Three or more same-size balls touching at once** must make exactly one merge per pair, never duplicating or losing a ball — Task 3 test `three touching size-2 balls make one size-3 and leave one size-2`.
2. **A merge inside a packed crate** must not fling neighbours out of the crate or far above it — Task 2 test `a big overlap is pushed apart gently` and Task 3 test `a merge in a packed crate keeps every ball in the crate`.
3. **A long frame** (tab resumed, slow device: dt of seconds) must not freeze the page or explode the pile — Task 3 test `a huge dt is capped`.
4. **Pressing the pause or mute button on a phone** must not drop a ball on release — Task 5 test `a press on the pause button does not drop on release`.
5. **Clicking fast during the cooldown** must not queue extra drops — Task 3 test `drops during the cooldown are ignored, not queued`.

---

### Task 1: Engine: pointer release and the pop sound

**Files:**
- Modify: `engine/input.ts`, `engine/audio.ts`
- Test: `tests/engine/input.test.ts`, `tests/engine/audio.test.ts`

**Interfaces:**
- Produces: `Input.held: boolean` (a primary pointer is down), `Input.consumeRelease(): { x: number; y: number } | null` (logical point of the last primary `pointerup`; cleared by `endFrame()`); `Sfx` gains `'pop'` (a short crunchy pop, played with a pitch multiplier like `perfect`).

- [ ] **Step 1: Write failing tests** in `tests/engine/input.test.ts` (inside the existing `describe('Input')`, using its `setup()`):
  - `it('reports a primary release where it happened')`: pointerdown then pointerup `{button:0, clientX:30, clientY:40}` → `input.held` true between them, false after; `consumeRelease()` → `{x:30,y:40}`, then `null`.
  - `it('ignores non-primary releases and drops releases at end of frame')`: pointerup `{button:2}` → `consumeRelease()` null; a primary pointerup then `endFrame()` → null.
  - `it('a cancelled pointer is no longer held and does not release')`: pointerdown, `pointercancel` → `held` false, `consumeRelease()` null.
  - In `tests/engine/audio.test.ts`: `test('pop plays with a pitch')` — after `unlock()`, `audio.play('pop', 2)` creates at least one oscillator (mirror the existing `perfect` pitch test's assertions on `ctx.frequencies`, expecting the frequencies doubled versus `play('pop')`).
- [ ] **Step 2: Run** `npx vitest run tests/engine/input.test.ts tests/engine/audio.test.ts` — Expected: the new tests FAIL.
- [ ] **Step 3: Implement.** In `Input`: listen for `pointerup` (button 0: `held = false`, record release via `toLogical`) and `pointercancel` (`held = false`); `pointerdown` sets `held = true`; `endFrame()` also clears the release. In `audio.ts`: add `'pop'` to `Sfx` and `VOICES` — e.g. a fast `triangle` 520→260 Hz, 0.07 s, vol 0.14, plus a `square` 1400→700 Hz, 0.03 s, vol 0.03 for crunch.
- [ ] **Step 4: Run** `npx vitest run tests/engine` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(engine): pointer release and a pop sound`.

---

### Task 2: Circle physics

**Files:**
- Create: `games/merge/sim/constants.ts`, `games/merge/sim/physics.ts`
- Test: `tests/merge/physics.test.ts`

**Interfaces:**
- Produces (`constants.ts`), exact values:
  - `WIDTH = 540`, `HEIGHT = 960`
  - `CRATE = { left: 60, right: 480, top: 330, floor: 900 }` (inner edges, logical px)
  - `DANGER_Y = 360`, `DROP_Y = 260` (centre height of the hanging ball)
  - `RADII = [0, 16, 22, 29, 37, 47, 59, 74, 92, 114]` (index = size 1..9)
  - `MAX_SIZE = 9`
  - `STEP = 1 / 120`, `GRAVITY = 1800` (px/s²), `ITERATIONS = 8`, `MAX_PUSH = 3` (px per pair per iteration), `DAMPING = 0.995` (per step), `RESTITUTION = 0.1`
- Produces (`physics.ts`):
  - `interface Ball { id: number; size: number; x: number; y: number; px: number; py: number; age: number; landed: boolean }` — `px/py` are the previous position (Verlet).
  - `makeBall(id: number, size: number, x: number, y: number): Ball` (at rest: `px = x, py = y`, `age = 0`, `landed = false`, radius is `RADII[size]`).
  - `stepPhysics(balls: Ball[]): void` — advance exactly one `STEP` in place, ages `+= STEP`.
  - `speed(b: Ball): number` (px/s from `x - px`, `y - py`).
  - `touching(a: Ball, b: Ball): boolean` — centre distance ≤ `RADII[a.size] + RADII[b.size] + 1`.

Algorithm (position-based Verlet; the tests don't pin it, so use this): for each ball, `v = (x - px) * DAMPING`, `px = x`, `x += v + GRAVITY * STEP²` (y only for gravity). Then `ITERATIONS` passes: for each pair (i < j, by array order) that overlaps, push apart along the centre line by the overlap, shared by mass ∝ r², each ball's move capped at `MAX_PUSH`; then clamp every ball to the walls and floor exactly (`x ∈ [left + r, right - r]`, `y ≤ floor - r`; walls extend upward without limit, there is no lid). After a wall/floor clamp, reflect that velocity component scaled by `RESTITUTION` by adjusting `px`/`py`. Mark `landed` when a ball first touches the floor or another ball. Coincident centres: separate along x (smaller id to the left).

- [ ] **Step 1: Write failing tests** `tests/merge/physics.test.ts`:
  - `test('a ball dropped into an empty crate rests on the floor')`: one size-3 ball at `(270, DROP_Y)`; 3 s of steps → `y` within 0.5 of `CRATE.floor - RADII[3]`, `speed < 1`, `landed` true.
  - `test('a pile settles and stops jittering')`: 40 balls, sizes cycling 1..5, dropped one every 0.25 s at x positions cycling across the crate; run 12 s after the last drop → every `speed(b) < 5`, and positions move < 0.5 px over a further 1 s.
  - `test('balls never leave the crate walls or floor')`: during the pile run above, after every step every ball has `x - r ≥ CRATE.left - 0.01`, `x + r ≤ CRATE.right + 0.01`, `y + r ≤ CRATE.floor + 0.01`.
  - `test('a big overlap is pushed apart gently')`: a size-9 ball placed at the floor overlapping a size-1 by 60 px; after one step neither ball moved more than `MAX_PUSH * ITERATIONS + 2` px; after 2 s the size-1 ball's top is below `CRATE.top - 100` (not launched out) and no overlap > 1 px remains.
  - `test('the same balls give the same result')`: run the pile twice → `JSON.stringify` of balls equal.
- [ ] **Step 2: Run** `npx vitest run tests/merge/physics.test.ts` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `constants.ts` and `physics.ts` as above. Tune `ITERATIONS`/`DAMPING`/`MAX_PUSH` only if the settle test demands it, and ledger any change.
- [ ] **Step 4: Run** the test file — Expected: PASS. Also `npx tsc --noEmit`.
- [ ] **Step 5: Commit** `feat(merge): circle physics for the crate`.

---

### Task 3: Game rules: drops, merges, chains, family, game over

**Files:**
- Create: `games/merge/sim/state.ts`, `games/merge/sim/step.ts`
- Modify: `games/merge/sim/constants.ts` (append rule constants)
- Test: `tests/merge/sim.test.ts`

**Interfaces:**
- Consumes: Task 2's `Ball`, `makeBall`, `stepPhysics`, `touching`, constants.
- Produces (append to `constants.ts`), exact values:
  - `POINTS = [0, 0, 3, 6, 10, 15, 21, 28, 36, 45]` (points for making that size)
  - `FAMILY_POINTS = 500`
  - `DROP_WEIGHTS = [4, 3, 2, 1]` (sizes 1..4)
  - `COOLDOWN = 0.5`, `OVER_TIME = 2`, `SETTLE_AGE = 1` (s), `MAX_FRAME = 0.1` (s of sim per `stepMerge` call)
- Produces (`state.ts`):
  ```ts
  export type MergeEvent =
    | { type: 'drop'; size: number }
    | { type: 'land'; size: number }
    | { type: 'merge'; size: number; x: number; y: number; link: number; points: number }
    | { type: 'family'; x: number; y: number; link: number; points: number }
    | { type: 'over' };
  export interface MergeState {
    balls: Ball[]; nextId: number;
    aimX: number; current: number; next: number; // sizes 1..4
    cooldown: number; chain: number; score: number;
    danger: number; // seconds settled snow has been above DANGER_Y
    phase: 'play' | 'over';
    events: MergeEvent[]; // this call's events; cleared at the start of each stepMerge
    rng: number; carry: number; // leftover sim time below one STEP
  }
  export function createMerge(seed: number): MergeState; // aimX = WIDTH / 2, current/next rolled
  export function clampAim(x: number, size: number): number; // into [CRATE.left + r, CRATE.right - r]
  export function overLine(state: MergeState): boolean; // any ball with age ≥ SETTLE_AGE whose top (y - r) < DANGER_Y
  ```
- Produces (`step.ts`): `stepMerge(state: MergeState, input: { aimX: number | null; drop: boolean }, dt: number): void`.

Rules (`stepMerge`): clear `events`; if `phase === 'over'` return. `aimX` updates from input when not null, always clamped for `current`. If `drop && cooldown <= 0`: add `makeBall(nextId++, current, aimX, DROP_Y)`, push `drop`, `current = next`, roll `next` (weighted by `DROP_WEIGHTS` via `nextFloat`), `cooldown = COOLDOWN`, `chain = 0`. Then add `min(dt, MAX_FRAME)` to `carry` and run whole `STEP`s: `stepPhysics`, emit `land` for balls that just became `landed`, then merges — collect touching same-size pairs sorted by `(min id, max id)`, take each pair only if neither ball was used this step; for each: `chain++`, remove both; if size < 9, add one ball of `size + 1` at the midpoint with the average velocity and `age = max` of the two, `landed = true`, and push `merge` with `link = chain`, `points = POINTS[size + 1] * chain`; if size 9, push `family` with `points = FAMILY_POINTS * chain`; add points to `score`. Then `cooldown -= STEP` (floor 0); `danger = overLine ? danger + STEP : 0`; when `danger ≥ OVER_TIME`: `phase = 'over'`, push `over`, stop stepping.

- [ ] **Step 1: Write failing tests** `tests/merge/sim.test.ts` (helper: `run(state, seconds, input?)` stepping at 1/60):
  - `test('createMerge rolls drops from sizes 1-4, the same for the same seed')`: 1000 rolls via repeated drops-with-cooldown-skipped (set `state.cooldown = 0` between) → every `current` in 1..4, size 1 most common and size 4 least; two states from seed 5 give equal drop sequences.
  - `test('a drop adds the current ball at the aim and shows the next')`: `stepMerge(s, {aimX: 200, drop: true}, 1/60)` → one ball, size = old `current`, `x === 200`, `s.current === old next`, a `drop` event.
  - `test('aim is clamped to the crate')`: aimX −1000 → `CRATE.left + RADII[current]`; 5000 → `CRATE.right - r`.
  - `test('drops during the cooldown are ignored, not queued')`: drop, then 10 drops within 0.4 s → 1 ball; then 0.2 s with no drop input → still 1 ball.
  - `test('two touching same-size balls become one of the next size where they met')`: two size-2 balls at rest on the floor, touching, at x 200 and 244 → after one call: one size-3 ball with x within 2 of 222, `merge` event with `link 1`, `points POINTS[3]`, score 6.
  - `test('different sizes never merge')`: size 2 touching size 3 → 2 balls after 2 s.
  - `test('three touching size-2 balls make one size-3 and leave one size-2')`: three in a row touching → after one step: exactly one size-3 and one size-2, ball count 2.
  - `test('a chain multiplies its points')`: arrange a size-2 pair touching a resting size-3 so the merge's size-3 touches it → events `merge` link 1 then link 2, the second's points `POINTS[4] * 2`.
  - `test('a new drop starts a new chain')`: after a merge, drop → `chain === 0`.
  - `test('two size-9 snowmen make a family that leaves the crate')`: two size-9 balls touching → `family` event, `points FAMILY_POINTS`, no balls left.
  - `test('a merge in a packed crate keeps every ball in the crate')`: fill with 30 size-3 balls, settle, then place two size-6 balls touching at the floor among them → after the merge, at every step for 3 s, every ball is within the walls and floor and has `y - r > CRATE.top - 150` (nothing launched high).
  - `test('settled snow over the line for 2 s ends the round')`: a ball pinned above `DANGER_Y` (set its `age` ≥ 1 and re-set its position each frame before stepping, or stack the crate full) → `phase` stays `play` at 1.9 s, becomes `over` with an `over` event by 2.1 s; further `stepMerge` calls change nothing.
  - `test('a fresh drop or a brief flight over the line does not end the round')`: a ball with `age 0.5` above the line for 3 s of sim (re-pinned) → still `play`; a settled ball above the line for 1 s then below → `danger` back to 0.
  - `test('a huge dt is capped')`: `stepMerge(s, input, 5)` advances at most `MAX_FRAME` (a dropped ball falls no further than one 0.1 s fall would take it) and returns quickly.
- [ ] **Step 2: Run** `npx vitest run tests/merge/sim.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `state.ts` and `step.ts` per the rules; split helpers to keep each function's cognitive complexity ≤ 15.
- [ ] **Step 4: Run** `npx vitest run tests/merge` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(merge): drops, merges, chains, family and game over`.

---

### Task 4: Drawing: garden, crate, snowballs, snowmen, family

**Files:**
- Create: `games/merge/render/draw.ts`
- Test: `tests/merge/render.test.ts`

**Interfaces:**
- Consumes: `MergeState`, `Ball`, constants.
- Produces:
  - `interface PieceLook { face: boolean; nose: boolean; scarf: boolean; hat: boolean; earmuffs: boolean; accent: string | null }`
  - `pieceLook(size: number): PieceLook` — sizes 1–4: all false, `accent null`; 5: face; 6: +nose; 7: +scarf; 8: +hat; 9: +earmuffs (and mittens drawn with them). Each of sizes 5–9 has a distinct `accent` colour (used for the scarf/hat/earmuffs and a ring on size 5–6).
  - `drawBackdrop(ctx, x: number, y: number, w: number, h: number, time: number): void` — dusk garden over the given rect (logical coords): sky gradient, snowy ground, a fence, a few trees, slow falling snow driven by `time` (deterministic positions, no randomness).
  - `drawPiece(ctx, size: number, x: number, y: number, time: number): void` — sizes 1–4 plain snow with their marks (1 snowflake, 2 plain, 3 packed texture, 4 sparkles); 5–9 per `pieceLook`.
  - `drawFamily(ctx, x: number, y: number, t: number): void` — three snowmen (two big, one small) side by side, waving; `t` (seconds) animates the wave and a walking bob.
  - `renderMerge(ctx, state: MergeState, view: { time: number; best: number; families: { x: number; y: number; t: number }[] }): void` — in order: crate back, balls (`drawPiece` each), crate front, the danger line (dashed; flashing red when `overLine(state)`), the hanging ball at `(state.aimX, DROP_Y)` with a faint guide line down to the floor (only while `phase === 'play'`, faded while `cooldown > 0`), families, then HUD: score large at top centre, `Best: N` under it, the next ball's preview with "Next" to the right (x ≈ 440, y ≈ 110).
- [ ] **Step 1: Write failing tests** `tests/merge/render.test.ts` with `stubCtx` from `tests/squad/stubCtx.ts`:
  - `test('snowmen gain one feature per size and each has its own colour')`: sizes 1–4 have no features; for 5..9 the count of true features is non-decreasing and strictly increases from 5 to 9; the five accents are distinct.
  - `test('draws every size and the family without throwing')`: `drawPiece` for 1..9 and `drawFamily` at t 0 and 1.
  - `test('draws the score, the best and the next preview')`: a state with `score 123`, `next 3`, best 456 → `fillText` calls include `'123'`, `'Best: 456'`, `'Next'`.
  - `test('the danger line flashes red when snow is over it')`: compare `strokeStyle` set while drawing the line for a state where `overLine` is false vs true at `time` 0 (red-ish `#FF…` when true).
  - `test('no hanging ball once the round is over')`: with `phase 'over'`, `drawPiece` is not called for the hanging ball — assert fewer `arc` calls than the same state in `play`.
- [ ] **Step 2: Run** `npx vitest run tests/merge/render.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** Palette: snow `#F4F8FF` with a soft blue shade `#C9D8F0`; coal `#2A2A33`; carrot `#F28C28`; accents e.g. `#E04848`, `#2F7DE1`, `#3CC85A`, `#9B5DE5`, `#F5C242`. Wood crate `#8B5A2B` with darker plank lines. Dusk sky `#1E2A4A` → `#5A6FA0`. Keep each draw function short (Sonar complexity).
- [ ] **Step 4: Run** `npx vitest run tests/merge` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(merge): draw the garden, crate, snowmen and family`.

---

### Task 5: Scenes and the page

**Files:**
- Create: `games/merge/game.ts`, `games/merge/controls.ts`, `games/merge/scenes/title.ts`, `games/merge/scenes/play.ts`, `games/merge/main.ts`, `merge/index.html`
- Modify: `vite.config.ts` (add `merge` input)
- Test: `tests/merge/play.test.ts`

**Interfaces:**
- Consumes: Task 1's `Input.held`, `Input.consumeRelease()`, `'pop'`; Task 3's `createMerge`, `stepMerge`, `MergeState`, `MergeEvent`; Task 4's `renderMerge`, `drawBackdrop`, `drawFamily`.
- Produces:
  - `game.ts`: `MERGE_STORAGE = 'hypercaz.merge'`; `interface MergeGame { stack; input; audio; storage; time: number }` (time drives the backdrop snow); `loadBest(storage): number` (same rules as Stack's: finite positive number floored, else 0). This file must not import scene or render code (the picker imports it).
  - `controls.ts`: `takeClick(game: MergeGame)` wrapping the engine's, saving `muted` — mirror `games/stack/controls.ts`.
  - `scenes/title.ts`: `TitleScene` like Stack's: backdrop + empty crate + a size-7 snowman for show, "SNOWMAN MERGE", `Best: N`, "Click, press Space or tap to start", All games and mute buttons.
  - `scenes/play.ts`: `PlayScene`, plus exported `popPitch(link: number): number` = `2 ** (Math.min(link - 1, 12) / 12)`.

Play scene behaviour:
- **Aim:** while playing and not paused, `aimX` comes from `input.pointerX` when it changed since last frame (mouse hover or a held drag); Left/Right arrows (`isDown`) move the aim 420 px/s; otherwise `null` (keep).
- **Drop:** a press that is not on pause/mute/All games arms a drop; the matching `consumeRelease()` drops (works for mouse click and phone drag-and-release alike). Space drops directly. A press on a button never drops.
- **Events:** `land` → `audio.play('place')`; `merge` → `audio.play('pop', popPitch(link))`, a puff of 8–14 white particles at the merge point (`ParticlePool`), and a floating `+points` text for 0.8 s; `family` → `audio.play('win')`, a walker `{x, y, t: 0}` that waves for 1 s then walks toward the nearer side and off screen (removed after 4 s); `over` → `audio.play('lose')`, save best if beaten.
- **Pause:** pause button or Esc; `suspend()` pauses while playing; click resumes, as in Stack.
- **Game over:** dim overlay, "Game over", `Score: N`, `Best: N` (`New best!` when beaten), "Click, press Space or tap to play again" after a 0.6 s delay, All games button → `navigate('../')`.
- **Seeds:** each new `PlayScene` uses `createMerge(Date.now() >>> 0)`; tests can set the state.
- `main.ts`: like `games/stack/main.ts` — `createStorage(MERGE_STORAGE)`, muted from storage, `firstScene: TitleScene`, `paintBackdrop` calls `drawBackdrop` over the whole window (same expression as Stack's sky).
- `merge/index.html`: copy of `stack/index.html` with title and `apple-mobile-web-app-title` "Snowman Merge", script `../games/merge/main.ts`, theme colour `#1E2A4A`.

- [ ] **Step 1: Write failing tests** `tests/merge/play.test.ts` with a stub game like `tests/stack/play.test.ts`'s `stubStack`, extended with `held`, `consumeRelease`, `pointerX` and a `release(x, y)` helper:
  - `test('a click (press and release) in the play area drops a ball at the pointer')`: pointerX 200, press at (200, 500), release at (200, 500), update → one ball, `x` = 200 (clamped).
  - `test('Space drops at the current aim')`.
  - `test('a press on the pause button does not drop on release')`: press at `PAUSE_BUTTON` centre, release there → 0 balls and paused.
  - `test('merges pop with a rising pitch and families play the fanfare')`: inject events by placing touching balls in the state → sounds `pop` with `popPitch(1) === 1` then `popPitch(2) > 1`; two size-9 → `win`.
  - `test('game over saves a new best, and only a better one')`: set `score` 50 and force `over` (pin a settled ball over the line) → storage `best` 50; a later round ending at 20 leaves 50.
  - `test('loadBest copes with junk and missing storage')`: `'abc'`, `-3`, `NaN`, null backend → 0; `12.7` → 12.
  - `test('after game over, play again starts a fresh round')`: past 0.6 s, a click → `scenes` gets a new `PlayScene`.
  - `test('hiding the tab pauses the round')`: `suspend()` → paused; update with drops does nothing.
- [ ] **Step 2: Run** `npx vitest run tests/merge/play.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the files above and add `merge: resolve(import.meta.dirname, 'merge/index.html')` to `vite.config.ts`.
- [ ] **Step 4: Run** `npx vitest run tests/merge && npx tsc --noEmit && npm run lint` — Expected: PASS, clean.
- [ ] **Step 5: Commit** `feat(merge): title and play scenes, and the /merge/ page`.

---

### Task 6: Picker tile, offline, README, browser check

**Files:**
- Modify: `games/picker/tiles.ts`, `games/picker/main.ts`, `index.html`, `scripts/pwa.ts`, `README.md`
- Test: `tests/picker/tiles.test.ts`, `tests/scripts/pwa.test.ts`

**Interfaces:**
- Consumes: Task 5's `MERGE_STORAGE`, `loadBest`.
- Produces: `mergeTile(storage): Tile & { name: 'Snowman Merge'; href: 'merge/' }` — progress `Best: N` (via `loadBest`) or `New` when none; `MERGE_STORAGE` re-exported from `tiles.ts` like `SORT_STORAGE`.

- [ ] **Step 1: Write failing tests:**
  - `tests/picker/tiles.test.ts`: `describe('mergeTile')` — empty storage → `{ name: 'Snowman Merge', href: 'merge/', progress: 'New' }`; `best 1234` → `'Best: 1234'`; junk `'x'` → `'New'`; `MERGE_STORAGE === 'hypercaz.merge'`.
  - `tests/scripts/pwa.test.ts`: the precache list contains `'merge/'` (extend the existing expected list and the `arrayContaining` check).
- [ ] **Step 2: Run** `npx vitest run tests/picker tests/scripts` — Expected: FAIL.
- [ ] **Step 3: Implement:** `mergeTile` in `tiles.ts`; `games/picker/main.ts` refreshes it; `index.html` gets a fifth tile `<a class="tile" href="merge/">` with an inline SVG (dusk-blue background, a brown crate, two snowballs and a snowman with a red scarf and top hat) and `<h2>Snowman Merge</h2>`; `precacheList` adds `'merge/'`; README gets a `### Snowman Merge` section (how to play, controls: mouse/touch/keyboard, sizes and the family, overflow ends the round, best saved), the picker paragraph lists `/merge/` and "Snowman Merge's best", and the Layout list gets `games/merge/`.
- [ ] **Step 4: Run** `npm run lint && npm test && npm run build` — Expected: all pass; `dist/merge/index.html` exists.
- [ ] **Step 5: Browser check.** Start `npx vite --host 0.0.0.0` and take headless screenshots (the session's Playwright Chromium driver) at 1280×800 and 390×844: the picker, the title, mid-round with a pile, a merge puff, and game over (drive these by dropping). Product code gets no debug hooks: for the family and a size-9 snowman, use a temporary, uncommitted harness page that draws `drawBackdrop`, `drawPiece(…, 9, …)` and `drawFamily` at a few `t` values, and delete it afterwards. Look at each; fix anything that reads badly.
- [ ] **Step 6: Commit** `feat(merge): picker tile, offline page and README`.
