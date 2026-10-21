# Snowman Merge: design

## Intent

Hypercaz's next game is a **merge-and-drop game** in the style of Suika. You drop snowballs into a wooden crate; two of the same size that touch pack into one bigger one. Big snowballs become snowmen, and two of the biggest snowmen become a **snowman family**, who wave and walk off. A round ends when the crate overflows, and you chase your best score.

**The fun** is "merging into a big fruit, chain reactions" (the user's words): the big merges, and chains where one merge rolls into another.

**Why snow, not fruit:** two lemons don't make an apple. The user wanted merging that makes sense, and packing two snowballs together does make a bigger one. Dust and planets were considered and dropped: "who wants to throw dust around?"

Hypercaz is **predominantly a web game**: desktop with a mouse comes first, phones second (they must still work).

## Decided in conversation

- **Game:** a Suika-style merge-and-drop game.
- **Theme:** snowballs that grow into snowmen. The final form is a snowman family.
- **The family:** when it forms, it **walks off and clears room**, for a **big score**.
- **Ending:** overflowing the crate ends the round. You chase a saved **best score**.
- **Setting:** a **wooden crate in a snowy garden**.
- **The heart of it:** big merges and chain reactions.

## The game

### A round
- **Aiming:**
  - **Mouse:** a snowball hangs above the crate and follows the mouse. A faint guide line shows where it will fall. Clicking drops it.
  - **Phone:** drag to aim, and let go to drop.
  - **Keyboard (my call):** the left and right arrows aim, and Space drops.
- **Limits on aiming and dropping:**
  - The aim is clamped so the ball fits inside the crate's walls.
  - **Drop cooldown (my call):** after each drop there's a short wait before the next, about half a second, so you can't flood the crate.
- **What you drop (my call):**
  - only sizes 1–4, chosen at random;
  - each round gets a fresh seed, and tests can fix the seed;
  - smaller sizes are more likely;
  - a preview shows the next ball.
- **Physics:** snowballs fall, bounce a little, roll and settle in a pile, against the crate's floor, its walls and each other.
- **Merging:** two balls of the same size that touch become **one ball of the next size**.
  - The new ball appears where they met.
  - A merge can push into a neighbour of the same size and merge again. That's a chain.
- **The family:**
  - **What makes one:** two size-9 snowmen.
  - **What it does:** it never takes up room. It appears, waves, walks out of the crate into the garden and off screen, and the space is freed.
- **Score (my call):**
  - Each merge scores the points of the size it makes, and bigger sizes are worth much more.
  - Each further merge in a chain scores a multiplier.
  - A family scores a large bonus.
  - **What counts as a chain:** merges set off by the same drop, until everything settles.
- **The end:**
  - **The danger line:** a line near the top of the crate.
  - **Game over:** the round ends if any settled snow stays above the line for about 2 seconds (my call). A ball that has just been dropped, or one that briefly flies past the line, doesn't count.
  - **Warning:** while snow is over the line, the line flashes as a warning.
  - **After the round:** the score, your best, and a prompt to play again.

### The sizes (my call)
Every piece is round, so the physics only ever deals with circles. Size goes up at every step, and from size 5 each step adds something you can see. A colourful accessory on each snowman size keeps them easy to tell apart, even though they're all white.

| # | Piece | What it looks like |
|---|-------|--------------------|
| 1 | Snowflake ball | tiny, with a snowflake mark |
| 2 | Small snowball | plain and round |
| 3 | Packed snowball | with a packed-snow texture |
| 4 | Big snowball | with sparkles |
| 5 | Snowman head | coal eyes and a smile |
| 6 | Snowman | adds a carrot nose |
| 7 | Snowman | adds a coloured scarf |
| 8 | Snowman | adds a top hat |
| 9 | Snowman | adds earmuffs and mittens |
| — | **Snowman family** | two size-9 snowmen merge into the family, which walks off |

- **Tuning:** the builder sets the radii and the score values. The rule is that size 9 is big enough that only a few fit in the crate.

### Look and feel
- **Layout:** a tall column like Stack and Squad Shooter: 540×960 logical, letterboxed. The garden backdrop fills the whole browser window, so desktop doesn't show black bars.
- **Scene (my call):**
  - an open-topped wooden crate in a snowy garden at dusk;
  - behind it, a soft blue sky, a few trees and a fence, and light snow falling in the background.
- **Feedback:**
  - **Merges:** each merge throws a puff of snow.
  - **Chains:** links in a chain get a growing burst and a score pop-up.
- **The family's moment:** they wave, then walk off across the garden. This is the biggest moment in the game.
- **HUD:** the score and best are at the top, with the next-ball preview beside them. Pause and mute sit in the corner, as in the other games, plus an "All games" link.
- **Sound (my call):**
  - short synthesised sounds only, no music, using the shared audio engine;
  - a soft thud on landing;
  - a crunchy pop on merging that rises in pitch with each link of a chain;
  - a little fanfare for the family.
- **Art:** no new art files. Everything is drawn with canvas shapes.

### Controls and screens
- **Starting (my call):** a short title shows "Snowman Merge", your best, and a prompt to start. It works like Stack's.
- **Keys:** Esc pauses and M mutes. The game pauses itself when the tab is hidden.
- **Game over:** shows the score and best, with "Play again" and an "All games" link.

## Physics

- **Our own engine:** a small physics engine written for this game. It handles circles against circles and against the crate's floor and walls.
  - No physics library is added.
  - It is pure and deterministic, with fixed time steps and seeded drops, so tests can replay a run.
- **What it must feel like (my call):**
  - Piles settle and stop jittering.
  - Balls don't sink into each other or tunnel through walls, even after a big merge.
  - **Overlap after a merge:** a merged ball that overlaps its neighbours pushes them aside smoothly rather than launching them out of the crate.
- **Room to adjust:** the builder may tune gravity, bounce, friction and the number of solver passes. The feel is what's decided.

## Site

- **Page and route (my call):** the game gets its own page at `/merge/`, built like the other game pages, with paths relative to `base: './'`.
- **Picker:** a new tile with an inline-SVG picture of a crate and a snowman. It shows "Best: N", or "New" before the first round.
- **Name (my call):** "Snowman Merge".
- **Offline:** offline play and the service worker's precache cover the new page.
- **Storage:**
  - The namespace is `hypercaz.merge`. It saves the best score and mute.
  - Like the other games, it copes with storage being unavailable: it still plays, and the best starts at 0.

## Shared engine

- **Reuse:** use the shared `bootGame`, `engine/controls.ts`, `engine/ui.ts`, audio and storage.
- **Input:** drag-and-release on phones needs a pointer-up signal. If `engine/input.ts` doesn't provide one, extend the shared engine, without copying it, because duplicated code fails SonarCloud's 3% gate.
- **Other games:** they must behave exactly as before.

## Not doing

- Power-ups, shops, coins or currencies.
- Levels, stars, online leaderboards or accounts.
- Ads and music.
- Non-round pieces.

## Tests

- **Physics:**
  - a ball dropped into an empty crate lands on the floor and comes to rest;
  - a pile settles within a bounded time and stops jittering;
  - balls never end up outside the crate's walls or floor;
  - the same seed and the same drops give the same result.
- **Merging:**
  - two touching balls of the same size become one of the next size, where they met;
  - balls of different sizes never merge;
  - a chain is scored with its multiplier;
  - two size-9 snowmen make a family, which leaves the crate and scores the bonus.
- **Drops:**
  - only sizes 1–4 are dropped;
  - the preview is the next drop;
  - the cooldown is enforced;
  - aiming is clamped to the crate.
- **Game over:**
  - snow above the line for the full time ends the round;
  - a ball that just dropped, or briefly passes the line, does not.
- **Best:** it's saved and loaded, and null storage plays with a best of 0. The picker tile reads "New" / "Best: N".
- **Build:** the page is built, and the offline cache includes it.
- **Browser:** screenshots on desktop and phone of:
  - mid-round, with a full pile;
  - a merge;
  - the family walking off;
  - game over.
- **Fun check:** you play it to judge the feel.
