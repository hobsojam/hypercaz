# Ricochet Rescue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Ship eight playable bank-shot rescue puzzles with a standalone entry and a disposable mount API, ready for later picker integration.

**Architecture:** A deterministic swept-collision simulation feeds a small session controller and read-only canvas renderer. Browser lifecycle and input stay in a disposable mount adapter; authored puzzle solutions are independently checked in tests.

**Tech Stack:** Existing TypeScript, Canvas 2D, Vite and Vitest; existing engine utilities and selected sprites. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-20-ricochet-rescue-design.md`

## Global Constraints

- Eight handcrafted portrait puzzles; logical canvas 540×960.
- No advertisements, currencies, countdowns, grind or new dependencies.
- Do not edit the root entry point, package scripts, shared engine, picker, PWA tooling, or Squad Shooter.
- The first release is independently playable at `/games/ricochet/` and builds through its local Vite config.

## Review Focus

- A fast ball crossing a thin wall or reaching an exact corner must bounce rather than tunnel or get stuck.
- A canceled, second-finger or out-of-courtyard release must not spend a shot.
- A preview must agree with live flight, including a cage on a banked path.
- Retry and level selection must reset in-flight state; corrupt/blocked storage must not stop play.
- Disposing and mounting again must not duplicate input listeners or animation; a hidden page must pause.

## Task 1: Deterministic ball and puzzle rules

**Files:** Create `games/ricochet/sim/geometry.ts`, `sim/game.ts`, `levels.ts`; tests under `tests/ricochet/`.

**Interfaces:** Produces `Point`, `Rect`, `Level`, `State`, `createState(level)`, `shoot(state, angle)`, `step(state, dt)`, `preview(state, angle)`, `starsFor(state)` and typed simulation events. The session consumes these without DOM dependencies.

- [x] Write and run failing tests for swept rectangle/circle collisions, exact corners, a straight rescue, a bank rescue, multiple rescues, budget exhaustion, drain/bank return, invalid/double shots and preview/live agreement. Expected: missing implementation or failing behavior.
- [x] Implement the exact geometry/constants from the spec with finite collision iteration and no randomness in simulation.
- [x] Author eight validated layouts with varied bank decisions. Put known par solutions only in tests and verify them through `shoot` + `step`. Expected: all eight win at par and each malformed geometry fixture is rejected.
- [x] Run the task's focused tests and commit the simulation and level deliverable.

## Task 2: Playable session and presentation

**Files:** Create `games/ricochet/session.ts`, `render.ts`, `assets.ts`; session/render tests.

**Interfaces:** Consumes Task 1 exports. Produces `Session` with explicit aim/fire/retry/select/pause/update commands and read-only render data; renderer consumes Session + AssetStore. Persist best stars in a dedicated `hypercaz.ricochet` namespace through injected storage.

- [x] Write/run failing tests for progression, retry reset, pause, results, saved best sanitization and render phases. Expected: missing behavior.
- [x] Implement the session with small named operations; keep DOM events out. Draw the courtyard, target/cage art, trajectory preview, shot/rescue/par HUD, short rescue effects and accessible-sized menu controls.
- [x] Reuse only selected cage and soldier sprite entries and existing sound effects. Verify instructions and result messages through real renderer output.
- [x] Run all task tests and commit.

## Task 3: Standalone browser adapter and review

**Files:** Create `games/ricochet/mount.ts`, `main.ts`, `index.html`, `vite.config.ts`, `README.md`; input/lifecycle tests.

**Interfaces:** Consumes Session/renderer. Produces `mountRicochet(canvas, options?) => Promise<() => void>`; the returned disposer is idempotent. Boot mounts only from its own standalone HTML.

- [x] Write/run failing browser-adapter tests for cancellation, one active pointer, button/aim separation, keyboard controls, hiding and disposal. Expected: missing behavior.
- [x] Implement abortable listeners, pointer capture, DPR/letterbox resizing, sound unlock/mute, failure fallback and loop teardown.
- [x] Run the full repository suite, build/lint/diff checks and standalone build. Expected: all green without shared-infrastructure edits.
- [x] Exercise actual touch, mouse and keyboard in a browser, solve a bank puzzle and complete a level, check phone and desktop layouts and mount/dispose.
- [x] Request independent whole-branch review, resolve material findings, re-verify, then commit and open a PR. Document the direct URL, build command and deferred picker wiring.

## Verification record

- Baseline: 440 tests across 38 files pass on updated main.
- Tasks 1–2: 34 physics/level cases and 16 session/control/render cases pass. Every puzzle has an independent par solution.
- Browser: touch, mouse and keyboard exercise real input; all eight puzzles solve at par. Saved stars, canceled/outside releases and actual mount/dispose were checked with no browser errors.
- Final validation: 495 tests across 44 files pass, including 55 Ricochet cases. TypeScript, ESLint, root and standalone production builds and diff checks pass.
- Independent branch review found a startup-failure cleanup leak. Added a failing regression, fixed initialization to reuse idempotent cleanup, and verified failed startup followed by remount. Added live exact-corner reflection coverage.
- Repeated Chromium checks on the final implementation: all eight puzzles at par, no browser errors, and zero pending animation callbacks after disposal. Phone and desktop captures inspected.
- Latest fetched main remains `1fa6c7f`; the task branch already contains it. Changes are limited to game, tests and these planning documents.
