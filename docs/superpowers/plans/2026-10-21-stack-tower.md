# Stack Tower and Game Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second game, Stack, and turn the site's front page into a game picker, with Squad Shooter and Stack each on their own page.

**Architecture:**
- **Pages:** Vite builds three pages: `index.html` (the picker, plain HTML and CSS plus a small script), `squad/index.html` and `stack/index.html`.
- **Stack's structure:** it follows Squad Shooter's layout: a pure seeded simulation in `games/stack/sim/`, canvas drawing in `games/stack/render/`, scenes in `games/stack/scenes/`, and boot in `games/stack/main.ts`.
- **Shared code:** the engine is shared. The pause and mute buttons are game-agnostic apart from their `Game` type, so Stack gets its own small copy rather than a refactor of Squad's.

**Tech Stack:** TypeScript, Canvas 2D, Vite (multi-page), Vitest, Web Audio.

**Spec:** `docs/superpowers/specs/2026-10-21-stack-tower-design.md`

## Global Constraints

- **Platform:** web first: mouse and keyboard on desktop come first, touch must work.
- **Canvas:** 540×960 logical, letterboxed. Stack's sky gradient fills the whole window.
- **Perfect drop:**
  - tolerance `PERFECT_TOLERANCE = 4` (logical px);
  - regrowth only from the 3rd perfect in a row onwards, `REGROW = 0.03 × BASE_WIDTH` each, never above `BASE_WIDTH`;
  - fewer than 5% of 1000 random drops are perfect.
- **Speed:** the block speeds up with height and reaches its top speed around floor 40.
- **No new image or music files:** shapes and synthesised sounds only.
- **Storage:** Stack's namespace is `hypercaz.stack`, and it saves `best`. Squad's existing `hypercaz.squad` data must keep working.
- **Pages:** the routes are `/`, `/squad/` and `/stack/`, all relative to `base: './'`, so GitHub Pages under `/hypercaz/` works. The phone app is named "Hypercaz" and opens `/`. The offline cache covers all three pages.
- **Gameplay:** no levels, currencies or online features.

## Review Focus

1. **Squad's saved progress after the move.** A player with saved progress opens `/squad/` and should keep their levels and stars, because the storage namespace and origin are unchanged. Test: loading Squad progress from a storage stub with existing `hypercaz.squad` keys still works, and the picker shows it.
2. **A drop at the exact moment the slider reverses at the edge.** It should behave like any other drop: no NaN and no negative width. Test: drop when `x` is at its turnaround.
3. **A very tall tower** (floor 500+). The camera, colours and speed should stay finite and sensible. Test: simulate 500 perfect drops, then check that speed ≤ max and that colour values are valid.
4. **Storage unavailable** (private mode). Stack plays and shows best 0, and the picker shows "New". Test: Stack with a null storage backend.
5. **An old installed app opening `./`.** It now gets the picker, and the offline cache serves `./`, `squad/` and `stack/`. Test: `precacheList` includes the three pages.

---

### Task 1: Three pages and the picker

**Files:**
- Move: `index.html` → `squad/index.html`. Its script becomes `../games/squad/main.ts`, its icon links become `../...`, and its title stays "Squad Shooter".
- Create: `index.html` (picker), `games/picker/main.ts`, `games/picker/tiles.ts`, `stack/index.html` (a placeholder canvas page until Task 3)
- Modify: `vite.config.ts` (`build.rollupOptions.input` for the three pages), `scripts/pwa.ts` (`precacheList` adds `squad/` and `stack/` beside `./`), `public/manifest.webmanifest` (name and short_name "Hypercaz", description), `games/squad/scenes/title.ts` ("All games" link that goes to `../`)
- Test: `tests/picker/tiles.test.ts`, `tests/scripts/pwa.test.ts`, `tests/squad/title.test.ts`

**Interfaces:**
- **Produces:** `tiles.ts`
  - `squadTile(storage): { name: 'Squad Shooter'; href: 'squad/'; progress: string }`. Progress is e.g. "Level 6 · 9★", or "New".
  - `stackTile(storage): { name: 'Stack'; href: 'stack/'; progress: string }`. Progress is "Best: N floors", or "New".
  - Both read through `createStorage` namespaces. Squad's goes through its existing `loadProgress`.
- **Produces:** `STACK_STORAGE = 'hypercaz.stack'` and key `best` (number), which Task 3 consumes.

- [ ] Write the tests:
  - tiles from empty storage read "New";
  - from Squad progress with levels 1–5 beaten and their stars, the tile shows the next level and the star total;
  - from a Stack best of 47, it shows "Best: 47 floors";
  - `precacheList` contains `'./'`, `'squad/'` and `'stack/'`;
  - Squad's title draws "All games", and a click on it navigates to `../` (inject a `navigate` function on the scene for the test).
