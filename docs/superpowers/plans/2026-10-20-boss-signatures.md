# Boss Signature Attacks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the level 5–10 bosses readable signature attacks (Strafer, Charger, Fortress), as the spec describes.

**Architecture:** Signatures live in a new sim module, `games/squad/sim/signature.ts`. `boss.ts` calls it from `fight()`. Attack state sits on `Boss.attack`, a tagged union, so the renderer and the bot read it directly. Damage changes (exposed ×2, shield) go through one function, `bossDamageFactor()`, that `combat.ts` applies. Everything stays pure and seeded.

**Tech Stack:** TypeScript, Vitest, Canvas 2D.

**Spec:** `docs/superpowers/specs/2026-10-20-boss-signatures-design.md`

## Global Constraints

- The sim stays pure and deterministic. All randomness comes from `state.rngState` via `nextFloat`.
- No warning is shorter than 1.0 s.
- Levels 1–4 are unchanged. Level files without `signature` behave exactly as today.
- No new art files. Drawing uses canvas shapes in the existing style (outline `#1A1A2E`, warning orange `#FF8A1F`, danger red `#E04040`).
- Each commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A charge lane at the road edge.** The squad must still have a reachable dodge side, or else the bot and the player take the smallest loss.
2. **Enrage starting mid-attack.** The new timings apply to the next attack only, never to the one in progress.
3. **The boss dying mid-lunge or mid-barrage.** No losses land after `won`.
4. **Squad wiped by a lunge or barrage.** `lost` is raised exactly once.
5. **A barrage gap at ±1.** The gap stays fully on the road.

---

### Task 1: Level data and boss state

**Files:**
- Modify: `games/squad/sim/level.ts`, `games/squad/sim/state.ts`, `games/squad/sim/constants.ts`
- Test: `tests/squad/sim/level.test.ts`

**Interfaces:**
- **Produces:**
  - `Level['boss']` gains `signature: 'strafe' | 'charge' | 'fortress' | null`, `chargeEvery: number` (0 unless charge) and `shieldHp: number` (0 unless fortress).
  - `Boss` gains:
    - `attack: BossAttack | null`
    - `signatureTimer: number`, seconds until the next charge or barrage phase
    - `strafeT: number`
  - The attack type:
    ```ts
    type BossAttack =
      | { kind: 'charge'; stage: 'warn' | 'lunge' | 'exposed' | 'return'; t: number; laneX: number; fromX: number }
      | { kind: 'barrage'; t: number; gapX: number; left: number } // t counts down to landing; left includes this one
      | { kind: 'shield'; hp: number; maxHp: number }
      | { kind: 'stunned'; t: number };
    ```
  - `LossCause` gains `'bossCharge'`.
  - `GameEvent` gains `{ type: 'bossCharge'; x: number }`, emitted at lunge start, plus `{ type: 'bossBarrage' }`, `{ type: 'shieldUp' }` and `{ type: 'shieldBreak' }`.
  - Constants, with the spec's values:
    ```
    STRAFE_RANGE 0.6, STRAFE_PERIOD 6, STRAFE_PERIOD_ENRAGED 4,
    CHARGE_WARN 1.2, CHARGE_SLIDE 0.3, CHARGE_LUNGE 0.4, CHARGE_EXPOSED 2.5, CHARGE_RETURN 1,
    CHARGE_HALF_W 0.35, CHARGE_ENRAGED 0.7, EXPOSED_DAMAGE 2,
    BARRAGE_WARN 1.5, BARRAGE_GAP 0.5, BARRAGE_MAX_SHIFT 0.9,
    BARRAGE_COUNT 3, BARRAGE_COUNT_ENRAGED 2, BARRAGE_SPACING 2.5, BARRAGE_SPACING_ENRAGED 2,
    SHIELD_DAMAGE 0.2, SHIELD_BURST 3, STUN_SECONDS 4
    ```

- [ ] **Step 1: Failing tests** in `level.test.ts`:
  - `'boss signature defaults to none'`: `signature` is `null`, `chargeEvery` is 0 and `shieldHp` is 0.
  - `'charge needs chargeEvery > 0'`: throws a message naming `boss.chargeEvery`.
  - `'fortress needs shieldHp >= 1'`: throws a message naming `boss.shieldHp`.
  - `'unknown signature is rejected'`: throws a message naming `boss.signature`.
- [ ] **Step 2:** Run `npx vitest run tests/squad/sim/level.test.ts`. Expected: 4 FAIL.
- [ ] **Step 3:** Implement the validation and the types. `createState` and `updateBoss` initialise `attack: null`, `signatureTimer: chargeEvery || BARRAGE_SPACING` and `strafeT: 0`.
- [ ] **Step 4:** Run `npx vitest run`. Expected: all pass.
- [ ] **Step 5:** Commit: "Boss signatures: level fields and boss attack state".

