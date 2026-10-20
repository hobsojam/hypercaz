# Reward forks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put three reward forks into level 6 "Pincer", built only from existing cages and hordes, with tests proving each fork is a real choice.

**Architecture:**
- **Content:** the forks are placed in `games/squad/levels/06.json`; no new engine code.
- **Bot:** gains one rule, choosing between cages that arrive together.
- **Tests:** a new fork test file drives the bot to each fork, clones the state, and plays fixed routes through it.

**Tech Stack:** TypeScript, Vitest, existing sim (`games/squad/sim`).

**Spec:** `docs/superpowers/specs/2026-10-20-reward-forks-design.md`

## Global Constraints

- **No engine changes:** no new spawn types, drawing, sounds, currencies or upgrades.
- **Every level stays winnable:** the bot wins all 10 levels on seeds 1–3 with `stars[0]` soldiers, and standing still loses on levels 3+.
- **Twin cages:**
  - cages at x ≈ ±0.5, arriving at the same z;
  - each cage alone is breakable with normal fire, both are not, with a 20% margin either way;
  - Rapid Fire breaks both;
  - the big cage holds about 2.5× the small one's value.
- **Guarded cage:**
  - "cage only" and "crowd only" end within about 30% of each other in soldiers;
  - ignoring the crowd costs soldiers;
  - the mixed route beats both.

## Review Focus

1. **A squad smaller than the bot's** (a player who lost soldiers earlier) reaches a fork. The small cage should still be breakable, so the fork still offers a safe option. Test: at 0.7× the bot's squad, the small route still collects its cage.
2. **A squad much bigger than the bot's** might collect both twin cages without Rapid Fire, which makes the fork disappear. Accepted at ≥1.5×, because growing a big squad is earned. Test: at 1.2×, "try both" still fails to collect both.
3. **Rapid Fire already spent before fork 3** means the player meets fork 3 without it. They must still be able to win. Covered by the "save it" route test using an empty meter.
4. **Seed variation:** horde positions jitter by seed. Fork tests run on seeds 1–3.
5. **The bot dithers between the two twin cages** and breaks neither. Test: the bot collects at least one cage at every twin fork on seeds 1–3.

---

### Task 1: Fork route tests and bot cage choice

**Files:**
- Create: `tests/squad/forks.test.ts`
- Modify: `games/squad/sim/bot.ts` (cage choice in `steer`)

**Interfaces:**
- **Produces:** `tests/squad/forks.test.ts` helpers.
  - `atFork(seed, z): GameState`: the bot runs until the squad is `z` metres before the fork, i.e. `state.distance >= forkZ - lead`. Check `state.ts` for the travelled-distance field.
  - `route(state, policy, untilZ): GameState`: plays a fixed policy until the fork has passed.
  - Fork positions are read from level 6's cage spawns: two cages with equal z form a twin fork.
- **Bot:** when two or more cages ahead are within 2 m of each other in z, the bot commits to the highest-value one it can still break (existing `breakable`). Otherwise it takes the smaller one. The choice holds until that cage is gone or passed: track it by entity identity in a module-level `WeakMap<GameState, Entity>`.

- [ ] Write the fork tests from the spec's Tests section and the Review Focus items 1, 2, 3 and 5, against the current level 6. Expect them to fail, because there are no twin cages yet.
- [ ] Add the bot's cage choice. Run `npx vitest run tests/squad/sim/bot` and `npx vitest run tests/squad/levels.test.ts`. Expected: still green.
- [ ] Commit.

### Task 2: Level 6 forks, tuned

**Files:**
- Modify: `games/squad/levels/06.json`

- [ ] Using a scratchpad probe, read the bot's squad size and meter along level 6 on seeds 1–3.
- [ ] Place the forks, replacing nearby cage-and-horde beats:
  - fork 1 at about a quarter of the way through the level;
  - fork 2 at about half way;
  - fork 3 at about 70%, where the meter is about full, with a horde about 12 m behind it.
- [ ] Tune hp and values until the fork tests pass on seeds 1–3.
- [ ] Re-settle boss HP and stars with the settle tooling, so the level tests pass.
- [ ] Run `npx vitest run`. Expected: all green.
- [ ] Commit.

### Task 3: Readability check and docs

**Files:**
- Modify: `README.md` (one paragraph on forks)

- [ ] Take headless Chromium screenshots of each fork at 540×960, and check both cages' "+N" and hit labels are legible and the cages don't overlap.
- [ ] Add the README note.
- [ ] Run lint, tsc and the tests.
- [ ] Commit.
