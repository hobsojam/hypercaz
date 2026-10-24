# Crate Blast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A seventh hypercaz game at `/blast/`: drag hands of three crate pieces onto an 8×8 loading bay, full rows and columns clear, a dealer that only deals solvable hands but gets meaner, and the run ends when the hand jams. Best score is saved.

**Architecture:** A pure, deterministic sim in `games/blast/sim/` (pieces, board, an exact solver, the dealer, and run state with scoring), drawn by `games/blast/render/`, and driven by Title and Play scenes on the shared `bootGame` in 540×960 letterbox mode, like Stack and Snowman Merge. Effects (sweeps, pop-ups, dust) live in the scene layer and never in the sim.

**Tech Stack:** TypeScript, Canvas 2D, Vite multi-page, Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-23-crate-blast-design.md`

## Global Constraints

- No new dependencies, art or audio files. Canvas shapes and the shared synthesised `GameAudio` only, no music.
- 540×960 logical column, letterboxed (the `bootGame` default fit). The concrete backdrop fills the whole window via `paintBackdrop`.
- Page `/blast/`, name "Crate Blast", storage namespace `hypercaz.blast` (keys `best`, `muted`), paths relative to `base: './'`.
- Reuse the shared engine (`bootGame`, `engine/controls.ts`, `engine/ui.ts`, `GameAudio`, `createStorage`/`loadBest`, `createRng`/`nextFloat`, `ParticlePool`, `tweenValue`/`ease`). Extend it rather than copy it. SonarCloud allows 3% duplication on new code and cognitive complexity ≤ 15 per function.
- Sim code is pure and deterministic: no `Math.random` and no `Date.now` inside `sim/`.
- Other games must behave exactly as before, and the full suite (`npm test`, `npm run lint`, `npm run build`) stays green.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Releasing a dragged piece off the bay, or outside the canvas**, must return it to the tray with nothing placed. Task 6 test: `a release off the bay returns the piece`.
2. **The tab hidden mid-drag** must drop the drag and pause, so that on return no piece is stuck to a stale pointer. Task 6 test: `suspend mid-drag cancels the drag and pauses`.
3. **A press on pause, mute or All games** must never pick up a piece, even when it overlaps a tray piece's slop. Task 6 test: `a press on a button does not pick up a piece`.
4. **Dealing on an empty or near-empty bay** (the solver's worst case) must stay fast. Task 3 test: `dealing stays fast on an empty bay`.
5. **Corrupt or missing saved best** must play with best 0. Task 5 test: `a corrupt best reads as 0` (via `loadBest`).

---

### Task 1: Pieces and the board

**Files:**
- Create: `games/blast/sim/pieces.ts`, `games/blast/sim/board.ts`
- Test: `tests/blast/board.test.ts`

**Interfaces:**
- Produces:
  - `type Group = 'friendly' | 'medium' | 'awkward'`
  - `interface Piece { id: string; cells: readonly (readonly [col: number, row: number])[]; w: number; h: number; group: Group; color: string }`. Cells are normalised so the minimum col and row are 0.
  - `PIECES: readonly Piece[]`, `pieceById(id: string): Piece` (throws on unknown).
  - `SIZE = 8`; `type Board = Uint8Array` (length 64, index `row * 8 + col`; 0 is empty, otherwise `PIECES` index + 1, so the renderer knows the colour).
  - `emptyBoard(): Board`; `fits(board, piece, col, row): boolean`; `canPlaceAnywhere(board, piece): boolean`; `isEmpty(board): boolean`.
  - `interface Placement { board: Board; rows: number[]; cols: number[]; cleared: { col: number; row: number; value: number }[] }`
  - `place(board, piece, col, row): Placement`. Returns a **new** board after clearing; it does not mutate the input. `rows`/`cols` are the full lines; `cleared` holds each cleared cell once, with its value before clearing. The caller checks `fits` first.

- [ ] **Step 1: Write failing tests** in `tests/blast/board.test.ts`:
  - `the piece set`: 28 pieces with unique ids; groups are counted as friendly 11, medium 10, awkward 7; every piece's cells are distinct, lie within `w × h`, and have min col and min row of 0; every piece has a `color`. Ids include `'1x1'`, `'h5'`, `'v5'`, `'sq3'`.
  - `fits only on empty cells inside the bay`: `h3` fits at (5,0) but not at (6,0); after placing `1x1` at (2,0), `h3` does not fit at (0,0).
  - `placing fills exactly its cells and leaves the input alone`: `sq2` at (3,4) fills the four cells with `PIECES` index + 1; the original board is still empty.
  - `a full row and a full column clear together, the crossing cell once`: pre-fill row 2 except (4,2) and column 4 except (4,2); placing `1x1` at (4,2) gives `rows=[2]`, `cols=[4]`, `cleared.length === 15`, and an empty board.
  - `canPlaceAnywhere and isEmpty`: `sq3` can't be placed on a board with only 2×2 holes; `isEmpty(emptyBoard())`.
- [ ] **Step 2: Run** `npx vitest run tests/blast/board.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement.** Shapes and ids, grouped as in the spec:
  - friendly: `1x1`, `h2`, `v2`, `h3`, `v3`, `sq2`, `l3a`…`l3d`
  - medium: `h4`, `v4`, `ta`…`td`, `sh`, `sv`, `zh`, `zv`
  - awkward: `h5`, `v5`, `sq3`, `l5a`…`l5d`

  Colours are one per shape family (single, bar, square, small L, big L, T, S, Z), taken from the bold mockup palette: `#E04040`, `#2F7DE1`, `#4CAF50`, `#F5C242`, `#FF8A1F`, `#8E5BD6`, and a teal and a pink for the last two families.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(blast): pieces and the bay`.

---

### Task 2: Solver

**Files:**
- Create: `games/blast/sim/solver.ts`
- Test: `tests/blast/solver.test.ts`

**Interfaces:**
- Consumes: Task 1 `Board`, `Piece`, `fits`, `place`, `SIZE`.
- Produces: `WAYS_CAP = 64`; `countWays(board: Board, hand: readonly Piece[], cap = WAYS_CAP): number`. This counts the (order, position…) sequences that place every piece in `hand`, applying clears between placements, and stops at `cap`. `solvable(board, hand): boolean` is `countWays(board, hand, 1) > 0`.

- [ ] **Step 1: Write failing tests:**
  - `an empty hand has exactly one way`: `countWays(emptyBoard(), []) === 1`.
  - `counts placements of one piece`: on an empty board, `countWays(b, [sq3], 1000) === 36`.
  - `the cap stops counting`: `countWays(emptyBoard(), [1x1, 1x1, 1x1]) === WAYS_CAP`.
  - `finds a way that only exists in one order`: build a board where `h5` fits only after `1x1` completes and clears a row that frees the space. The test helper fills cells from an ASCII picture. Assert that `solvable(b, [h5, 1x1])` is true and `solvable(b, [h5])` is false.
  - `reports none when no order works`: a board whose only empty cells are two isolated singles gives `solvable(b, [sq2])` false and `solvable(b, [1x1, 1x1, 1x1])` false.
- [ ] **Step 2: Run** `npx vitest run tests/blast/solver.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** a depth-first search. For each remaining piece index not yet tried at this depth place it at every fitting cell and recurse on `place(...).board`. Sum the counts and return as soon as the sum reaches `cap`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(blast): exact hand solver`.

---

### Task 3: Dealer

**Files:**
- Create: `games/blast/sim/dealer.ts`
- Test: `tests/blast/dealer.test.ts`

**Interfaces:**
- Consumes: Task 1, Task 2, `engine/rng.ts` (`nextFloat(state): [value, nextState]`).
- Produces:
  - `PRESSURE_HANDS = 20`; `pressure(handsDealt: number): number` = `min(1, handsDealt / PRESSURE_HANDS)`.
  - `groupWeights(p: number): Record<Group, number>`: a linear blend from `{ friendly: 6, medium: 3, awkward: 1 }` at p=0 to `{ friendly: 2, medium: 3, awkward: 4 }` at p=1. Within a group, every piece is equally likely.
  - `CANDIDATES = 8`.
  - `dealHand(board: Board, handsDealt: number, rng: number, draw = drawCandidates): { hand: Piece[]; rng: number }` (`draw` is injectable for tests). It never fails. Full lines clear at once, so every row keeps an empty cell, and three `1x1`s can always be placed.

- [ ] **Step 1: Write failing tests:**
  - `pressure rises and caps`: `pressure(0) === 0`, `pressure(10) === 0.5`, `pressure(20) === 1`, `pressure(99) === 1`.
  - `weights lean awkward as pressure rises`: the awkward share of `groupWeights(1)` is greater than that of `groupWeights(0)`.
  - `every dealt hand is solvable`: over 30 seeds, play 40 hands with a seeded random legal player (place each piece at a random fitting cell, in hand order; stop at a jam). Every hand satisfies `solvable(board, hand)` and has length 3.
  - `later hands are more awkward`: over 200 seeded deals on an empty board, the mean count of awkward pieces at `handsDealt = 30` is greater than at `handsDealt = 0`.
  - `at full pressure it picks the tightest candidate`: on a fixed half-full board and seed, the dealt hand's `countWays` is ≤ the `countWays` of each solvable candidate hand drawn from the same rng sequence. Expose `drawCandidates(handsDealt, rng): { hands: Piece[][]; rng: number }` for this test.
  - `same seed, same hands`: two `dealHand` calls with equal inputs give equal piece ids.
  - `a crowded bay falls back to singles`: on a board with no 3×3 hole, `chooseHand(board, [[sq3, sq3, sq3]], 1, 0)` is null, and `dealHand(board, 30, 1, () => ({ hands: [[sq3, sq3, sq3]], rng: 1 }))` returns three `1x1`s.
  - `dealing stays fast on an empty bay`: 50 `dealHand(emptyBoard(), 30, seed)` calls finish in under 2500 ms in total.
- [ ] **Step 2: Run** `npx vitest run tests/blast/dealer.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `drawCandidates` draws `CANDIDATES` hands of 3 pieces using the weights. `dealHand` scores each solvable candidate with `countWays`. Draw one more float: if it is `< pressure`, take the candidate with the fewest ways (the first one on ties); otherwise take the first solvable candidate. If no candidate is solvable, try up to 4 more rounds of candidates. Failing that, fall back to `[1x1, 1x1, 1x1]`. Split the choice into an exported `chooseHand(board, candidates: Piece[][], p: number, roll: number): Piece[] | null` (null when no candidate is solvable) so it can be tested directly. Never use the board for anything except `countWays`/`solvable`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(blast): a dealer that only deals solvable hands and gets meaner`.

---

### Task 4: Run state and scoring

**Files:**
- Create: `games/blast/sim/state.ts`
- Test: `tests/blast/state.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces:
  - `STREAK_CAP = 8`, `EMPTY_BONUS = 500`, `linePoints(k: number): number` = `10 * k * (k + 1) / 2`.
  - `type BlastEvent = { type: 'place'; slot: number; col: number; row: number; crates: number } | { type: 'clear'; rows: number[]; cols: number[]; cleared: Placement['cleared']; points: number; streak: number } | { type: 'empty'; points: number } | { type: 'deal' } | { type: 'jam' }`
  - `interface BlastState { board: Board; hand: (Piece | null)[]; score: number; streak: number; clearedThisHand: boolean; handsDealt: number; rng: number; phase: 'play' | 'over'; events: BlastEvent[] }`
  - `createBlast(seed: number): BlastState`: deals the first hand, so `handsDealt === 1`.
  - `placePiece(state, slot: number, col: number, row: number): boolean`: clears `events` first. It returns false and changes nothing if the phase is over, the slot is empty or the piece doesn't fit.
  - `fitsSomewhere(state, slot): boolean` (for dimming tray pieces).

