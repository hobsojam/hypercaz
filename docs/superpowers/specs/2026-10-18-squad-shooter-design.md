# Squad Shooter — Design Spec

- **Date:** 2026-10-18
- **Status:** Draft for review
- **Working title:** Squad Shooter (game one of the `hypercaz` collection)

## 1. Purpose and constraints

A collection of simple, fun hyper-casual browser games inspired by the gameplay shown in adverts for games like Top War and Last War — **without** any monetisation, adverts, currencies, timers or upgrade grinds.

- **Audience:** the author and a small group of friends, shared by link.
- **Platform:** desktop browser (mouse/keyboard primary). Touch drag should work but is not a priority. No native mobile or Windows apps.
- **Content line:** cartoon combat only. Defeated units pop into confetti. No gore, nothing sexual or otherwise extreme.
- **Art:** produced by Codex from a written art brief. Code must never be blocked on art.

### Success criteria for game one

1. A complete run is playable end to end: title → level → boss → win/lose → results → next/retry.
2. About 10 hand-made levels with rising difficulty, all winnable (verified by a headless bot test).
3. The core decision — *shoot the threat or invest in growing the squad* — stays meaningful from the first level to the last, including when the squad is large.
4. Runs entirely as a static site on GitHub Pages.

## 2. Gameplay

### 2.1 Core loop

The player's squad sits near the bottom of a road drawn in 2.5D perspective. The road scrolls toward the squad. The squad **fires automatically** straight up the road. The player only controls the squad's **horizontal position**, which is smooth and continuous (no lanes, no snapping).

The core tension is **firepower allocation**: enemies must be shot before they reach the squad, while bonus objects (cages, number gates) must be shot to gain soldiers. Where the squad stands decides what its fire hits.

### 2.2 A run (one level, ~60–90 s)

1. **Start:** a "Click to start" screen. The squad has 1 soldier (levels may override the starting count).
2. **Advance:** the road scrolls at the level's speed. Entities spawn at positions defined in level data.
3. **Boss:** at the end of the road the scrolling stops and a boss with a large HP bar arrives. It fires slow, dodgeable projectiles at the squad.
4. **Result:** win when the boss's HP reaches 0. Lose when the squad reaches 0 soldiers. Then a results screen with stars, and **Next** (on a win) or **Retry**.

### 2.3 Controls

- The mouse X position (or touch drag) sets the squad's target X. The squad eases toward it (critically damped, so it feels weighty, not twitchy).
- Arrow keys / A–D move the target X at a fixed speed.
- There is no fire button. `M` toggles mute and `Esc` pauses.

### 2.4 Squad and formation

