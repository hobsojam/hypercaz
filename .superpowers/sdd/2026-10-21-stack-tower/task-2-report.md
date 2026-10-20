# Task 2 report: Stack simulation

Built `games/stack/sim/{constants,state,step}.ts` and `tests/stack/sim.test.ts` (12 tests).

## Constants
WIDTH 540, BASE_WIDTH 300, PERFECT_TOLERANCE 4, REGROW_FROM 3, REGROW 0.03, SPEED_START 300, SPEED_MAX 700 (px/s), SPEED_FULL_AT 40.
Debris: DEBRIS_GRAVITY 40, DEBRIS_REMOVE_Y 15, DEBRIS_SPIN_MAX 3.

## Notes for Task 3
- Debris `y` is in floor heights, positive down, 0 at the drop point (vy in floors/s, gravity 40 floors/s^2). Multiply by the render floor height.
- On a miss, the moving slab becomes debris and phase goes 'over'. Debris keeps updating after game over.
- `StackState` has one extra field, `rng: number` (seeded via engine/rng, used for debris spin).
- Regrowth widens the slab symmetrically about its centre (x shifts by -grow/2), capped at BASE_WIDTH.
- Moving slab starts left (dir 1) when floor count is even, right (dir -1) when odd; first slab starts left.
- `speedFor(floors)` is exported from step.ts. `step` also exports the `StackInput` type.
- With a full-width base, a miss is geometrically impossible on floor 1 (range of the moving slab always overlaps); the miss test uses a narrow tower.

## TDD
Initial run of `npx vitest run tests/stack/sim.test.ts`: FAIL (modules missing). After implementing, 11/12 passed; one test was wrong (miss at base width is unreachable because slide clamps x), fixed the test to use a narrow tower, then 12/12 pass.

## Verification
- `npx vitest run`: 40 files, 459 tests passed.
- `npx tsc --noEmit`: clean.
- `npm run lint`: fails repo-wide (191 errors) with "No tsconfigRootDir ... multiple candidate TSConfigRootDirs" because of the untracked `.claude/worktrees/aihero` tsconfig; environmental, not from this change. `npx eslint games/stack tests/stack` is clean (rc 0).

## Deviations
None beyond the extra `rng` field.

## Fix round 1
- Bug: start side did not alternate on the first drop (floors 2 and 3 both started left). Parity was inverted relative to createStack; now `fromLeft = floors.length % 2 === 1`.
- Replaced the vacuous alternation test with one asserting left, right, left, right (exact x and dir) for the initial slab and after drops 1-3. Watched it fail on the old code, then pass.
- Edge-drop test now also asserts width is 30.
- Results: vitest 40 files / 460 tests pass, tsc clean, lint clean.