- [ ] **Step 1: Write failing tests:**
  - `placing scores a point per crate`: placing `sq2` adds 4, emits `place`, and empties that slot.
  - `line points`: `linePoints(1..4)` gives `[10, 30, 60, 100]`; one clear in the first cleared hand scores `10 × 1`, and a double scores `30 × 1`.
  - `the streak counts hands with a clear`: clear in hand A gives streak 1 (×1); clear in the next hand B gives streak 2 and line points ×2; a second clear in the same hand keeps streak 2; a hand that ends with no clear sets streak 0. Hands are set directly on `state.hand` to control them.
  - `the streak caps at 8`.
  - `an empty bay scores the bonus`: a placement that clears the last crates emits `empty` with `points: 500` and adds it.
  - `placing the third piece deals a new hand`: emits `deal`, fills `hand` with 3 pieces, increments `handsDealt`.
  - `a jam ends the run`: set a board and hand so that after one placement the remaining pieces fit nowhere. That gives `jam`, `phase === 'over'`, and further `placePiece` calls return false.
  - `invalid placements change nothing`: a non-fitting spot or an empty slot returns false, and the score, board and events are unchanged.
- [ ] **Step 2: Run** `npx vitest run tests/blast/state.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** The order inside `placePiece`:
  1. place and score crates;
  2. on clears, if `!clearedThisHand`, set `streak = min(STREAK_CAP, streak + 1)` and `clearedThisHand = true`, then add `linePoints(k) * max(1, streak)`;
  3. if the board is empty, add the bonus;
  4. if the hand is now empty, reset the streak when nothing was cleared in it, then deal;
  5. otherwise, if no remaining piece fits anywhere, it's a jam.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(blast): run state, scoring, streaks and jams`.

