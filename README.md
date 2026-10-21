# hypercaz

Simple, ad-free hyper-casual browser games. No monetisation, no currencies, no timers, just quick fun.

## Games

### Squad Shooter

Your squad fires automatically up a 2.5D road. Slide left and right to shoot enemies before they reach you, break cages to recruit soldiers, shoot number gates up into the positives, dodge hazards, and beat the boss at the end of each level. Enemy crowds close in on you, and every kill charges the Rapid Fire meter; fire it when it's full for a few seconds of 2.5× firepower.

Level 1, First Steps, is a shorter introduction to steering, recruitment and Rapid Fire, with instructions for keyboard/mouse or touch. You start with three soldiers, and a second easy rescue gives you a chance to recover if you miss the first. Guidance follows your actions without pausing play and is skipped after your first level 1 victory.

Later bosses have a signature attack, announced on the road before it lands:

- **Strafer (levels 5–7):** slides from side to side, so you have to follow it.
- **Charger (levels 8–9):** marks your lane with a red stripe, then lunges down it. Get out of the way, then hit it while it's exposed for double damage.
- **Fortress (level 10):** covers the road in shell shadows except one gap (outlined in green), then raises a shield. Rapid Fire breaks the shield fast.

Level 6, Pincer, has reward forks, where you can't have everything:

- **Twin cages:** two cages arrive side by side. You can break either one in time, but not both, unless you use Rapid Fire.
- **Guarded cage:** a small free cage on one side and a big cage behind a crowd on the other. Shooting through the crowd costs soldiers; Rapid Fire punches through.

#### Controls

- **Mouse / touch:** move left and right to steer; tap the Rapid Fire meter when it's full.
- **Buttons:** pause and mute in the top-right corner (mute works on every screen). The game pauses itself if you switch app or tab.
- **Keyboard:** ← → or A / D to steer, Space for Rapid Fire, Esc to pause, M to mute.
- **On a phone:** use "Add to Home Screen" (Safari's share menu, or Chrome's menu) to get an app icon that opens the game full screen. Once opened, it also starts with no signal.
- **Reporting a problem:** the title screen shows the build (date and commit) at the bottom; mention it.

### Stack

Drop sliding slabs onto a tower. Whatever overhangs is sliced off, so the tower narrows, and a drop that misses entirely ends the run. Each floor you land is one point, and your best is saved on this device. The slab speeds up as the tower grows, reaching top speed around floor 40.

A drop within 4 px of the slab below is **perfect**: it snaps into place and nothing is trimmed. Perfect drops get a white ring, a small screen kick and a bell note that climbs one step up the major scale for each perfect in a row. From the third perfect in a row, each one also grows the slab back a little. A normal drop ends the streak and resets the scale.

- **Mouse / touch / keyboard:** click, tap or press Space to drop.
- **Buttons:** pause and mute in the top-right corner, and "All games" on the title and game-over screens. Esc pauses and M mutes. The game pauses itself if you switch app or tab.

### Water Sort

Pour coloured liquid between tubes until every tube holds a single colour. Each tube holds four layers, you can only pour onto the same colour or into an empty tube, and a pour moves every matching layer on top at once. Levels are generated from the level number and checked with a solver, so each one is winnable. Your level is saved on this device. If you get stuck, a card says so; undo and restart are always free.

- **Mouse / touch:** tap a tube to lift it, then tap another to pour. Tap the same tube to put it back.
- **Buttons:** Undo and Restart at the bottom, and pause, symbols and mute in the top-right corner. The symbols button (off by default) shows a different shape on each colour, for colour-blind players.
- **Keyboard:** Z or Backspace to undo, R to restart, S for symbols, Esc to pause, M to mute.

### Arrow Escape

Clear 12 arrow puzzles by removing pieces in the right order. An arrow’s head exits straight in its marked direction while its tail follows the bends like a ribbon. The path ahead of the head must be clear; the tip, elbow and shaft of other arrows can block it. The first two puzzles stay straight, puzzle 3 introduces an L shape, and puzzle 4 adds a second bend. Clear an exit to open the next one. Tap any part of an arrow, use a free Hint when you want a starting point, and retry without a timer or lives. Every puzzle is selectable and completed puzzles are remembered.

