# Water sort: design

## Intent

Hypercaz's third game is a **water sort puzzle**. Tubes of mixed coloured liquid are sorted by pouring between them until every tube holds a single colour. It is the calm one of the three: **simple, mindless fun**, played to switch off rather than to be tested. Squad Shooter is reflex and Stack is timing; this one is unhurried logic with a satisfying pour.

Hypercaz is **predominantly a web game**: desktop with a mouse comes first, phones second (they must still work).

## Decided in conversation

- **Feel:** simple, mindless fun. There is no timer, no move limit and no way to lose.
- **Solvability:** every level can be solved from its starting position. A player can still pour themselves into a dead end. That's part of the puzzle: "not every possible move needs to lead to a solution".
- **Softlocks:** "softlocking sucks", so getting out of a dead end is always one click away (undo or restart).
- **Dead ends:** the game does **not** hint that you're in one. It speaks up only when there are no legal moves at all.
- **Levels:** endless and numbered.
- **Layout:** mockup B, the whole window, with big tubes in a row. It is not the tall 540×960 column the other two games use.
- **Hidden layers:** none. Everything is visible, "at least for now".

## The game

### Rules
- **Tubes:** each holds up to **4 layers**. A level has some filled tubes, each with 4 layers of mixed colours, and some empty spare tubes. Each colour appears exactly 4 times.
- **Picking a tube:** click or tap a tube to lift it. Click or tap it again, or click empty space, to put it down.
- **Pouring:** with a tube lifted, click another tube to pour into it.
  - **What moves:** the whole run of the same colour at the top of the lifted tube, as much as fits.
  - **Where it can go:** a pour is legal only onto the same colour or into an empty tube, and only if the target has room.
  - **Illegal pour:** the lifted tube gives a small shake, nothing changes, and it stays lifted.
- **Finished tubes:** a tube full of 4 layers of one colour is **done**. It gets a soft shine and a chime. Done tubes can still be poured from, so nothing is locked.
- **Winning:** the level is won when every non-empty tube is done.
- **Undo:** unlimited, one pour at a time, back to the level's start.
- **Restart:** resets the level to its start.
- **Stuck:** when no legal pour exists anywhere, a gentle message offers Undo or Restart. There is no other warning. If legal moves exist, the game says nothing, even if none of them can lead to a win.
  - **Pointless pours (my call):** a pour that achieves nothing still counts as a legal move, so it doesn't trigger the stuck message. An example is moving a whole one-colour tube into an empty tube.

### Levels
- **Numbering:** levels are numbered from 1 with no end. A level is generated from its number (seeded), so a given number is always the same puzzle, on every device and in every version, unless the generator is deliberately changed.
- **Proven solvable:** every generated level is checked by a solver before it's shown.
- **Not already solved:** a starting position has no done tubes, and no tube is a single colour.
- **Difficulty:**
  - **Early:** the first levels are small, a few colours with two spare tubes, so a new player gets it at once.
  - **The climb:** more colours, and so more tubes, arrive gradually. Fewer spare tubes come later.
  - **Plateau:** difficulty then **levels off** at a comfortable size rather than climbing forever.
  - **Proposed curve (my call):**
    - Levels 1–2: 3 colours + 2 spares.
    - Then one more colour every few levels, up to about 10 colours by around level 40.
    - From about level 60, some levels have 1 spare, but only where the solver finds the level comfortably solvable. The builder picks and documents the threshold for "comfortably", e.g. a solution within a move or search budget.
  - The builder may tune these numbers; the shape is what's decided.
- **Progress:** progress is saved (the current level number). The picker tile shows "Level N", where N is the level you'll play next, or "New" before the first win.
- **After a win:** a short celebration plays, then the next level loads automatically. A click skips the celebration.

### Look and feel
- **Layout:** the game fills the whole browser window.
  - **Desktop:** big tubes sit in a single centred row.
  - **When they don't fit:** if there are too many tubes, or on a narrow or upright phone screen, they wrap into two or more centred rows, sized to fit.
  - **HUD:** "Level N" at the top. Undo and Restart are easy to reach (my call: bottom centre). Pause and mute sit in the corner, as in the other games, plus an "All games" link.
- **Tubes (my call):** glass tubes with a light outline and a faint shine, filled with bright, flat liquid colours. A lifted tube rises a little.
- **Colours:** about 10 to 12 colours that are clearly different from each other, drawn from or extending the hypercaz palette.
- **Symbols:** each colour can also carry a small symbol for colour-blind players. They start off (the user's choice); a setting turns them on, and the choice is saved.
- **Pouring:** the lifted tube tilts over the target, liquid flows across, then the tube returns. This is short (my call: under half a second). Input during a pour is queued or ignored, never lost in a way that corrupts the board.
- **Background (my call):** a calm dark-blue gradient.
- **Sound (my call):** short synthesised sounds only, no music: a pour, a done-tube chime, and a level-clear flourish. They use the shared audio engine.
- **Art:** no new art files. Everything is drawn with canvas shapes.

### Controls
- **Mouse first.** Touch works the same way: tap to lift, tap to pour.
- **Keyboard (my call):**
  - Z or Backspace: undo.
  - R: restart.
  - Esc: pause.
  - M: mute.
- **Pausing:** the game pauses itself when the tab is hidden.

## Site

- **Page and route (my call):** the game gets its own page at `/sort/`, built like `/squad/` and `/stack/`. Paths are relative to `base: './'`.
- **Picker:** a third tile, with an inline-SVG picture of tubes, the game's name, and its progress.
- **Name (my call):** "Water Sort".
- **Offline:** offline play and the service worker's precache cover the new page.
- **Storage:**
  - The namespace is `hypercaz.sort`. It saves the current level number, the colour-symbols setting and mute.
  - Like the other games, it copes with storage being unavailable: it starts at level 1 and still plays.

## Shared engine

Squad and Stack now share boot, controls and text drawing in `engine/` (`bootGame`, `engine/controls.ts`, `engine/ui.ts`). Today these assume a fixed 540×960 letterboxed column. This game needs a full-window canvas instead.
- **How:** the builder extends the shared engine for a full-window mode rather than copying it, because duplicated code fails the repo's SonarCloud gate (3% limit on new code).
- **Squad and Stack:** they must behave exactly as before.

## Not doing

- Hidden "?" layers, for now.
- Timers, move limits, stars, scores or failing a level.
- Hints of any kind, and a hints shop. There are no coins or currencies.
- Extra-tube lifelines. Undo and restart are the whole toolkit.
- Ads, accounts, online features, and music.

## Tests

- **Rules:**
  - a pour moves exactly the top run that fits;
  - illegal pours change nothing;
  - pours into an empty tube are legal;
  - done-tube detection works;
  - the win is detected;
  - undo restores exact earlier states, back to the start;
  - restart works.
- **Stuck:** "no legal moves" is detected, and positions that still have legal moves are not reported as stuck.
- **Generator:**
  - the same number gives the same level;
  - each colour appears exactly 4 times;
  - no starting tube is already done or a single colour;
  - **the solver finds a solution for every level from 1 to at least 500**;
  - size and spare-tube counts follow the curve and level off.
- **Solver:** it can solve and verify, and it finishes quickly enough to run while a level loads.
- **Saving:** progress is saved and loaded. Null storage starts at level 1. The picker tile reads "New" / "Level N".
- **Layout:** tube positions fit inside the window, with no overlap, on desktop (1280×800) and on a phone held upright (390×844), for small and large levels.
- **Browser:** screenshots of a level on desktop and phone, a pour mid-animation, and a level clear.
- **Fun check:** you play it to judge the feel.