---

### Task 5: Game shell, layout and drawing

**Files:**
- Create: `games/blast/game.ts`, `games/blast/controls.ts`, `games/blast/render/layout.ts`, `games/blast/render/draw.ts`, `blast/index.html`
- Test: `tests/blast/render.test.ts`

**Interfaces:**
- Consumes: Task 4 `BlastState`, Task 1 `Piece`, `PIECES`, `SIZE`.
- Produces:
  - `game.ts`: `BLAST_STORAGE = 'hypercaz.blast'`, `WIDTH = 540`, `HEIGHT = 960`, `interface BlastGame { stack; input; audio; storage; time: number }`, re-exports `loadBest`. It must not import scene or render code, because the picker imports it.
  - `controls.ts`: same shape as `games/stack/controls.ts`, with `takeClick(game)` saving mute to storage.
  - `layout.ts`:
    - `CELL = 60` and `BAY = { x: 30, y: 210, size: 480 }`;
    - `TRAY_Y = 800`, `TRAY_CELL = 30`, `traySlotCentre(slot): { x; y }` (x 90/270/450);
    - `TOUCH_LIFT = 1.5 * CELL`;
    - `pieceOrigin(piece, px, py, touch): { x; y }`: the top-left px of a dragged piece centred on the pointer, lifted by `TOUCH_LIFT` on touch;
    - `snapCell(piece, px, py, touch): { col; row }`: the rounded cell of that origin (it may be off the bay; `fits` decides);
    - `trayHit(state, p): number | null`: the slot whose piece box, plus 12 px of slop, contains the point.
  - `draw.ts`:
    - `drawBackdrop(ctx, x, y, w, h)`: concrete floor;
    - `drawCrate(ctx, x, y, size, color, alpha = 1)`: option B, a bold fill, `#1A1A2E` outline, light top-left edge and two plank lines;
    - `interface BlastView { best: number; time: number; drag: { slot: number; x: number; y: number; ghost: { col: number; row: number } | null; glow: { rows: number[]; cols: number[] } } | null; hidden: Set<string> }` (`hidden` holds `"col,row"` cells currently animating away);
    - `renderBlast(ctx, state, view)`: the bay with its hazard edge, the crates, the ghost, glowing lines, the tray (dimming a piece when `!fitsSomewhere`, hiding the dragged slot), and the HUD: best above the score, plus `×N` when `streak ≥ 2`.

