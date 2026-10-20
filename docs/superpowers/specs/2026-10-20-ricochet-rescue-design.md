# Ricochet Rescue

## Intent and boundaries

Build the proposed small bank-shot rescue puzzle as a standalone game. Claude owns the game picker and shared infrastructure; this branch must not edit the root entry point, package scripts, shared engine, picker, PWA tooling, or Squad Shooter. Start from freshly fetched main in an isolated worktree. Reuse existing engine utilities, sounds and selected Squad sprites by import.

The first release has eight handcrafted portrait puzzles. Aim a ball from a fixed launcher, bounce off courtyard walls and obstacles, and break every cage. Each attempt has a small shot budget; collected rescues persist between its shots. Three stars reward finishing at or below the level's par, two for par + 1, and one for any other successful attempt. Retry is immediate and unlimited. All puzzles are selectable. No advertisements, currencies, countdowns, grind or new dependencies.

## Play and presentation

Use a logical 540×960 canvas. The playable courtyard is x=28..512, y=170..790; launcher centre is (270, 764). The ball radius is 8, cages have radius 25, and shot speed is 540 logical pixels/second. Targets are broken on contact and do not reflect the ball. Courtyard sides and top and fixed rectangular obstacles reflect it; the bottom returns it. A shot also returns after eight wall contacts, preventing trapped orbits. Show this rule alongside the instructions.

Drag within the courtyard to aim upward; release to fire. Releasing below the launcher or outside the courtyard cancels. Pointer cancellation never fires. Track one pointer only. Show a dotted preview through the first two banks using the same collision rules as play. Keyboard arrows adjust aim, Space fires, R retries, Esc pauses and M toggles sound. Enter advances from a win. HUD and menu buttons are separate from aiming, with generous touch targets.

Use a bright courtyard, teal raised walls, a blue launcher, gold rescue cages and the existing blue soldiers. Successful rescues produce short sparkles and freed soldiers; banks produce a brief impact cue. Distinguish aiming, a flying ball, a win and an exhausted attempt clearly. Show shots remaining, rescues and par. After a win show stars and Next/Retry/Levels; after an exhausted attempt show rescues achieved and Retry/Levels. Give the first levels contextual instructions about aiming and banks. Portrait phone and desktop both use letterboxing and device pixel ratio scaling.

## Code boundaries

- `games/ricochet/sim/geometry.ts`: continuous collision queries for boundaries, expanded rectangles and target circles. A deterministic point-vs-expanded-rectangle rule defines obstacle corners.
- `games/ricochet/sim/game.ts`: deterministic state, shot acceptance, continuous flight, events, preview and scoring. No DOM or asset dependencies. One path serves preview and live motion.
- `games/ricochet/levels.ts`: eight typed authored levels and runtime validation. Keep published levels separate from test solution angles.
- `games/ricochet/session.ts`: level selection, aim, retry/pause/results and saved best scores, independent of browser events.
- `games/ricochet/render.ts`: read-only courtyard, guide, sprites, effects and menus; smaller helpers per visual responsibility.
- `games/ricochet/mount.ts`: resizes and runs a session, loads selected assets, attaches abortable input and audio. Export an async mount function returning an idempotent disposer. No picker dependency.
- `games/ricochet/index.html`, `main.ts`, `vite.config.ts`: local standalone page, boot and isolated build config. Development URL `/games/ricochet/`; standalone production build uses this config and an explicit output folder.
- `games/ricochet/README.md`: commands, controls, mount contract and later integration boundary.

Reuse `engine/loop`, letterbox utilities, `engine/assets`, `engine/audio` and namespaced `engine/storage`. Use only cage, broken-cage and soldier sprites; do not load all Squad art or its music. Missing/blocked storage must not prevent play. Lifecycle disposal stops animation, releases pointer capture, removes listeners and silences audio. Hiding the page pauses play; resuming requires an explicit gesture.

## Collision and level checks

Find the earliest swept collision within each fixed step, consume that travel time, resolve it, then continue with remaining time. A simultaneous corner reflects both components. Resolve coincident cage hits without duplicates. Prevent tunnelling through thin walls and repeated zero-time wall contacts. A finite per-step collision limit is a defensive guard, not normal shot scoring.

Validate finite geometry, positive shot budgets and par, unique target IDs, targets and walls inside the courtyard, no overlaps or blocked launcher, and at least one target. Keep the published levels' known successful shot sequences in tests. Tests must prove all eight can be completed at par through the real simulation, not just validate JSON or sample the preview.

## Verification

Cover straight and banked rescues, multiple rescues per shot, continuous thin-wall collision, corner reflection, drain and bank limit, invalid/double shots, cancellation and multiple pointers, preview agreement, retry, score persistence, pause and mount/unmount. Run all repository tests, TypeScript/build/lint, and a standalone build. Browser checks use actual mouse, touch and keyboard, verify first-level instructions/results, at least one bank puzzle, phone/desktop text fit, no console errors and a clean mount/dispose cycle.

Human sessions remain necessary to judge puzzle difficulty and whether the short instructions communicate the mechanic. Picker integration is deliberately left for later.
