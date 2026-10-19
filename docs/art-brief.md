# Squad Shooter — Art Brief

This brief is everything you need to produce the art for **Squad Shooter**, the first game in the `hypercaz` collection. You don't need to read any code.

## 1. Context

Squad Shooter is a 2.5D browser game in the style of the "army" adverts for mobile games like Top War and Last War. The player's squad of soldiers stands at the bottom of a road that stretches into the distance. They fire automatically up the road while the player slides them left and right to shoot enemies, break open cages of extra soldiers, shoot number gates up into the positives, and dodge hazards. Each level ends with a big boss.

The game has no ads and no monetisation. It's just for fun, played by a small group of friends.

## 2. Your scope

- Work **only** in `games/squad/assets/`. Don't touch code or any other folder.
- Work on your own git branch and open a pull request when a batch is ready.
- For each asset you deliver, add the file to `games/squad/assets/` and set that entry's `"file"` in `games/squad/assets/manifest.json` from `null` to the file name (e.g. `"file": "soldier_run.png"`).
- **Don't change** `id`, `frameW`, `frameH`, `frames`, `anchor` or `group` in the manifest. The code depends on them. If a size genuinely doesn't work, say so in the PR description instead.
- You can deliver assets in any order and in several PRs. Anything not delivered yet appears in-game as a coloured placeholder box.

## 3. Style guide

**Characters**
- Chibi cartoon soldiers about **2.5 heads tall**, with big heads and short, sturdy bodies.
- Modern-ish gear: a rounded helmet, a chunky vest and a compact rifle held across the body.
- They are **not** tin soldiers, plastic army men or toy figures. They are cartoon *people*: friendly, a bit goofy, determined.
- Expressions are simple: dot eyes, a small mouth, eyebrows for attitude.

**Rendering**
- Bold, simple shapes with a **thick dark outline** (`#1A1A2E`, about 3–4 px at the 2× drawing size).
- **Flat shading:** one base colour, one shadow tone and at most one highlight. No gradients, no texture noise, no soft airbrushing.
- Everything must **read clearly at about 40 px tall** on screen. Test this by shrinking your image to 25%: if you can still tell what it is and which team it's on, it works.

**Team colours (exact palette)**

| Role | Base | Shade | Light |
|---|---|---|---|
| Outline (everything) | `#1A1A2E` | | |
| Player team (blue) | `#2F7DE1` | `#1B4F99` | `#7FB2F0` |
| Enemy team (red) | `#E04040` | `#9A2222` | `#F08A8A` |
| Bonus (gold): cages, positive gates | `#F5C242` | `#B8861B` | |
| Hazard: orange and black stripes | `#FF8A1F` | `#1A1A1A` | |
| Road | `#6B6F7A` | | |
| Grass / roadside | `#6CBF4B` | | |

Skin tones and hair are up to you, with variety welcome. Team colour should dominate each unit (helmet, vest and so on), so a glance tells blue from red.

**Camera angle**
- **Player soldiers:** seen from **slightly above and behind**, so we see their backs as they face up the road.
- **Enemies, heavies and the boss:** seen from **slightly above and in front**, facing the camera as they come down the road toward the player.
- **Objects** (cages, gates, hazards, props): slightly above, from the front.

## 4. Technical rules

- **Format:** PNG with transparency, or SVG. Both work. Use 8-bit RGBA for PNG.
- **Draw at 2× the in-game size.** The sizes in the asset table *are* the 2× sizes. The game halves them on screen.
- **Animations are horizontal sprite strips:** frames side by side, left to right, all the same width and with no gaps. The total image width is `frameW × frames` and the height is `frameH`. For example, `soldier_run` (64×80, 4 frames) is one 256×80 image.
- **Anchor:**
  - `bottom` assets are positioned by the **bottom centre** of the frame, i.e. the character's feet. Put the feet at the bottom edge, horizontally centred, with no empty space below them.
  - `center` assets (bullet, muzzle flash) are positioned by their centre.
- **Keep every frame inside its box.** Nothing may cross into the neighbouring frame.
- **Stretched assets:** `gate_positive`, `gate_negative`, `hazard_fire` and `hazard_barricade` are **stretched horizontally** in game to whatever width the level asks for. Put the detail (posts, ends, caps) in the outer 20% on each side, and keep the **middle 60% plain and evenly repeatable**, so stretching looks natural.
- **Number gates:** the gate's number (e.g. "+6" or "−12") is drawn by the game on top of the gate. **Don't draw any numbers or text.** Leave a clear, fairly plain panel in the middle where the number will go.
- **Road tile:** `road_tile` is repeated **vertically** down the road, so its top and bottom edges must join seamlessly. Show the road surface only (asphalt plus edge lines), with no grass. Note that it's displayed in perspective.
- **File names:** `snake_case`, matching the `id` (e.g. `heavy_walk.png`).

