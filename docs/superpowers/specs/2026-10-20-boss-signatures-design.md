# Boss signature attacks: design

Issue: #22, the remaining part after PR #31 ("Bosses open with their attack").

## Intent

Later bosses should feel different because of what they do, not only because of more HP and faster fire. Each new attack teaches one skill, has a warning a player on a phone can read and react to, and rewards a stronger squad with a quicker win.

## The ladder (decided)

| Levels | Signature | What it teaches |
|---|---|---|
| 1–4 | none (today's aimed shells, volleys and summons) | dodge |
| 5–7 | **Strafer** | track a moving target |
| 8–9 | **Charger** | get out of the way, then punish |
| 10 | **Fortress** | find the gap, time Rapid Fire |

My call: levels 6, 7 and 9 reuse the most recent signature. The ladder only named levels ~5, 8 and 10.

A signature adds to the boss's existing pattern, fire rate, advance and summons. It doesn't replace them. Each signature is tuned down where it would make the fight unreadable; see below.

## Signatures

All warnings are drawn on the road in the lane they threaten. They play the existing `warn` sound and show the existing `!` above the boss. My call: no warning is shorter than 1.0 s.

### Strafer (levels 5–7)
- Once settled, the boss slides side to side across the road: x follows a smooth sine between −0.6 and +0.6, with a 6 s period. When enraged the period is 4 s.
- Shells still aim at the squad and keep their launch point. That already works.
- Bullets only hit while lined up, so the player has to follow it. A wider squad (more soldiers) covers more of the road and keeps hitting, so a bigger squad wins faster.

### Charger (levels 8–9)
- **Warning:** every `chargeEvery` seconds (level data, my default 7 s), the boss picks the lane the squad is in and slides to it over the first 0.3 s. A red stripe 0.7 wide (about a third of the road; my call) pulses on the road down to the squad for 1.2 s in total. The lane is fixed when the warning starts.
- **Lunge:** the boss rushes down its lane to the squad's front line in 0.4 s. Soldiers whose formation slot overlaps the stripe are lost (new loss cause `bossCharge`). Being reached by the lunge doesn't end the level the way the existing advance contact does.
- **Exposed:** the boss then stays at the front for 2.5 s, glowing, and takes double damage. After that it walks back to its fighting distance in 1 s.
- **No overlap:** no volleys are fired from the start of the warning until the boss is back. The fire timer pauses, so the stripe is the only thing to read.
- **When enraged:** `chargeEvery` × 0.7.
- **Big squads:** a big squad can be wider than the stripe and lose its edge even after dodging. My call: that's fine. It loses a few but deals much more damage in the exposed window.

### Fortress (level 10)
The boss alternates two phases, a **Barrage** then a **Shield**, starting with the Barrage after its opening volley. Normal volleys stop on this level; the two phases are its attack.

- **Barrage:**
  - Shadows appear on the road across its whole width, except for one clear gap 0.5 wide at a seeded random spot.
  - After 1.5 s, shells land on every shadow. Soldiers in a shadow are lost (`bossShot`).
  - Three barrages per Barrage phase, about 2.5 s apart. Each gap is placed so it can be reached in time from the previous one: at most 0.9 apart.
- **Shield:**
  - A glowing shield appears. While it's up, the boss takes 20% damage.
  - The shield has its own HP (level data, `shieldHp`). Normal bullets damage it ×1; Rapid Fire bullets damage it ×3.
  - The boss keeps summoning crowds during the Shield phase, which gives the meter something to charge on.
  - When the shield breaks, the boss is stunned and takes full damage for 4 s. Then the next Barrage starts.
- **Rapid Fire:** spending it on the shield breaks it in about a second, while normal fire takes about 8 s with the expected squad. Spending it on a crowd or on the bare boss instead is a real trade-off (this also covers part of #23).
- **When enraged:** two barrages per phase instead of three, 2 s apart.

## Data

`boss.signature` is an optional level field: `"strafe" | "charge" | "fortress"`. When it's absent, the boss behaves as today. Validation:
- `chargeEvery` (> 0) is required for charge.
- `shieldHp` (≥ 1) is required for fortress.
- Unknown signatures are rejected with the usual level error.

All randomness (barrage gaps) comes from the seeded game RNG, so runs stay deterministic.

## Bot and balance

- **Bot changes:**
  - Get out of a charge stripe.
  - Move to the barrage gap.
  - On level 10, save a full meter for the Shield phase instead of spending it on the boss the moment it's full.
- **Balance:** after the mechanics land, re-bisect boss HP and `shieldHp` for levels 5–10 with the existing tooling, then recompute stars.
- **Targets:**
  - The bot wins seeds 1–3.
  - Each fight shows its signature at least twice.
  - A squad 50% larger than the bot's finishes the boss noticeably faster, at least 25% faster.

## Drawing

- **No new art:** stripe, shadows, gap, shield ring and exposed glow are canvas shapes in the existing style. Codex can replace them later through the art brief if wanted.
- **The gap reads as a gap:** in the Barrage, the clear gap is the absence of shadow. My call: it's also outlined in green, so the safe spot is obvious at speed.

## Not doing
- Levels 1–4 bosses are unchanged. Level 1 was just reworked in #30.
- No new enemy types, currencies, upgrades or music.
- No change to how the squad aims.

## Tests
- **Sim:**
  - Strafer x stays within ±0.6 and moves.
  - Charger warning lasts ≥ 1.0 s before the lunge, the lunge kills only soldiers in the stripe, the boss takes double damage while exposed, and no volley fires during a charge.
  - Fortress gaps always exist and are reachable, the shield takes 20% / ×3 as specified, phases alternate, and no warning is shorter than 1.0 s.
  - Validation for the new fields.
- **Determinism:** same seed, same fight.
- **Levels:** the existing winnability tests pass for all 10 levels.
- **Squad size:** a test that a 1.5× squad beats the level 5, 8 and 10 bosses faster than the bot's squad.
- **Browser:** check each signature at phone size in headless Chromium, with screenshots of each warning.
- **Real players:** fairness on real phones is checked in your playtest.