- [ ] Run `npx vitest run tests/picker tests/scripts tests/squad/title.test.ts`. Expected: FAIL.
- [ ] Implement:
  - **Picker page:** a CSS grid with `repeat(auto-fill, minmax(220px, 1fr))`, in the hypercaz palette (#1A1A2E background, #2F7DE1 for Squad, a slab gradient for Stack). Each tile has an inline SVG picture and links to `href`.
  - **Build:** Vite multi-page input.
  - **Offline cache:** the precache gets the pages.
  - **Squad's title:** the link sits top-left, opposite the mute button.
- [ ] Run the tests again. Then run `npm run build`, and check that `dist/index.html`, `dist/squad/index.html` and `dist/stack/index.html` exist and that `dist/sw.js` lists them.
- [ ] Commit.

### Task 2: Stack simulation

**Files:**
- Create: `games/stack/sim/constants.ts`, `games/stack/sim/state.ts`, `games/stack/sim/step.ts`
- Test: `tests/stack/sim.test.ts`

**Interfaces:**
- **Produces:**
  - `createStack(seed: number): StackState`.
  - `StackState`:
    - `{ floors: Slab[]; moving: Slab & { dir: 1 | -1 }; speed: number; streak: number; phase: 'play' | 'over'; time: number; events: StackEvent[]; debris: Debris[] }`;
    - `Slab = { x: number; width: number }`, where x is the left edge in logical px.
  - `step(state, input: { drop: boolean }, dt: number): void`.
  - Events: `{ type: 'place'; perfect: false; trimmed: number }`, `{ type: 'perfect'; streak: number }`, `{ type: 'miss' }`.
  - Constants: `WIDTH = 540`, `BASE_WIDTH = 300`, `PERFECT_TOLERANCE = 4`, `REGROW_FROM = 3`, `REGROW = 0.03`, `SPEED_START`, `SPEED_MAX`, `SPEED_FULL_AT = 40`.
- **Slider:** the moving slab bounces between x = −width/2 and WIDTH − width/2 and alternates the side it starts from each floor. Speed = `lerp(SPEED_START, SPEED_MAX, min(1, floors / SPEED_FULL_AT))`.
- **Debris:** the trimmed piece is kept as `{ x, width, y, vy, spin }` so the renderer can drop it. The sim moves it with gravity and removes it below the screen.

- [ ] Write the tests:
  - **Trimming:** a drop overlapping by 120 leaves width 120, at the overlap's x, and one debris piece of the rest.
  - **Miss:** no overlap → `phase 'over'` and a `miss` event.
  - **Perfect drop:** within 4 px it snaps to the top slab's x and keeps the width. At 5 px it trims.
  - **Streak:**
    - perfects 1 and 2 don't change width;
    - the 3rd regrows by 9 px from a narrowed width;
    - regrowth caps at 300;
    - a normal drop resets the streak.
  - **Speed:** rises with floors, equals `SPEED_MAX` at floor 40, and stays there at floor 500 (Review Focus 3).
  - **Random drops:** from a fresh state each time, step a random 0–4 s with seeded randomness, then drop. Over 1000 trials, fewer than 5% are perfect.
  - **Edge drop:** a drop at the slider's turnaround gives a finite, non-negative width (Review Focus 2).
  - **Determinism:** the same seed and inputs give the same state.
- [ ] Run `npx vitest run tests/stack/sim.test.ts`. Expected: FAIL.
- [ ] Implement until it passes, then commit.

### Task 3: Stack render, scenes, sound and boot

**Files:**
- Create: `games/stack/main.ts`, `games/stack/game.ts`, `games/stack/render/draw.ts`, `games/stack/scenes/title.ts`, `games/stack/scenes/play.ts`, `games/stack/controls.ts`
- Modify: `stack/index.html` (real page), `engine/audio.ts` (`play(s: Sfx, pitch = 1)` multiplies every voice frequency, plus new Sfx values `'place'` and `'perfect'`)
- Test: `tests/stack/render.test.ts`, `tests/stack/play.test.ts`, `tests/engine/audio.test.ts` (if one exists; otherwise add a pitch test)

**Interfaces:**
- **Consumes:** Task 2's `StackState`, `step` and constants. Task 1's `STACK_STORAGE`.
- **Produces:** `renderStack(ctx, state, view: { camera: number; time: number; ring: number })`.
  - Slabs: a top face as a parallelogram skewed 30° plus a darker side face, 24 px per floor.
  - Colour: hue = `(baseHue + floor × 4) mod 360`.
  - Sky: a gradient whose hue follows the top floor.
  - Score: drawn top-centre.
- **Sound:** perfect drops play `'perfect'` with `pitch = 2^(step/12)`. Steps follow a major scale by streak (0, 2, 4, 5, 7, 9, 11, 12, …) and cap at two octaves.
- **Screens:**
  - **Title:** "STACK", "Best: N", and "Click, press Space or tap to start".
  - **Play:** pause and mute buttons, plus Esc, M and Space handling.
  - **Game over:** shown over the play scene with floors and best, "Click, press Space or tap to play again", and an "All games" link.
  - Best is saved when it improves.
- **Boot:** `main.ts` mirrors Squad's (letterbox, loop, crash screen, visibility pause, audio unlock). It fills the whole window with the current sky before letterboxing, so desktop has no black bars.

- [ ] Write the tests:
  - **Rendering:** the stub-context render draws one slab per visible floor, plus the moving slab and the score text. The ring is drawn when `ring > 0`.
  - **Play scene:**
    - Space drops;
    - a perfect drop plays `'perfect'` at a higher pitch than the previous one;
    - a miss saves a new best to storage and shows "All games";
    - a null storage backend still plays, with best shown as 0 (Review Focus 4).
  - **Audio:** `play('perfect', 2)` doubles the voice frequencies.
- [ ] Run them. Expected: FAIL.
- [ ] Implement until they pass. Then run the whole suite, tsc and lint.
- [ ] Take headless Chromium screenshots:
  - the picker at 1280×800 and at 390×844;
  - Stack mid-run;
  - a perfect drop's ring.

  Check that they read well.
- [ ] Add a README section on Stack and the picker. Commit.
