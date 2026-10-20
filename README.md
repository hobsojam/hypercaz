# hypercaz

Simple, ad-free hyper-casual browser games. No monetisation, no currencies, no timers, just quick fun.

## Games

### Squad Shooter

Your squad fires automatically up a 2.5D road. Slide left and right to shoot enemies before they reach you, break cages to recruit soldiers, shoot number gates up into the positives, dodge hazards, and beat the boss at the end of each level. Enemy crowds close in on you, and every kill charges the Rapid Fire meter; fire it when it's full for a few seconds of 2.5× firepower.

- **Mouse / touch:** move left and right to steer; tap the Rapid Fire meter when it's full.
- **Buttons:** pause and mute in the top-right corner (mute works on every screen). The game pauses itself if you switch app or tab.
- **Keyboard:** ← → or A / D to steer, Space for Rapid Fire, Esc to pause, M to mute.

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

### Levels

Each level is a JSON file in `games/squad/levels/`, validated on load. Fields:

- `id`, `name`, `speed` (m/s), `startSquad`, `length` (m)
- `stars`: `[2-star, 3-star]` minimum soldiers left at the end
- `spawns`: a list of `{ z, x, type, ... }`. `x` runs from −1 to 1 across the road and `z` is metres along it.
  - `enemy` / `heavy`: `hp`, optional `kills`
  - `cage`: `hp`, `value` (soldiers gained)
  - `gate`: `value` (+1 per hit), `width`, optional `max`
  - `hazard`: `kind` (`blade` | `fire` | `barricade`), `width`
- `boss`: `{ hp, pattern: single | volley3 | spread5, fireEvery }`

After changing a level, run `npm test`. `tests/squad/levels.test.ts` checks that a scripted bot can still win every level with 2 stars, and that standing still can't win levels 3–10.

### Art

Art is produced from [`docs/art-brief.md`](docs/art-brief.md). Missing sprites are drawn as coloured placeholders, so the game is always playable.

### Design docs

- Spec: [`docs/superpowers/specs/2026-10-18-squad-shooter-design.md`](docs/superpowers/specs/2026-10-18-squad-shooter-design.md)
- Plan: [`docs/superpowers/plans/2026-10-18-squad-shooter.md`](docs/superpowers/plans/2026-10-18-squad-shooter.md)
