# Arrow Escape implementation plan

**Goal:** Add 12 playable arrow-removal puzzles with picker and offline integration, preserving Claude's active Water Sort checkout.

**Spec:** `docs/superpowers/specs/2026-10-21-arrow-escape-design.md`

**Architecture:** Pure board rules/validation feed a DOM-free session. One scene maps engine input to commands and delegates drawing to a read-only renderer. Existing boot owns browser lifecycle. Native implementation in an isolated task worktree from updated main.

## Constraints and review focus

- No new dependencies, assets, timers, lives, monetization or shared-engine edits.
- Readonly definitions and stable references; mutable live state only where needed.
- A long shaft blocks just like a head. Every direction and board edge must work.
- Blocked/missing/removed ids must never change the board; no second removal during a flight.
- Retry/select/hidden-tab transitions must not carry stale animation, hint or input into a puzzle.
- Corrupt/blocked storage must not prevent play or count unknown ids as complete.
- All 12 layouts must be independently solvable; taking any legal move must preserve solvability.

## Task 1: Rules and puzzles

Files: `games/arrows/sim.ts`, `levels.ts`; `tests/arrows/sim.test.ts`, `levels.test.ts`.
Interfaces: readonly `Arrow`, `Puzzle`, `Cell`; `cells(arrow)`, `blocker(puzzle, remaining, id)`, `removable(puzzle, remaining)`, `remove(state,id)`, `validatePuzzle(puzzle)`, `createState(puzzle)` and `PUZZLES`.

- [x] Write failing rule tests: four directions, adjacent/distant/shaft/nearest blockers, off-ray and behind-head cases, blocked/missing/already removed no-op and last removal.
- [x] Implement bounded grid/ray rules with small helpers and reject invalid geometry, duplicate ids, overlap and dependency cycles.
- [x] Author 12 fixed puzzles and independently solve them from occupied cells in tests; verify every legal first choice remains solvable.
- [x] Run focused rule/layout tests and commit.

## Task 2: Session, rendering and controls

Files: `games/arrows/progress.ts`, `session.ts`, `layout.ts`, `render.ts`, `scene.ts`, `game.ts`; corresponding session/scene/render tests.
Interfaces: `Session` with select/retry/attempt/hint/togglePause/update, explicit screen/focus/flight/feedback and sanitized completion; game adapter uses existing engine input/audio/storage/SceneStack and a status callback.

- [x] Write failing tests for hints, animated removal lock, delayed success, pause/hide, retry/select reset, saved completion, mute and corrupt/blocked progress.
- [x] Implement session rules and a readable portrait canvas with blocked ray/first blocker feedback, exit flights, visible keyboard cursor, puzzle grid and success panel.
- [x] Test touch/mouse hit mapping across the full shaft, keyboard selection and activation, menu/pause buttons and navigation; render each screen without changing state.
- [x] Run focused tests and commit.

## Task 3: Browser and integration

Files: `games/arrows/main.ts`, `arrows/index.html`; picker main/tiles, root HTML, Vite/PWA config, README and picker/PWA tests.

- [x] Write failing picker/progress and precache assertions, then add the game tile, HTML entry, live status and boot adapter.
- [x] Verify types, lint, root build, diff and the full repository suite; resolve failures without changing Claude's checkout.
- [x] Browser-check phone and desktop, pointer/keyboard puzzle wins, hints/blocked feedback, pause/tab hide, puzzle selection, return progress and static production offline play.
- [x] Request an independent final review, fix material findings, re-verify, commit and publish a PR from current main. Record evidence here.

## Verification record

- Baseline main: 564 tests across 50 files pass.
- Task 1: 32 rule/layout tests pass, including all 12 independent puzzle solutions and every available legal first removal. TypeScript and diff checks pass.
- Task 2: all 46 Arrow Escape rule, session, input, layout and rendering tests pass; typing/lint/diff checks pass.
- Final focused verification: 51 Arrow Escape cases plus 15 picker/PWA cases pass (66 total). Full suite: 618 tests across 54 files pass. TypeScript, lint, production build and diff checks pass.
- Independent review found queued activation on tab hide and a misleading grid return action. Both were reproduced with failing tests, fixed, and verified green; return now preserves partial attempts and a final flight.
- Static production Chromium run: every puzzle cleared with actual touch input; independent keyboard-only and mouse wins; blocked feedback, hint and pause exercised; complete progress shown on picker return; offline game play works with no browser errors. Phone and DPR-2 desktop captures inspected.
- Final fetch: main remains `5c3d5d8`, already contained in the task branch. Claude's active Water Sort checkout was not modified.
- Car repositioning puzzle recorded separately in GitHub issue #40.