- **Mouse / touch:** tap an arrow to try its exit. A blocked arrow shows the first piece in its way.
- **Keyboard:** arrows move the cell cursor, Enter or Space tries its arrow, H hints, R retries, L opens puzzles, Esc pauses and M mutes.
- **Buttons:** Puzzles, Hint, Retry, pause, mute and All games. Hiding the tab pauses play; resume explicitly.

### Game picker

The front page (`/`) is a grid of tiles, one per game, each showing your progress (Squad Shooter's level and stars, Stack's best, Water Sort's level, Arrow Escape's cleared puzzles). Squad Shooter lives at `/squad/`, Stack at `/stack/`, Water Sort at `/sort/`, and Arrow Escape at `/arrows/`. Each game saves under its own storage name, so they never touch each other's progress.

## Development

Requires Node 24.

```bash
npm install
npm run dev           # play locally at the URL Vite prints
npm test              # unit tests + level winnability tests
npm run lint
npm run build         # static site in dist/
npm run check-assets  # validate art against the manifest
```

### Layout

- `engine/`: shared, game-agnostic pieces (loop, input, scenes, perspective, assets, particles, audio, storage).
- `games/arrows/`: Arrow Escape rules, fixed puzzles, session, scene and canvas renderer.
- `games/picker/`: the front-page game picker.
- `games/sort/`: Water Sort: `sim/` (board rules, solver, level generator), `render/`, `scenes/` and `controls.ts`, built the same way as the others.
- `games/stack/`: Stack: `sim/` (pure logic, no DOM), `render/`, `scenes/` and `controls.ts`, built the same way as Squad Shooter.
- `games/squad/sim/`: pure game logic (`step(state, input, dt)`), with no DOM access, tested headlessly.
- `games/squad/render/`: draws the sim state. It is read-only.
- `games/squad/scenes/`: the title, level select, play and results screens.
- `games/squad/levels/*.json`: level data.
- `games/squad/assets/`: art plus `manifest.json`.
- `public/`: favicon, app icons and the web app manifest, copied into the build as they are.
- `scripts/pwa.ts`: stamps the build and writes the service worker (`scripts/sw.js` plus the list of this build's files). Real builds only, so `npm run dev` always serves fresh files.

### Levels

Each level is a JSON file in `games/squad/levels/`, validated on load. Fields:

- `id`, `name`, `speed` (m/s), `startSquad`, `length` (m)
- `stars`: `[2-star, 3-star]` minimum soldiers left at the end
- `burstKills`: charge needed for Rapid Fire (optional, defaults to 40; normal enemies give 1 charge and heavies give 3)
- `spawns`: a list of `{ z, x, type, ... }`. `x` runs from −1 to 1 across the road and `z` is metres along it.
  - `enemy` / `heavy`: `hp`, optional `kills`
  - `horde`: `count`, `hp`, `width`, `depth` (m); expands into a seeded crowd of enemies. `z + depth` must not exceed `length`.
  - `cage`: `hp`, `value` (soldiers gained)
  - `gate`: `value` (+1 per hit), `width`, optional `max`
  - `hazard`: `kind` (`blade` | `fire` | `barricade`), `width`
- `boss`: required `hp`, `pattern` (`single` | `volley3` | `spread5`), and `fireEvery` (seconds between volleys).
  - `advance`: forward speed in m/s after entering (optional, defaults to 0).
  - `summonEvery`, `summonCount`, `summonHp`: seconds between summons, enemies per summon and their health. Supply all three to enable summons; omit them to disable summons.
  - `signature`: `strafe` | `charge` | `fortress` (optional; omit for no signature attack).
  - `chargeEvery`: seconds between charges; required and positive when `signature` is `charge`.
  - `shieldHp`: shield health; required and a positive integer when `signature` is `fortress`.

See the [level validator](games/squad/sim/level.ts) for all field constraints and defaults.

After changing a level, run `npm test`. `tests/squad/levels.test.ts` checks that a scripted bot can still win every level with 2 stars, and that standing still can't win levels 3–10. `tests/squad/forks.test.ts` checks that each of level 6's forks is still a real choice.

### Art

Art is produced from [`docs/art-brief.md`](docs/art-brief.md). Missing sprites are drawn as coloured placeholders, so the game is always playable.

### Design docs

- Spec: [`docs/superpowers/specs/2026-10-18-squad-shooter-design.md`](docs/superpowers/specs/2026-10-18-squad-shooter-design.md)
- Plan: [`docs/superpowers/plans/2026-10-18-squad-shooter.md`](docs/superpowers/plans/2026-10-18-squad-shooter.md)