- Each soldier fires one bullet every **0.4 s** (staggered so the squad doesn't fire in volleys). Bullets travel straight up the road from the soldier's own formation position.
- **Formation:** soldiers are arranged in rows centred on the squad position. A row widens until the formation reaches the **width cap of 38% of road width**. After that, new soldiers start additional rows behind. Effect: a bigger squad means more firepower, but coverage is capped, so positioning always matters.
- **Rendering cap:** at most 150 soldiers are drawn. The real count is always shown above the squad. Firepower uses the real count: extra soldiers beyond the drawn 150 raise the fire rate of drawn soldiers proportionally.
- Losing soldiers removes them from the back rows first, and the formation re-flows smoothly.

### 2.5 Entities

| Entity | Shootable | Behaviour |
|---|---|---|
| **Enemy soldier** | Yes (low HP) | Walks toward the squad. On contact: kills 1 soldier and is removed. |
| **Heavy enemy** | Yes (high HP) | Slower, bigger. On contact: kills N soldiers (per level data). |
| **Cage** | Yes (HP) | Static on the road. When its HP reaches 0 it breaks and adds +N soldiers. Unbroken cages scroll past harmlessly. |
| **Number gate** | Yes | Has a value that starts at a level-defined number (often negative), and each bullet hit adds +1. When the squad passes through it, the value is added to the squad count (negative values remove soldiers). Has a horizontal width, so the squad can steer around it. |
| **Hazard** | No | A spinning blade, fire strip or barricade. Any soldier whose position overlaps it is lost. Exists to make squad width a liability. |
| **Boss** | Yes (large HP) | Arrives at the end of the level. Fires projectiles on a pattern. Each projectile that hits kills soldiers in a small radius. |

### 2.6 Difficulty and anti-"watch it play itself"

- The formation width cap (§2.4) keeps aiming relevant at every squad size.
- Hazards force steering even when the squad is dominant.
- Each level's spawn list is authored against an expected squad size, so later levels bring tougher enemies, denser waves and enemies entering at angles.
- The boss's HP is tuned so that a squad which skipped most bonuses struggles to win, which rewards greedy cage-breaking.

### 2.7 Stars and progression

- **1 star:** win. **2 stars:** finish with at least `stars[0]` soldiers. **3 stars:** finish with at least `stars[1]` soldiers. Thresholds are set per level.
- Levels unlock one after another. Progress and best stars per level are saved in `localStorage` (wrapped in try/catch; the game still works without storage).
- No currencies, upgrades, timers, ads or meta-progression.

### 2.8 Juice

Hit flash on damaged entities, confetti when units are lost, floating "+5" / "−3" pop-ups, screen shake on boss hits and boss death, muzzle flashes, and simple sound effects (shoot, hit, gain, lose, win, lose-run). The mute setting is saved.

### 2.9 Out of scope for game one

Weapon types, unit types, upgrades, endless mode, leaderboards, accounts, analytics, mobile-specific layout.

## 3. Architecture

### 3.1 Stack

Plain TypeScript (strict) + Canvas 2D + Vite. No runtime dependencies. Vitest for tests, ESLint for linting. The output is a static build deployed to GitHub Pages through GitHub Actions.

### 3.2 Repo layout

```
hypercaz/
  engine/                 shared, game-agnostic
    loop.ts               fixed-step update (60 Hz) + render with interpolation
    input.ts              mouse/touch/keyboard → normalised targetX, keys, clicks
    scenes.ts             scene stack (push/pop/replace)
    assets.ts             loads a manifest; missing sprites fall back to placeholders
    perspective.ts        world (x, z) → screen (x, y, scale)
    particles.ts          pooled particles (confetti, sparks)
    tween.ts              easing + tweens for UI and pop-ups
    audio.ts              Web Audio wrapper, mute
    storage.ts            safe localStorage wrapper
  games/squad/
    main.ts               boots engine + scenes
    sim/                  pure game logic, no DOM or canvas
      state.ts            types for the game state
      step.ts             step(state, input, dt) → state
      formation.ts        soldier slot layout with width cap
      combat.ts           bullets, collisions, damage
      level.ts            level loading + validation, spawn scheduling
    render/               reads sim state, draws via engine
    scenes/               Title, Play, Results, LevelSelect
    levels/*.json         level data
    assets/               art from Codex + manifest.json
  docs/
    superpowers/specs/    this spec
    art-brief.md          self-contained brief for Codex
  scripts/check-assets.ts validates assets against the manifest
```

### 3.3 The sim/render boundary

- `sim/` is pure TypeScript with no access to DOM, canvas, time or randomness except through its inputs. The randomness source is a seeded PRNG kept in the state, so runs are reproducible.
- `step(state, input, dt)` is the only way the game state changes.
- `render/` only reads state. It never changes gameplay.
- This enables headless unit tests and the bot test, and lets art change without touching logic.

### 3.4 World coordinates and perspective

- `x` ∈ [−1, 1] across the road width. `z` is distance up the road in metres (0 = squad line, positive = further away).
- `perspective.ts` is the only module that knows about screen space: `scale = focal / (focal + z)`, screen y from a horizon line, screen x from road centre × scale.
- Collisions happen in world space only: circles for units and bullets, axis-aligned rectangles for gates and hazards.

### 3.5 Level data

Each level is a JSON file:

```json
{
  "id": 1,
  "name": "First Steps",
  "speed": 6,
  "startSquad": 1,
  "length": 400,
  "stars": [15, 30],
  "spawns": [
    { "z": 40, "x": -0.4, "type": "cage", "hp": 5, "value": 3 },
    { "z": 60, "x": 0.3, "type": "enemy", "hp": 2 },
    { "z": 90, "x": 0.0, "type": "gate", "width": 0.5, "value": -8 },
    { "z": 120, "x": 0.5, "type": "hazard", "kind": "blade", "width": 0.3 }
  ],
  "boss": { "hp": 400, "pattern": "volley3", "fireEvery": 2.5 }
}
```

Levels are validated on load (types, ranges, known entity types). An invalid level fails with a clear error naming the file and field. Tuning a level never needs a code change.

### 3.6 Placeholder art

`assets.ts` reads `manifest.json`. Any sprite that is missing or fails to load is drawn as a labelled coloured shape (blue = player, red = enemy, gold = bonus, striped = hazard) at the manifest-defined size and anchor. The game is fully playable with zero art files.

### 3.7 Error handling

- Asset load failure → placeholder plus a single console warning per asset.
- Invalid level → error screen naming the problem, with a link back to level select.
- `localStorage` unavailable → in-memory progress for the session, no crash.
- Audio context blocked until the first user gesture → audio is started on the "Click to start" click.

### 3.8 Testing

- **Unit (Vitest):** formation layout and width cap, combat and damage, gate value maths, contact losses, hazard overlap, star calculation, level validation, perspective maths.
- **Bot test:** for every level, a scripted bot drives `step()` headlessly (it steers toward the nearest cage when safe, and otherwise toward the nearest threat) and must win. This catches unwinnable levels after tuning changes.
- **Manual:** browser check for feel at each milestone.

### 3.9 Tooling and CI

- `npm run dev`, `build`, `test`, `lint`, `check-assets`.
- GitHub Actions: lint, test, `check-assets`, `npm audit`, build. Deploy to GitHub Pages from `main`.
- `.github/dependabot.yml` for npm and github-actions, weekly, with `cooldown: default-days: 7` on every ecosystem block.
- All changes after the initial commit go through branches and PRs.

## 4. Art pipeline (Codex)

### 4.1 Hand-off process

1. `docs/art-brief.md` is written as a self-contained document: Codex needs nothing else to do its work.
2. Codex works **only** in `games/squad/assets/`, on its own branch, and opens a PR.
3. `npm run check-assets` (also in CI) checks that every manifest entry has a file, that image dimensions match `frameW × frames` by `frameH`, and that there are no unlisted files.
4. The author reviews it in the browser and merges. Art can arrive incrementally, since missing assets use placeholders.

### 4.2 Style guide

- Chibi cartoon soldiers: ~2.5 heads tall, big heads, modern-ish gear (helmet, vest, compact rifle). **Not** tin or plastic toy soldiers.
- Bold shapes, thick dark outlines, flat shading with one highlight tone. Everything must read clearly at ~40 px tall.
- Team colours: **blue** for the player, **red** for enemies, **gold** for bonuses, **orange/black stripes** for hazards. The exact hex palette is defined in the art brief.
- Camera angle: slightly above and behind for the player squad (backs visible), facing the camera for enemies and the boss.
- Cartoon content only. Defeat effects (confetti) are drawn in code, not art.

### 4.3 Technical specs

- PNG with transparency (SVG also accepted), drawn at 2× the in-game size.
- Animations are horizontal strips of equal-width frames.
- The anchor is bottom centre (feet) for units and props, and centre for bullets and effects.
- File names: `snake_case`, `<thing>_<action>.png` (e.g. `soldier_run.png`).
- `manifest.json` entries: `{ "id", "file", "frameW", "frameH", "frames", "fps", "anchor" }`. The schema and starting entries are provided by the code side.

### 4.4 First asset list

| ID | Frames | Notes |
|---|---|---|
| `soldier_run` | 4 | Player soldier, back view |
| `soldier_shoot` | 2 | Player soldier firing |
| `enemy_walk` | 4 | Front view |
| `heavy_walk` | 4 | Bigger, armoured |
| `boss_idle` | 2 | Large armoured tank or mech |
| `boss_damaged` | 2 | Same, visibly battered |
| `cage` / `cage_broken` | 1 each | Contains a blue soldier |
| `gate_positive` / `gate_negative` | 1 each | Frame only; the number is drawn in code |
| `hazard_blade` | 4 | Spinning |
| `hazard_fire` | 3 | Flickering strip |
| `road_tile` | 1 | Tiles vertically |
| `prop_*` | 1 each | 2–3 roadside scenery props |
| `bullet`, `muzzle_flash` | 1 / 2 | Small effects |

### 4.5 Open risk

Codex's exact image capabilities in this setup are unknown. Accepting either PNG or SVG covers both generated raster images and hand-written vector art. If neither produces good results, placeholder shapes remain a fully playable fallback.