## 5. Asset table

| id | File | Frame (2×) | Frames | fps | View | Description |
|---|---|---|---|---|---|---|
| `soldier_run` | `soldier_run.png` | 64×80 | 4 | 10 | back | Player soldier running up the road, rifle raised. A run cycle with frames 1 and 3 as contact poses. |
| `soldier_shoot` | `soldier_shoot.png` | 64×80 | 2 | 12 | back | Player soldier firing: frame 1 normal, frame 2 recoil. |
| `enemy_walk` | `enemy_walk.png` | 64×80 | 4 | 8 | front | Red enemy soldier marching toward the camera. Same build as the player, red gear, a meaner brow. Enemies come in packed crowds of up to 70, overlapping each other, so keep the silhouette simple and the red strong; it must still read as a mass of red soldiers when dozens overlap. |
| `heavy_walk` | `heavy_walk.png` | 96×112 | 4 | 6 | front | Big armoured red brute with a shield or heavy plating, slow and stompy. Clearly tougher than `enemy_walk`. |
| `boss_idle` | `boss_idle.png` | 320×256 | 2 | 3 | front | Level boss: a big chunky red armoured tank or mech with a cannon pointing at the camera. Frame 2 is a slight bob or idle shift. |
| `boss_damaged` | `boss_damaged.png` | 320×256 | 2 | 3 | front | The same boss, visibly battered: dents, sparks, smoke puffs, a bent barrel. Same silhouette and position as `boss_idle`. |
| `cage` | `cage.png` | 96×112 | 1 | – | front | Gold-barred cage holding one worried-looking **blue** soldier waving for help. |
| `cage_broken` | `cage_broken.png` | 96×112 | 1 | – | front | The same cage with its bars burst open and empty. |
| `gate_positive` | `gate_positive.png` | 256×96 | 1 | – | front | Gate frame (two posts plus a top banner) in green-gold tones meaning "good". Plain centre panel for the number. Stretched horizontally. |
| `gate_negative` | `gate_negative.png` | 256×96 | 1 | – | front | The same gate shape in red tones meaning "bad". Plain centre panel. Stretched horizontally. |
| `hazard_blade` | `hazard_blade.png` | 128×128 | 4 | 12 | front | Spinning saw blade on a striped base, as a 4-frame spin cycle. |
| `hazard_fire` | `hazard_fire.png` | 256×64 | 3 | 10 | front | A low strip of flames across the road, as a 3-frame flicker. Stretched horizontally. |
| `hazard_barricade` | `hazard_barricade.png` | 256×96 | 1 | – | front | Orange/black striped road barricade with sandbags. Stretched horizontally. |
| `road_tile` | `road_tile.png` | 512×256 | 1 | – | top | Asphalt road section with dashed white edge lines near both sides. Tiles seamlessly top to bottom. |
| `prop_tree` | `prop_tree.png` | 128×160 | 1 | – | front | Round cartoon tree for the roadside. |
| `prop_rock` | `prop_rock.png` | 128×96 | 1 | – | front | Chunky cartoon boulder. |
| `prop_crate` | `prop_crate.png` | 96×96 | 1 | – | front | Wooden supply crate. No markings or real-world symbols. |
| `bullet` | `bullet.png` | 16×24 | 1 | – | top | A small glowing yellow-white tracer, pointing up. |
| `muzzle_flash` | `muzzle_flash.png` | 32×32 | 2 | 20 | front | A small starburst flash in 2 frames (big, then small). |

## 6. Content rules

- **Cartoon only:** no blood, no gore, no wounds, no skulls. Defeated units burst into confetti, which the game draws in code, so you don't need to draw defeat poses.
- **Nothing sexual or suggestive.**
- **No real-world** flags, national insignia, military unit badges, brands, logos or text.
- **No trademarked characters**, and nothing traced or copied from existing games.

## 7. Checking your work

1. Run `npm install` once, then run `npm run check-assets`. It must print `assets OK (…)`. It reports wrong sizes (`expected 256x80, got 128x80`), missing files and files that aren't in the manifest.
2. Run `npm run dev` and open the URL it prints. Your art appears in-game straight away, and anything not delivered yet stays a placeholder box.
3. Check that the feet sit on the road (anchor), the animation loops smoothly, the art reads at small sizes, and the team colours are obvious.

## 8. Delivery order

Deliver in this order, since each item replaces the most-seen placeholder first:

1. `soldier_run`
2. `enemy_walk`
3. `cage`, `cage_broken`
4. `gate_positive`, `gate_negative`
5. `boss_idle`, `boss_damaged`
6. `heavy_walk`, `hazard_blade`, `hazard_fire`, `hazard_barricade`
7. `road_tile`, `prop_tree`, `prop_rock`, `prop_crate`
8. `soldier_shoot`, `bullet`, `muzzle_flash`