- [ ] **Step 1: Write failing tests** in `tests/blast/render.test.ts` (use `stubCtx` from `tests/squad/stubCtx.ts`):
  - `snapCell centres the piece on the pointer`: `snapCell(sq2, BAY.x + 2*CELL, BAY.y + 2*CELL, false)` gives `{ col: 1, row: 1 }`. With `touch: true`, the row is 1.5 cells higher (rounded).
  - `trayHit finds slots and ignores gaps`: slot centres hit 0/1/2; a point at `(270, 600)` gives null; a placed (null) slot is never hit.
  - `renderBlast draws score and best`: `fillText` includes `'1234'` and `'Best: 99'` for score 1234 and best 99, and `'×3'` when streak is 3 (absent when streak is 1).
  - `dims a tray piece that fits nowhere`: a full board with a `sq3` in the hand draws that piece with `globalAlpha` < 1 (assert some `=globalAlpha` write < 1).
  - `draws the ghost and glow without throwing`.
  - `a corrupt best reads as 0`: `loadBest(createStorage(BLAST_STORAGE, backend with best: "x"))` is 0.
- [ ] **Step 2: Run** `npx vitest run tests/blast/render.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the files above. `blast/index.html` mirrors `merge/index.html`, with title "Crate Blast" and its script at `../games/blast/main.ts`. Task 6 adds `main.ts` and the Vite input, so the build stays green.
- [ ] **Step 4: Run** `npx vitest run tests/blast && npm run lint && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(blast): layout, crates and HUD drawing`.

---

### Task 6: Play scene: drag, keyboard, effects, sounds, game over

**Files:**
- Create: `games/blast/scenes/play.ts`, `games/blast/render/effects.ts`, `games/blast/main.ts` (mirrors `games/merge/main.ts`, with `drawBackdrop` in `paintBackdrop`, and temporarily starts on `PlayScene`)
- Modify: `vite.config.ts` (add `blast: resolve(import.meta.dirname, 'blast/index.html')`)
- Test: `tests/blast/play.test.ts`

**Interfaces:**
- Consumes: Tasks 4–5; `engine/controls.ts` (`gameOverAction`, `drawGameOver`, `PAUSE_BUTTON`, `MUTE_BUTTON`, `ALL_GAMES_BUTTON`, `hitRect`), `drawPausedOverlay`, `ParticlePool`.
- Produces:
  - `class PlayScene implements Scene`, with `constructor(game: BlastGame, seed = Date.now() >>> 0)` and `navigate: (url: string) => void`.
  - `effects.ts`: `class Effects { sweep(cleared, lines: number): void; popup(text: string, x: number, y: number, big: boolean): void; flash(): void; shake(): void; update(dt: number): void; draw(ctx): void; hidden(): Set<string> }`. A sweep slides the cleared crates off along their line over about 0.35 s with dust particles.

- [ ] **Step 1: Write failing tests** in `tests/blast/play.test.ts`. Use a stub game like `tests/stack/play.test.ts`, extended with mutable `pointerX`, `pointerY`, `held`, `touch` and a `consumeRelease` queue. Set `state.hand`/`state.board` directly.
  - `drag and release places at the snapped cell`: press on slot 0's centre, move to the bay cell (3,3)'s centre, release. The board has the piece at (3,3), and a `place` sound plays.
  - `a release off the bay returns the piece`: release at `(270, 120)` and at `(-50, 500)`. The slot still holds the piece and the board is unchanged.
  - `a release where it doesn't fit returns the piece`.
  - `touch lifts the piece`: with `touch: true`, releasing with the pointer `TOUCH_LIFT` below the point that centres the piece on (3,3) places it at (3,3).
  - `a press on a button does not pick up a piece`: pause, mute and All games presses start no drag; the pause press pauses.
  - `suspend mid-drag cancels the drag and pauses`.
  - `keyboard places a piece`: `'2'`, then ArrowRight ×2, then Enter places slot 1 at col 2. Esc while holding puts it back without pausing; Esc with nothing held pauses.
  - `clears play the clear sound, pitched up with the streak`: two clearing hands in a row give a rising `clear` pitch; an empty bay plays `win`.
  - `a jam plays fail, saves a new best and shows game over`: `storage.best` is updated; after `OVER_DELAY` a tap replaces the scene with a new `PlayScene`; All games navigates to `'../'`.
