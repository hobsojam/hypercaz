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
