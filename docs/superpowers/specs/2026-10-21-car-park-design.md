# Car Park

Issue #40 adds a sliding-car puzzle to the shared game picker. The puzzle differs from Arrow Escape because cars stay in the lot and may be repositioned more than once. Players clear a lane so the marked red car can reach the exit on the right.

## Rules

- Each fixed 6×6 puzzle has one horizontal target car on row 2 and several horizontal or vertical blockers. Cars have length 2 or 3 and move only along their own axis. They cannot overlap or cross the lot boundary; reaching the right boundary with the target completes the puzzle.
- A pointer drag previews movement within the uninterrupted legal interval, then snaps to the nearest cell on release. A tap selects a car. Keyboard arrows move a cell cursor; Enter or Space selects its car, and arrows parallel to that car move it one cell. Enter or Space deselects it.
- A move is one completed drag or one keyboard step. Undo restores the previous position; Reset restores the initial arrangement. Both are unlimited. A hint identifies a car, direction and distance for one move on a shortest route from the current arrangement.
- Puzzles are individually selectable. Completion is saved locally under `hypercaz.car-park`, independent of other games. The first incomplete puzzle is shown on return. Pause, mute and All games use shared controls.

## Puzzles and feedback

- Begin with one blocker, then introduce two blockers and a car that must move to create room for another. Later fixed boards add congestion and require temporary moves. Every board starts unsolved and has a verified solution. A breadth-first solver over legal snapped positions powers hints and validation.
- Draw the target in red, blockers in distinct colors, a visible right-side exit, a selected outline and a hint arrow. Keep cars large enough to grab on a phone; announce state changes through the live status element. No timer, score, ads or move limit.

## Boundaries

- The pure simulation owns layout validation, legal ranges, moves and solving. A session owns undo, progress and input mode. The canvas scene maps shared pointer/keyboard input to session actions. The renderer is read-only. The picker, Vite inputs and PWA list include the new route.
- Turning cars, timed traffic, shared exits and 3D views remain outside this first release.

## Verification

- Test movement boundaries, collisions, undo/reset, persisted completion, hint validity and all fixed layouts with an independent solution check. Run typecheck, lint, full suite and production build. Check touch drag, mouse, keyboard, picker progress, phone/desktop layout and offline play in a production browser.