- [ ] **Step 2: Run** `npx vitest run tests/blast/play.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **Drag:** a press (`takeClick`) that is not on a button and hits `trayHit` starts the drag. While `input.held` is true, the drag follows `pointerX/Y`, and the ghost and glow are recomputed with `fits` and `place` when the snapped cell changes. On `consumeRelease()`, place if it fits, otherwise drop the drag. If `!held` and there was no release, cancel.
  - **Keyboard:** the held slot starts at cell (0,0); arrows clamp the cursor so the piece stays on the bay.
  - **Events:** for each `state.events` entry:
    - `place`: `audio.play('place')` and a squash;
    - `clear`: `effects.sweep(...)`, a pop-up with `+points` (and `×streak` when ≥ 2), and `audio.play('clear', 1 + 0.08 * (streak - 1))`;
    - `empty`: `flash()`, an "EMPTY BAY! +500" pop-up and `win`;
    - `jam`: `shake()`, `fail`, then finish (save best).
  - **Game over:** `drawGameOver` with `scoreLabel: 'Score'`.
  - **`main.ts`:** boots straight into `PlayScene` until Task 7.
- [ ] **Step 4: Run** `npx vitest run tests/blast && npm run build`. Expected: PASS, and `dist/blast/index.html` exists.
- [ ] **Step 5: Commit** `feat(blast): playable bay with drag, keys and feedback`.

---

### Task 7: Title scene

**Files:**
- Create: `games/blast/scenes/title.ts`
- Modify: `games/blast/main.ts` (start on `TitleScene`)
- Test: `tests/blast/play.test.ts` (title block)

**Interfaces:**
- Produces: `class TitleScene implements Scene`, with `constructor(game: BlastGame)` and `navigate`.

- [ ] **Step 1: Write failing tests:**
  - `title shows CRATE BLAST and best`: renders `'CRATE BLAST'` and `'Best: 42'`.
  - `a tap starts a PlayScene and All games navigates`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** like `games/stack/scenes/title.ts`, using `titleAction`. Behind the text, `renderBlast` draws a fixed decorative board (a few crates) with no drag.
- [ ] **Step 4: Run** `npx vitest run tests/blast`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(blast): title screen`.