### Task 2: Strafer

**Files:**
- Create: `games/squad/sim/signature.ts`
- Modify: `games/squad/sim/boss.ts`
- Test: `tests/squad/sim/signature.test.ts`

**Interfaces:**
- **Produces:** `updateSignature(state: GameState, dt: number): void`, called from `fight()` before the fire timer. `fight()` skips the volley timer when `signature === 'fortress'`, or when `attack?.kind === 'charge'`.

- [ ] **Step 1: Failing tests** (`describe('strafer')`):
  - `boss.x` stays in [−0.6, 0.6] over 20 s, and reaches both |x| > 0.5 sides.
  - After `bossEnrage`, a full side-to-side cycle takes about 4 s instead of about 6 s.
  - A boss without a signature keeps `x === 0`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. `strafeT += dt × (2π / period)` and `x = STRAFE_RANGE × sin(strafeT)`. Advancing the phase keeps x continuous when the period changes on enrage.
- [ ] **Step 4:** Run `npx vitest run`. Expected: all pass.
- [ ] **Step 5:** Commit: "Strafer boss signature".

### Task 3: Charger

**Files:**
- Modify: `games/squad/sim/signature.ts`, `games/squad/sim/combat.ts`, `games/squad/sim/contact.ts`
- Test: `tests/squad/sim/signature.test.ts`

**Interfaces:**
- **Produces:** `bossDamageFactor(state: GameState): number`, exported from `signature.ts`:
  - 2 while the charge stage is `'exposed'`;
  - `SHIELD_DAMAGE` while shielded (Task 4);
  - otherwise 1.

  `applyBossHit` multiplies the damage by it.

- [ ] **Step 1: Failing tests** (`describe('charger')`, with `signatureTimer` forced to 0 to start a charge):
  - The warning starts on the squad's lane. `laneX` equals `squad.x` at the start, clamped to ±(1 − CHARGE_HALF_W). It lasts ≥ 1.0 s before `bossCharge` is emitted.
  - A squad that stays in the lane loses soldiers with cause `bossCharge`. A squad that moves ≥ CHARGE_HALF_W + its half-width away loses none.
  - While exposed, one bullet of damage d removes 2d boss HP.
  - No `bossFire` events from the warning start until the stage returns to `null`.
  - The lunge reaching the squad does not raise `bossContact` or end the level unless every soldier is in the stripe.
  - After `bossEnrage`, the next charge interval is `chargeEvery × 0.7`.
  - Boss killed during `'exposed'`: the level is won and no later losses happen.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement the stage machine:
  - **warn:** slide x from `fromX` to `laneX` over CHARGE_SLIDE, holding z. Total length CHARGE_WARN; emit `bossWindup` at the start.
  - **lunge:** z goes from BOSS_Z to BOSS_HALF_D over CHARGE_LUNGE, and the hit is applied once at the end. Kills use `soldiersHit(state, slots, laneX, CHARGE_HALF_W)`, cause `bossCharge`.
  - **exposed:** hold for CHARGE_EXPOSED.
  - **return:** z goes back to BOSS_Z over CHARGE_RETURN.
  - **after:** `attack = null` and the timer resets.

  While a charge runs, the strafe and the advance pause.
- [ ] **Step 4:** Run `npx vitest run`. Expected: all pass.
- [ ] **Step 5:** Commit: "Charger boss signature".

### Task 4: Fortress

**Files:**
- Modify: `games/squad/sim/signature.ts`, `games/squad/sim/contact.ts`
- Test: `tests/squad/sim/signature.test.ts`

**Interfaces:**
- **Produces:** `soldiersOutside(state: GameState, gapX: number, halfGap: number): number` in `contact.ts`, mirroring `soldiersHit`'s rounding.

