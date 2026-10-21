# Following-tail arrows

User selected following-tail movement after comparing it with rigid bent pieces. This is an extension of the existing Arrow Escape flow; the updated Arrow Escape spec is authoritative. Keep the shared engine, picker routes, puzzle ids and saved completion unchanged. Work in `agent/arrow-following-tails` from main `7254d8b`.

## Rules and motion

- [x] Replace implicit straight bodies with readonly, ordered cell paths; retain head direction for one-cell arrows.
- [x] Test and validate orthogonal continuity, no repeated/overlapping/out-of-bounds cells, matching head tangent, clear own-body exit ray and an acyclic removal graph.
- [x] Use the actual head for exit-ray blocking; an elbow does not translate sideways into another piece.
- [x] Implement a constant-length moving window over the original path extended by the head's exit ray. Test fractional turns, two bends, all directions, full tail clearance and one-cell arrows.

## Presentation and boards

- [x] Draw a continuous rounded ribbon, a single head and complete-path highlights; use the same motion geometry for flight rendering.
- [x] Keep puzzles 1–2 unchanged; introduce L and two-bend arrows in 3–4, then mix bent/straight arrows through the remaining fixed boards.
- [x] Independently solve every board and every legal first removal. Verify clicking tail/elbow/head and preserving immutable level data during animation.
- [x] Run full suite, typing/lint/build/diff checks, independently review and resolve material findings.
- [x] Browser-check touch/keyboard/mouse, blocked elbows, mid-flight shape, pause/retry, all boards, phone/desktop and offline production play.

## Evidence

- New bent collision and motion tests failed before implementation. Focused tests now cover the canonical paths, independent solutions and integration.
- A candidate tutorial cycle was rejected by the independent authoring solver and corrected before shipping.
- 738 tests passed across 63 files, including 80 focused Arrow Escape/picker tests. TypeScript, ESLint, production build and diff checks passed. Independent review found no material issues.
- Production Chromium cleared all 12 puzzles through touch input, then won by keyboard and mouse. It checked blocked feedback, hints, pause, retry, saved progress and offline play on phone and desktop; no page errors when running headless without an audio device. Exact-time captures show one- and two-bend bodies following their original routes in flight.
- Latest fetched `origin/main` remains `7254d8b`.
