# Water Sort Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** add a third game, Water Sort: a calm, endless, always-solvable puzzle in which you pour coloured liquid between tubes. It lives at `/sort/`, has a tile on the picker, and fills the whole window.

**Architecture:**
- **Simulation:** a pure simulation in `games/sort/sim/`: board rules, a solver, and a seeded level generator.
- **Shared engine:** `engine/` gains a full-window mode in `bootGame`, plus controls that take a width, so the game reuses the shared boot and buttons instead of copying them (SonarCloud's duplication gate).
- **The game itself:** layout, drawing and the play scene live in `games/sort/`, following Stack's structure.
- **Site wiring:** the picker tile, the offline precache and the README come last.

**Tech Stack:** TypeScript, Canvas 2D, Vite (multi-page), Vitest, Web Audio.

**Spec:** `docs/superpowers/specs/2026-10-21-water-sort-design.md`

## Global Constraints

- **Desktop first:** web first; mouse on desktop comes first, and touch must work.
- **Tubes:** each holds `CAPACITY = 4` layers. Each colour appears exactly 4 times. A pour moves the top run of one colour, as much as fits. It is legal only onto the same colour or into an empty tube.
- **Undo** is unlimited. **Restart** resets the level.
- **No pressure:** no timer, no move limit, no failing, no hints of any kind.
- **"No moves left":** the game speaks up only when there is no legal pour at all. A pointless pour, such as a whole one-colour tube into an empty tube, still counts as a legal move.
- **Levels:**
  - They are numbered from 1 with no end, and generated from the level number as the seed, so a number always gives the same puzzle.
  - Every level is proven solvable by the solver before it is shown.
  - No starting tube is done or a single colour.
- **Difficulty curve:**
  - `colors(n) = min(10, 3 + floor((n - 1) / 5))`;
  - `spares(n) = 1` when `n >= 60 && n % 3 === 0`, otherwise `2`;
  - a 1-spare level must be "comfortable" (Task 1 defines this). Otherwise the generator falls back to 2 spares.
- **Everything visible:** no hidden layers.
- **Layout:** the whole window, as in mockup B. Big tubes sit in one centred row and wrap into centred rows when they don't fit.
- **Look:** no new image or music files; shapes and synthesised sounds only. There are 10 colours, each with a symbol. Symbols are on by default and can be switched off.
- **Storage:**
  - The namespace is `hypercaz.sort`, with keys `level` (the next level to play, an integer ≥ 1), `symbols` (boolean) and `muted`.
  - Null or unavailable storage starts at level 1.
- **Site:**
  - The route is `/sort/`, relative to `base: './'`.
  - The picker tile is named "Water Sort" and shows "Level N" or "New".
  - The offline cache covers the page.
- **Squad and Stack:** they must behave exactly as before. The shared engine is extended, not copied, and duplication between games stays under Sonar's 3% gate.

## Review Focus

1. **Window resize or phone rotation mid-level.** The tubes re-lay out, a lifted tube stays lifted, and clicks still hit the tube under the pointer. Test (Task 3): change `game.view`, then click a tube's new centre; it lifts that tube.
2. **Clicking repeatedly during a pour animation.** The board must stay valid. Test (Task 3): 30 random clicks across 0.5 s with pours in flight; every colour still appears exactly 4 times, and no tube holds more than 4.
3. **Junk or huge saved level** (`"abc"`, `-5`, `2.5`, `1e9`). The game starts sensibly, and a huge level number still generates quickly. Tests:
   - Task 3: `loadLevel` with junk returns 1, and with `2.5` returns 2.
   - Task 1: `generateLevel(1_000_000)` returns a solvable 10-colour board in under 1 s.
4. **Keys during the win celebration.** Z, R and clicks must not undo the win or skip a level twice. Test (Task 3): after the winning pour, Z then R, then let the celebration run out; the saved level and the shown level both equal n + 1.
5. **Leaving "no moves left".** Undo or restart from the stuck message clears it. Test (Task 3): reach a position with no legal moves, check the message flag, undo, and check the flag is cleared.

---

### Task 1: Board rules, solver and level generator

**Files:**
- Create: `games/sort/sim/board.ts`, `games/sort/sim/solver.ts`, `games/sort/sim/levels.ts`
- Test: `tests/sort/board.test.ts`, `tests/sort/solver.test.ts`, `tests/sort/levels.test.ts`

**Interfaces:**
- **Produces, in `board.ts`:**
  - `CAPACITY = 4`.
  - `type Tube = readonly number[]`: colour indices from the bottom up. `interface Board { readonly tubes: readonly Tube[] }`.
  - `topRun(tube): { color: number; count: number } | null`.
  - `pour(board, from, to): { board: Board; moved: number } | null`. It is immutable and returns null when illegal, including when `from === to` or when either index is out of range.
  - `isDone(tube): boolean`: 4 layers of one colour.
  - `isWon(board)`: every tube is empty or done.
  - `hasLegalMove(board)`.
  - `colorCounts(board): Map<number, number>`.
- **Produces, in `solver.ts`:**
  - `type Move = { from: number; to: number }`.
  - `solve(board, maxNodes = 200_000): Move[] | null`. It returns a move list that wins when replayed, or null if none was found within the node budget.
- **Produces, in `levels.ts`:**
  - `levelSpec(n): { colors: number; spares: number }`, following the Global Constraints curve.
  - `generateLevel(n): Board`.
  - `COMFORT_NODES`: the comfort threshold.
- Uses `createRng`/`nextFloat` from `engine/rng.ts`. `nextFloat(state)` returns `[value, nextState]`.

- [ ] Write the tests:
  - **Pouring:**
    - a pour moves exactly the top run that fits: `[0,1,1]` onto `[2,1]` moves 2, and onto `[3,3,1]` moves 1;
    - illegal pours return null: onto a different colour, into a full tube, from an empty tube, onto itself;
    - pouring into an empty tube is legal;
    - `pour` doesn't change its input.
  - **Done and won:** `isDone` and `isWon`, including a board of done tubes plus empties.
  - **Legal moves:** `hasLegalMove` is false for `[[0,1,0,1],[1,0,1,0]]` (both full, no empty tube). It is true when the only legal pour is pointless: `[[0,0,0,0],[]]`.
  - **Solver:**
    - it solves a hand-made 3-colour board, and replaying its moves with `pour` gives `isWon`;
    - it returns null on the stuck board above.
  - **Generator:**
    - `generateLevel(7)` equals `generateLevel(7)`;
    - every colour appears exactly 4 times;
    - no starting tube is done or one colour;
    - the tube count is colours + spares;
    - for n = 1..500, `solve(generateLevel(n))` is non-null (timeout 120 s);
    - `levelSpec` returns 3 colours at levels 1–5, 4 at level 6, 10 at level 36 and at 10_000, and 1 spare at levels 60 and 63 but 2 at level 61;
    - `generateLevel(1_000_000)` takes under 1 s and is solvable (Review Focus 3).
- [ ] Run `npx vitest run tests/sort`. Expected: FAIL (modules missing).
- [ ] Implement.
  - **Solver:** depth-first search with a visited set keyed by a canonical board string (sorted tubes), so identical tubes in a different order count once.
    - Skip pours from a done tube.
    - Skip pouring a one-colour tube into an empty tube. That's pointless for the solver, though still legal for the player.
    - Try moves that complete a tube first.
  - **Generator:**
    - Seed with `createRng(n)`, shuffle the layers (Fisher–Yates), and deal them into `colors` tubes followed by `spares` empty tubes.
    - Reject and redeal, from the same rng stream, while any tube is one colour or `solve` returns null.
    - A 1-spare level is accepted only if `solve(board, COMFORT_NODES)` succeeds. Choose `COMFORT_NODES` and document why in a comment. After 50 rejected 1-spare deals, generate it with 2 spares instead.
- [ ] Run the tests again (PASS), then the whole suite, `npx tsc --noEmit` and `npm run lint`. Commit.

### Task 2: Full-window mode and width-aware controls in the shared engine

**Files:**
- Modify: `engine/boot.ts`, `engine/input.ts`, `engine/controls.ts`, `engine/audio.ts`
- Test: `tests/engine/` (extend the existing controls and audio tests; add `tests/engine/boot.test.ts` for the pure view helper)

**Interfaces:**
- **Produces, in `input.ts`:** `viewFor(fit: 'letterbox' | 'window', winW, winH, logicalW, logicalH): Letterbox`.
  - `'window'` returns `{ offsetX: 0, offsetY: 0, scale: 1 }`.
  - `'letterbox'` is today's `fitLetterbox`.
- **Produces, in `boot.ts`:** `BootOptions` gains two fields:
  - `fit?: 'letterbox' | 'window'`, default `'letterbox'`;
  - `onResize?(game: G, w: number, h: number)`.
- **Window mode in `boot.ts`:**
  - the logical size is the window's CSS size;
  - the clip rect is the whole window;
  - `width`/`height` are ignored;
  - `onResize` is called once after `createGame` and on every resize;
  - the default black fill still runs first.
- **Produces, in `controls.ts`:**
  - `controlRects(width: number): { mute: Rect; pause: Rect; allGames: Rect }`. The existing `MUTE_BUTTON`, `PAUSE_BUTTON` and `ALL_GAMES_BUTTON` constants equal `controlRects(540)`.
  - `takeClick(game, remember, width = 540)`.
  - `drawMuteButton(ctx, muted, rect = MUTE_BUTTON)`.
  - `drawPauseButton(ctx, rect = PAUSE_BUTTON)`.
  - `drawAllGamesButton(ctx, rect = ALL_GAMES_BUTTON)`.
  - `hitAllGames(click, rect = ALL_GAMES_BUTTON)`.
- **Produces, in `audio.ts`:** the Sfx values `'pour'`, `'fill'` and `'clear'`, as short synthesised voices: a soft liquid glug, a chime, and a little rising flourish.

- [ ] Write the tests:
  - `viewFor('window', 1280, 800, 540, 960)` gives scale 1 with no offset;
  - `'letterbox'` matches `fitLetterbox`;
  - `controlRects(540)` deep-equals the three existing constants;
  - `controlRects(1280).mute.x` is `1280 - 48`;
  - `takeClick` with `width = 1280` uses up a click on the mute button at its 1280 position, and passes a click at the 540 position through;
  - the new Sfx play without throwing, using the existing fake audio context in the audio tests.
- [ ] Run them. Expected: FAIL.
- [ ] Implement. Squad and Stack must not change: all their existing tests pass untouched.
- [ ] Run the whole suite, tsc and lint, plus `npx -y jscpd@4 --min-tokens 50 --reporters console games engine`, with no new clones. Commit.

### Task 3: The Water Sort game

**Files:**
- Create:
  - `games/sort/game.ts`, `games/sort/main.ts`, `games/sort/controls.ts`;
  - `games/sort/render/layout.ts`, `games/sort/render/draw.ts`;
  - `games/sort/scenes/play.ts`;
  - `sort/index.html`.
- Modify: `vite.config.ts` (add the `sort` input)
- Test: `tests/sort/layout.test.ts`, `tests/sort/render.test.ts`, `tests/sort/play.test.ts`

**Interfaces:**
- **Consumes:**
  - Task 1's `Board`, `pour`, `isDone`, `isWon`, `hasLegalMove`, `colorCounts` and `generateLevel`.
  - Task 2's `bootGame({ fit: 'window', onResize })`, `controlRects`, `takeClick(…, width)` and the draw helpers, and the `'pour'`, `'fill'` and `'clear'` Sfx.
- **Produces, in `game.ts`:**
  - `SORT_STORAGE = 'hypercaz.sort'`.
  - `interface SortGame { stack; input; audio; storage; view: { w: number; h: number }; symbols: boolean }`.
  - `loadLevel(storage): number`: the saved `level`, floored, if it is finite and ≥ 1, otherwise 1.
- **Produces, in `layout.ts`:**
  - `layoutTubes(count, w, h): Rect[]`.
    - Tubes sit between a top band of 70 px (HUD) and a bottom band of 90 px (buttons).
    - They are as large as fits, up to 80 px wide, with a height-to-width ratio of 3.6 and gaps of 0.6 × width.
    - They form one row whenever the tubes can be at least 44 px wide; otherwise as few rows as keep them at least 44 px wide.
    - Each row is centred.
  - `buttonRects(w, h): { undo: Rect; restart: Rect }`: bottom centre.
  - `tubeAt(rects, x, y): number | null`, generous by 10 px.
- **Produces, in `draw.ts`:**
  - `COLORS` and `SYMBOLS`: 10 entries each, colours clearly distinct. Extend the hypercaz palette: #E04040, #F5C242, #3CC85A, #2F7DE1, #9B59D0, #FF8A1F, plus 4 more.
  - `drawScene(ctx, model)`, where `model` holds:
    - the board, the rects and the view size;
    - `lifted: number | null` and a `pour` animation state;
    - `symbols`, `level` and `time`;
    - `stuck`, `celebrating` and `shake`.
- **Produces, in `play.ts`:** `PlayScene(game, level)`.
  - **Committing a pour:** a pour changes the board the moment it starts. The 0.4 s tilt-and-flow animation is visual only, so clicks during it act on the new board and nothing can corrupt it.
  - **Lifting:** a click on a tube lifts it. A click on the same tube or on empty space puts it down.
  - **Illegal pour:** the lifted tube shakes and stays lifted.
  - **Sounds:** a pour plays `'pour'`, and a tube becoming done plays `'fill'` and shines.
  - **Undo and restart:**
    - Undo is a history stack of boards, reached by the button, Z or Backspace.
    - Restart regenerates the level, by the button or R.
  - **Stuck:** `stuck = !isWon && !hasLegalMove` shows a gentle "No moves left" card with Undo and Restart.
  - **Win:**
    - save `level = n + 1` immediately;
    - play `'clear'` and celebrate for 1.5 s; a click skips;
    - then replace the scene with `PlayScene(game, n + 1)`;
    - while celebrating, ignore undo, restart and tube clicks.
  - **Other controls:** Esc pauses (`drawPausedOverlay(ctx, w, h, touch)`) and M mutes, both via the shared controls at `game.view.w`. S, or a small HUD button left of pause, toggles symbols and saves the setting. The "All games" button goes to `../` through an injectable `navigate`.
  - **Suspend:** pauses the game.
- **Produces, in `main.ts`:** `bootGame({ fit: 'window', workerUrl: '../sw.js', onResize: (g, w, h) => (g.view = { w, h }), … })`. The first scene is `PlayScene(game, loadLevel(storage))`; there is no title screen, because of "quick to start".
- **Produces, in `sort/index.html`:** copy `stack/index.html`'s head (meta tags, `../` icons and manifest), titled "Water Sort".

- [ ] Write the tests:
  - **Layout:** at 1280×800 and 390×844, for 5 and 12 tubes, every rect is inside the window between the bands, no two overlap, and widths are ≥ 44. At 1280×800, 5 tubes form one row.
  - **Clicks:** `tubeAt` hits a tube's centre and misses the gap far from any tube.
  - **Render:** the stub-context render draws one tube outline per tube and a symbol only when `symbols` is true.
  - **Play scene:**
    - lift and pour through clicks at the tube centres;
    - an illegal pour keeps the tube lifted and the board unchanged;
    - undo restores the previous board exactly, and repeated undo stops at the start;
    - restart gives `generateLevel(n)`;
    - winning saves n + 1 and moves on after the celebration;
    - null storage starts at level 1;
    - **Review Focus 1–5**, as listed in the Review Focus section.
- [ ] Run `npx vitest run tests/sort`. Expected: FAIL.
- [ ] Implement until it passes. Then run the whole suite, tsc, lint and `npm run build` (check `dist/sort/index.html` exists), and jscpd with no new clones between games. Commit.

### Task 4: Picker tile, offline cache, screenshots and README

**Files:**
- Modify: `games/picker/tiles.ts`, `games/picker/main.ts`, `index.html` (third tile with an inline-SVG picture of tubes), `scripts/pwa.ts` (`precacheList` adds `'sort/'`), `README.md`
- Test: `tests/picker/tiles.test.ts`, `tests/scripts/pwa.test.ts`

**Interfaces:**
- **Consumes:** Task 3's `SORT_STORAGE` and `loadLevel`. The picker imports them from `games/sort/game.ts`, which must not import scene or render code.
- **Produces:** `sortTile(storage): { name: 'Water Sort'; href: 'sort/'; progress: string }`. Progress reads `New` when nothing valid is saved; otherwise `Level ${loadLevel(storage)}`.

- [ ] Write the tests:
  - `sortTile` reads "New" on empty storage and "Level 12" when `level` is 12;
  - `precacheList` contains `'sort/'`.
- [ ] Run them. Expected: FAIL. Then implement and run them again (PASS).
- [ ] Run `npm run build`, then serve `dist` under a `/hypercaz/` prefix: copy it into a scratch folder's `hypercaz/` directory and use `python3 -m http.server`.
  - Use headless Chromium to check that `/hypercaz/sort/` is controlled by the service worker with scope `/hypercaz/`.
  - Stop the server by its PID.
- [ ] Take headless screenshots and check that they read well:
  - the picker at 1280×800 and 390×844, with three tiles;
  - Water Sort at 1280×800 and 390×844 on a 10-colour level;
  - a pour mid-animation;
  - the "No moves left" card;
  - the level clear.
- [ ] Add a README section on Water Sort, in the existing style. Run the whole suite, tsc, lint and build. Commit.