- [ ] **Step 1: Failing tests** (`describe('fortress')`):
  - **Phase order:** after the opening, the phases alternate: barrage ×3 → shield → stunned (4 s) → barrage. Enraged: ×2 barrages, 2 s apart.
  - **Barrage warning:** each barrage warns ≥ 1.5 s, measured from the `bossBarrage` event to landing.
  - **The gap:** `gapX` is always within ±(1 − BARRAGE_GAP/2). Consecutive gaps are ≤ BARRAGE_MAX_SHIFT apart, checked over seeds 1–20.
  - **Landing:** a squad centred in the gap with a half-width ≤ gap/2 loses nothing; a squad outside the gap loses soldiers (`bossShot`).
  - **Shield:** while it's up, normal bullets take 20% off the boss and 100% off the shield. During a burst the shield takes ×3. A broken shield emits `shieldBreak` and gives `stunned`.
  - **Fire and summons:** no `bossFire` on a fortress level, and summons only happen during shield or stunned.
  - **Determinism:** the same seed gives the same gaps.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. Gap choice: `gapX = clamp(prev + (r × 2 − 1) × BARRAGE_MAX_SHIFT, ±(1 − BARRAGE_GAP/2))`, with `prev` being the squad x for the first barrage. Shield damage is routed through `bossDamageFactor` plus a shield branch in `applyBossHit`: when shielded, the shield HP drops by `damage × (burst ? SHIELD_BURST : 1)` and the boss HP drops by `damage × SHIELD_DAMAGE`.
- [ ] **Step 4:** Run `npx vitest run`. Expected: all pass.
- [ ] **Step 5:** Commit: "Fortress boss signature".

### Task 5: Drawing and sound

**Files:**
- Modify: `games/squad/render/draw.ts`, `games/squad/render/effects.ts`
- Test: `tests/squad/render.test.ts`, `tests/squad/effects.test.ts`

- [ ] **Step 1: Failing tests:**
  - Rendering a state with each attack kind and stage doesn't throw.
  - A charge warning draws a filled stripe: `fill` is called with the `#E04040` style.
  - A barrage draws a green (`#5BE37A`) outlined gap.
  - The shield draws its HP label.
  - In effects, `bossCharge` plays `boss`, `bossBarrage` plays `warn`, and `shieldBreak` plays `hit` with `kick(6)`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement the shapes, projected on the road with `project()`:
  - the stripe from the boss to the squad, pulsing;
  - shadows across the road with the gap left clear and outlined;
  - a shield ring around the boss with its HP;
  - an exposed glow.
- [ ] **Step 4:** Run `npx vitest run`. Expected: all pass.
- [ ] **Step 5:** Commit: "Draw and sound boss signatures".

### Task 6: Bot

**Files:**
- Modify: `games/squad/sim/bot.ts`
- Test: `tests/squad/sim/signature.test.ts` (bot section)

- [ ] **Step 1: Failing tests:**
  - With a charge in its warning stage on the squad's lane, `botInput` targets a x outside the stripe.
  - With a barrage pending, it targets `gapX`.
  - On a fortress level, with a full meter and no shield up, it doesn't burst. With the shield up, it does.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement as a new step 0b, after the shell dodge: charge dodge to the nearer reachable side, otherwise the farther one; barrage goes to the gap. In `wantsBurst`, fortress bursts only on the shield.
- [ ] **Step 4:** Run `npx vitest run`. Expected: all pass.
- [ ] **Step 5:** Commit: "Bot handles boss signatures".

### Task 7: Levels, balance and verification

**Files:**
- Modify: `games/squad/levels/05.json`–`10.json`, `README.md`
- Test: `tests/squad/levels.test.ts`

- [ ] **Step 1: Failing test** in `levels.test.ts`, `'a 50% bigger squad beats the boss at least 25% faster'`, for levels 5, 8 and 10 on seed 1. Start the boss fight directly: build the state, set `phase = 'boss'`, with the squad at the bot's arrival count versus 1.5× that, and compare the boss-phase seconds.
- [ ] **Step 2:** Set the signatures: 05–07 `strafe`, 08–09 `charge` with `chargeEvery: 7`, and 10 `fortress` with a placeholder `shieldHp`. Run `npx vitest run tests/squad/levels.test.ts`. Expected: some FAIL (balance).
- [ ] **Step 3:** Re-bisect boss `hp` (and `shieldHp` for level 10) with the scratchpad tooling: the bot wins seeds 1–3, keeping ≥ 35% of its peak, with an HP × 0.8 margin. Then recompute stars as [0.6, 0.9] × the minimum final count.

  Check that each fight shows its signature at least twice (`bossCharge` events, or full strafe sweeps, or the barrage and shield cycle completing).
- [ ] **Step 4:** Run `npx vitest run`, `npx eslint .` and `npx tsc --noEmit`. Expected: all pass.
- [ ] **Step 5:** Browser check: `npm run dev` plus the scratchpad driver at 540×960. Take screenshots of a strafe, a charge warning, a lunge, a barrage warning and the shield. Read each one.
- [ ] **Step 6:** README: one line per signature under the game description. Commit: "Boss signatures on levels 5–10, rebalanced". Push, then open a PR that closes #22.
