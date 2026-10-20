# Stack tower and the game picker: design

## Intent

Hypercaz gets its second game, **Stack**: drop sliding blocks onto a tower; whatever overhangs is sliced off and the tower narrows. The heart of it is the **perfect drop**, and a perfect drop has to be earned. The site's front page becomes a **game picker**, so players choose between Squad Shooter and Stack.

Hypercaz is **predominantly a web game**: a desktop browser with a mouse and keyboard comes first, phones second (they must still work).

## Decided in conversation

- **Game:** Stack, an endless tower chasing your best height. No levels, stars, currencies or upgrades.
- **The perfect drop is the feature, and it is non-trivial to get.**
- **Front page:** a game picker laid out as a grid of tiles (mockup B), wide on desktop.
- **Look:** glowing slabs at an angle, with colours drifting as the tower grows and a soft gradient sky (mockup A).

## The game

### A run
- **The tower:** it starts with one wide base slab.
- **The block:** a new block of the same width slides back and forth above the tower, alternating from the left and right.
- **Controls:** click, Space or tap drops it.
  - **The overhang:** whatever hangs over the edge is sliced off and falls away, tumbling.
  - **What stays:** the rest stays on the tower and becomes the next block's width.
- **A miss** (no overlap at all) ends the run. The block falls, the score and best show, and click, Space or tap starts again.
- **The score:** one floor per block landed. Your best is saved on this device.

### Perfect drops (must be earned)
- **Tolerance:** a drop within **4 px of the 540-px-wide game area** (about 1.3% of the base width) counts as perfect. The block snaps exactly into place and nothing is trimmed.
- **Speed:** the block speeds up as the tower grows (my call: it starts slow enough to learn and reaches its top speed around floor 40). So perfect drops get harder as you climb.
- **Streak:** **3 perfect drops in a row** before any width comes back. From the third on, each perfect drop in the streak grows the block back a little (my call: 3% of the base width, never wider than the base). A normal drop ends the streak.
- **Feel:** a perfect drop gets a white ring around the slab, a musical note, and a small screen kick. The note rises one step up a scale for each perfect in a row, and the scale resets when the streak ends.
- **Proof it's earned:** a test drops 1000 blocks at random moments across the slide and checks that under 5% are perfect.

### Look (mockup A)
- **The slabs:** flat-topped and drawn at an angle, with a top face and a darker side face.
- **Colours:** each floor's colour drifts a little from the one below, so a tall tower is a smooth band of colour.
- **Sky:** a soft gradient that also drifts with height.
- **Camera:** it follows the top of the tower up. The score is large, at the top centre.
- **Layout (my call):** the game is a tall column in the middle of the window, at the same size as Squad Shooter (540×960 logical, letterboxed). The sky gradient fills the whole browser window, not just the column, so desktop doesn't show black bars.
- **Art:** no new art files. Everything is drawn with canvas shapes.

### Controls and screens
- **Starting:** a short title shows "Stack", your best, and "Click, press Space or tap to start".
- **Buttons:** pause and mute in the corner, as in Squad Shooter. Esc pauses and M mutes. The game pauses itself when the tab is hidden.
- **Leaving:** a small "All games" link goes back to the picker, on the title screen and the game-over screen (my call).

## The picker

### Pages (my call)
The site becomes three pages:
- `/`: the picker.
- `/squad/`: Squad Shooter.
- `/stack/`: Stack.

Each game has its own address, so it can be shared or bookmarked, and the browser's back button returns to the picker. Squad Shooter's title screen also gets an "All games" link.

### The page
- **What it is:** an ordinary web page (HTML and CSS), not a canvas, so it lays itself out for any window.
- **Header:** "Hypercaz", with "quick games, no ads".
- **The grid:** game tiles in a grid that fills the width. That's several per row on a desktop and two on a phone.
- **Tiles:**
  - each has a drawn picture (CSS or inline SVG, no new art files), the game's name, and your progress;
  - Squad Shooter shows the furthest level reached and stars earned;
  - Stack shows "Best: N floors", or "New" before the first run;
  - progress is read from what each game already saves on this device.
- **Clicking a tile** opens the game.

### Phone install
- **Install:** the home-screen app becomes "Hypercaz" and opens the picker.
- **Offline:** offline play covers all three pages.

## Not doing
- **Progression:** no levels, stars or achievements in Stack, and no online leaderboards or accounts.
- **Art:** no new sprite art or music for Stack. It uses short synthesised sounds only (my call: no background music).
- **Squad Shooter's gameplay:** unchanged.

## Tests
- **Stack simulation** (pure and seeded, like Squad Shooter's):
  - trimming leaves exactly the overlap;
  - a miss ends the run;
  - a perfect drop snaps and doesn't trim;
  - the streak regrows only from the third perfect, up to the base width at most;
  - speed rises with height.
- **Perfect drops are earned:** fewer than 5% of 1000 random drops are perfect.
- **Best:** it's saved and loaded, and the game copes with storage being unavailable.
- **Picker:** tiles show the right progress from saved data, and Stack's tile reads "New" when there's none.
- **Build:** all three pages are built, and the offline cache includes all of them.
- **Browser:** screenshots of the picker on a desktop window and a phone, and of Stack mid-run and at a perfect drop.
- **Fun check:** you play it to judge the feel.
