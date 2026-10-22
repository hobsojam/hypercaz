# Crate Blast: design

## Intent

Hypercaz's next game is a **block-placing puzzle** in the style of Block Blast and 1010!. You drag shapes made of crates onto an 8×8 loading bay; full rows and columns clear. A run ends when none of your remaining pieces fit, and you chase your best score.

**The fun** is "a good fit" (the user's words): the click of a piece landing exactly where it should and clearing lines.

**The failure to avoid** is boredom: "just playing forever. no big wins no big threat." A run must have shape: pressure that builds, close calls, and big escapes. It should not drift on forever at the same level.

**Skill, not luck.** The user's rules:
- **Threat** is "pieces that must be placed exactly right" or the run ends.
- **Every hand is solvable:** "loss should be my fault." The game never deals a hand you cannot place.
- **Big wins** come from beating the pressure, not from the game handing you the piece you needed.

Hypercaz is predominantly a web game: desktop with a mouse first, phones second (they must still work).

## Decided in conversation

- **Game:** a Block Blast / 1010!-style puzzle: three pieces per hand, rows and columns clear, the run ends when nothing fits.
- **Theme:** a warehouse **loading bay** seen from above. Pieces are **painted shipping crates** in bold colours (mockup option B), not plain wood with straps.
- **Dealer:** every hand dealt can be fully placed from the board it arrives on. Within that, it leans towards awkward hands, more as the run goes on. It never helps you.
- **Wins:** multi-line clears, streaks and clearing the whole bay score far more than single lines.
- **No timer, no currency, no lives.** Best score saved on the device.

## The game

### The bay
- An **8×8 grid** (my call: the classic size).
- A yellow-and-black hazard edge around it, on a concrete floor.

### A turn
- A **hand** of three pieces sits in the tray below the bay.
- You place them **in any order**, one at a time. Pieces **cannot be rotated**.
- After each placement, every full row and every full column clears at once, before the next placement. A cell in both a full row and a full column clears once.
- When all three pieces are placed, a new hand is dealt.

### Placing (my calls)
- **Mouse:** press on a tray piece to pick it up, drag, release to drop.
- **Touch:** the same, but the piece floats above the finger (about 1.5 cells up), so the finger doesn't hide where it lands.
- **Snap:** the piece snaps to the nearest cell. If it fits there, a **ghost** shows where it will land, and any rows or columns it would complete **glow**. If it doesn't fit, there is no ghost, and releasing returns it to the tray.
- **Keyboard:** 1, 2, 3 pick a tray piece; arrows move it on the bay; Enter or Space drops; Esc puts it back (Esc with nothing picked up pauses). M mutes.
- **Tray hints:** a tray piece that fits nowhere on the current board is drawn dimmed. This makes the threat visible.

### The pieces (my call)
The classic set plus a few extras, each a fixed shape in a fixed orientation:

| Group | Shapes |
|---|---|
| Friendly | 1×1; bars of 2 and 3 (both directions); 2×2 square; small L (3 cells, 4 rotations) |
| Medium | bars of 4 (both directions); T (4 rotations); S and Z (both orientations) |
| Awkward | bars of 5 (both directions); 3×3 square; big L (5 cells, 3×3 corner, 4 rotations) |

Each shape has its own crate colour, so a hand is easy to read.

### The dealer
This is the heart of the game.

- **Always solvable:** a hand is only dealt if there is at least one order and set of positions that places all three pieces on the current board, counting clears between placements. The solvability check is exact, not a guess.
- **Pressure:** a value from 0 to 1 that rises with the number of hands dealt. It reaches 1 at about **hand 20** and stays there (my guess; a tuning constant).
- **What pressure does** (the builder tunes the details):
  - it shifts the piece weights from friendly towards awkward;
  - it prefers candidate hands with **fewer ways through**: at full pressure the dealer picks, among several solvable candidates, the one with the fewest solutions.
- **Never generous:** the dealer never looks for the piece that would clear your lines. Its only use of the board is the solvability check and counting ways through.
- **Seeded:** each run has a seed; tests can fix it. The same seed and the same moves give the same run.
- **When no hand is possible:** if no solvable hand exists at all on the board (it is so full that even three single crates can't be placed), the run ends. Your own placements made that board, so the loss is still yours.
- **Speed:** dealing must feel instant on a phone (well under 100 ms). The builder may cap the solution count (it only needs to tell "few" from "many") and may use bitboards.

### The end
- If none of the pieces left in your hand fit anywhere, the bay **jams** and the run is over.
- A short jam moment: the remaining tray pieces shake and go red, a buzzer sounds.
- Then the result screen: score, best, "New best!" if so, play again, and "All games". The same shared game-over screen as Stack and Snowman Merge.

## Scoring (my call; the builder may tune the numbers but keep the shape)

- **Placing:** 1 point per crate placed. Small on purpose.
- **Lines:** clearing *k* lines with one placement scores `10 × k × (k + 1) / 2`: 10, 30, 60, 100, … So a triple is worth six singles.
- **Streak:** counts consecutive **hands** in which you cleared at least one line. Line points are multiplied by the streak (×1, ×2, ×3, …, capped at ×8). A hand that ends with no clear resets the streak to 0.
- **Empty bay:** clearing the whole board scores a flat **500** bonus. It is the rarest and biggest moment.
- The HUD shows the current streak once it reaches ×2.

## Look and feel

- **Layout:** a tall column like Stack and Snowman Merge: 540×960 logical, letterboxed. The concrete backdrop fills the whole window, so desktop shows no black bars.
- **HUD:** "All games" top-left, then score with best above it, streak beside the score when active; pause and mute top-right.
- **Crates (option B):** each cell is a crate painted in its piece's colour: dark outline, a light top-left edge, two plank lines. Use the art-brief palette where it fits (`#1A1A2E` outlines; bold red, blue, green, gold, orange and purple).
- **Feedback:**
  - **Place:** a short squash on landing.
  - **Clear:** the cleared crates slide off the bay in a quick sweep, as if a forklift pushed them, with a puff of dust. Several lines at once get a bigger burst and a score pop-up.
  - **Streak:** the pop-up shows the multiplier, and the clear sound rises in pitch with the streak.
  - **Empty bay:** the biggest moment: the whole bay flashes, an "EMPTY BAY! +500" banner and a fanfare.
  - **Jam:** described above.
- **Sound (my call):** reuse the shared synthesised sounds: `place` for landing, `clear` for clearing (pitched up with the streak), `win` for an empty bay, `fail` for a jam. No music. New sounds may be added to the shared audio engine if these feel wrong.
- **Art:** no art files. Everything is drawn with canvas shapes.

## Screens

- **Title (my call):** like Stack's and Snowman Merge's: "CRATE BLAST", your best, and "Click, press Space or tap to start", with a few crates on the bay behind it.
- **Pause:** Esc or the pause button; the game pauses itself when the tab is hidden. The shared "Paused" overlay.
- **Game over:** the shared screen. Score label "Score".

## Site

- **Name (my call):** "Crate Blast".
- **Route (my call):** its own page at `/blast/` (`blast/index.html`), code in `games/blast/`, built like the other game pages with paths relative to `base: './'`. Add it to the Vite inputs.
- **Picker:** a new tile with an inline-SVG picture of a few painted crates on a bay. It shows "Best: N", or "New" before the first run.
- **Offline:** the service worker's precache includes `blast/`.
- **Storage:** namespace `hypercaz.blast`; saves the best score and mute. Copes with storage being unavailable: it still plays, and best starts at 0.
- **README:** a "Crate Blast" section in the same style as the others.

## Shared engine

- Reuse `bootGame`, `engine/controls.ts`, `engine/ui.ts`, `engine/rng.ts`, `engine/particles.ts`, audio and storage.
- Dragging needs pointer position while held and a release signal; `engine/input.ts` already has `held`, `pointerX/Y` and `consumeRelease()`.
- Don't copy shared code into the game: duplicated code fails SonarCloud's 3% gate. Extend the engine instead if something is missing.
- Other games must behave exactly as before.

## Structure (my call, following the other games)

- `games/blast/sim/`: pure, deterministic and tested.
  - `pieces.ts`: the shape list and groups.
  - `board.ts`: the grid, fits, placing, finding and clearing full lines.
  - `solver.ts`: whether a hand can be fully placed, and how many ways (capped).
  - `dealer.ts`: pressure, weights and choosing a hand.
  - `score.ts` or inside the state: line points, streak, empty-bay bonus.
  - `state.ts`: the run: board, hand, score, streak, hands dealt, rng, phase, events.
- `games/blast/render/`: drawing the bay, crates, tray, ghost, effects.
- `games/blast/scenes/`: `title.ts`, `play.ts`.
- `games/blast/game.ts`, `controls.ts`, `main.ts`, like Stack's.

## Not doing

- Rotating pieces, holding or swapping pieces, undo.
- Power-ups, bombs, coins, currencies, shops, ads, music.
- Levels, stars, timers, online leaderboards, accounts.
- A "rescue" deal or any help from the dealer.

## Tests

- **Board:** a piece fits only on empty cells inside the bay; placing fills exactly its cells; full rows and columns clear together, and a crossing cell clears once.
- **Solver:** finds a solution when one exists only in a particular order (one piece's clear makes room for the next); reports none when no order works; the solution count is capped.
- **Dealer:**
  - every dealt hand is solvable, over many seeded runs and random play;
  - pressure rises with hands dealt and is capped at 1;
  - later hands contain more awkward pieces on average than early hands;
  - at full pressure the dealer picks a candidate with no more solutions than the others;
  - the same seed gives the same hands;
  - a board with no solvable hand ends the run.
- **Scoring:** crate points; 1, 2 and 3 lines at once; the streak multiplier grows, caps and resets after a hand without a clear; the empty-bay bonus.
- **Run:** placing all three pieces deals a new hand; a jam ends the run; best is saved and loaded; null storage plays with a best of 0.
- **Input:** drag and release places at the snapped cell; release on a spot that doesn't fit returns the piece; the touch offset; keyboard placing.
- **Picker and build:** the tile reads "New" / "Best: N"; the page is built and the offline cache includes it.
- **Browser:** screenshots on desktop and phone: title, mid-run with a ghost and glowing line, a multi-line clear, an empty bay, a jam.
- **Fun check:** the user plays it to judge the pressure ramp.