---

### Task 8: Picker tile, offline cache, README

**Files:**
- Modify: `games/picker/tiles.ts` (`blastTile`, export `BLAST_STORAGE`), `games/picker/main.ts`, `index.html` (a tile with an inline SVG of painted crates on a bay, placed after Car Park), `scripts/pwa.ts` (add `'blast/'` after `'car/'`), `README.md` (a "Crate Blast" section after Car Park, in the same style)
- Test: `tests/picker/tiles.test.ts`, `tests/scripts/pwa.test.ts`

**Interfaces:**
- Produces: `blastTile(storage): Tile & { name: 'Crate Blast'; href: 'blast/' }`, with progress `'New'` or `` `Best: ${best}` ``.

- [ ] **Step 1: Write failing tests:**
  - `Crate Blast tile`: "New" with empty storage; `Best: 250` after `set('best', 250)`; "New" for a corrupt best.
  - Update the two `precacheList` expectations to include `'blast/'` after `'car/'`.
- [ ] **Step 2: Run** `npx vitest run tests/picker tests/scripts`. Expected: FAIL.
- [ ] **Step 3: Implement.** The README section covers the rules, the dealer promise ("every hand can be placed; it gets meaner"), the scoring shape, and the controls (mouse/touch drag, keyboard 1–3, arrows, Enter/Space, Esc, M, buttons).
- [ ] **Step 4: Run** `npm test && npm run lint && npm run build`. Expected: all PASS.
- [ ] **Step 5: Commit** `feat(blast): picker tile, offline cache and README`.

---

### Task 9: Browser check and finishing

- [ ] **Step 1:** Run `npm run dev` and use a browser with desktop (1280×800) and phone (390×844, touch) viewports. Capture screenshots of the title, mid-run with a ghost and glowing line, a multi-line clear, and a jam/game over. The empty bay is covered by the play tests. Ship no debug hooks.
- [ ] **Step 2:** Play several runs and check that the pressure ramp is felt by about hand 20 and that dealing feels instant. Report what you observe; the user does the final fun check.
- [ ] **Step 3:** Use superpowers:requesting-code-review on the branch, then superpowers:finishing-a-development-branch: push and open a PR (never merge locally).
