// Every gameplay tuning number lives here. Distances: x in road units
// ([-1, 1] = full road width), z in metres. Times in seconds.

// Squads grow deep rather than wide (7 per row, 21% of the road), so even a
// big squad has to be aimed and steered.
export const FORMATION_MAX_WIDTH = 0.42;
export const SLOT_DX = 0.07;
export const SLOT_DZ = 0.6;
export const MAX_DRAWN = 150;

export const FIRE_INTERVAL = 0.4;
export const MAX_BULLETS_PER_SEC = MAX_DRAWN / FIRE_INTERVAL; // 375
export const BULLET_SPEED = 40;
// Crowd fire: each gap between shots is the average gap times a random factor
// in [1 - SHOT_GAP_JITTER, 1 + SHOT_GAP_JITTER], from a random soldier.
export const SHOT_GAP_JITTER = 0.85;
export const SHOT_X_JITTER = 0.02;
export const SHOT_Z_JITTER = 0.3;
export const BULLET_DRIFT = 0.025; // max sideways drift, road units per second
export const BULLET_RANGE = 60;
export const SPAWN_HORIZON = 60;
export const DESPAWN_Z = -5;

export const ENEMY_SPEED = 1.5;
export const HEAVY_SPEED = 0.8;
export const SQUAD_OMEGA = 12;
// Crowds close in: within STEER_RANGE metres, enemies outside the formation
// drift sideways toward it (road units per second).
export const STEER_RANGE = 30;
export const ENEMY_STEER = 0.15;
export const HEAVY_STEER = 0.06;

// Kill meter: kills charge it (heavies count triple); a full meter can be
// spent on a burst of rapid fire.
export const HEAVY_CHARGE = 3;
export const BURST_MULTIPLIER = 2.5;
export const BURST_SECONDS = 4;

export const BOSS_Z = 18;
export const BOSS_ENTRY_Z = 38;
export const BOSS_ENTRY_SPEED = 10; // a two-second entrance
export const BOSS_HALF_W = 0.5;
export const BOSS_HALF_D = 2;

export const BOSS_WINDUP = 0.7; // seconds of warning glow before each volley
export const BOSS_FIRST_VOLLEY = 1.5; // seconds after settling: the boss opens with its attack, not a full interval
export const BOSS_ENRAGE_AT = 0.5; // fraction of health left when the boss enrages
export const BOSS_ENRAGE_FIRE = 0.6; // fire interval multiplier once enraged
export const BOSS_ENRAGE_SUMMON = 0.7; // summon interval multiplier once enraged
export const BOSS_SUMMON_WIDTH = 0.9;

// Signature attacks (signature.ts). No warning is shorter than 1 s.
export const STRAFE_RANGE = 0.6; // strafer slides between -0.6 and +0.6
export const STRAFE_PERIOD = 6; // seconds for one full side-to-side cycle
export const STRAFE_PERIOD_ENRAGED = 4;
export const CHARGE_WARN = 1.2; // seconds the stripe shows before the lunge
export const CHARGE_SLIDE = 0.3; // seconds to slide into the squad's lane, within the warning
export const CHARGE_LUNGE = 0.4;
export const CHARGE_EXPOSED = 2.5;
export const CHARGE_RETURN = 1;
export const CHARGE_HALF_W = 0.35; // half the stripe's width
export const CHARGE_REACH_Z = 2.5; // where the lunge stops: the boss's front just short of the squad
export const CHARGE_ENRAGED = 0.7; // charge interval multiplier once enraged
export const EXPOSED_DAMAGE = 2;
export const BARRAGE_WARN = 1.5; // seconds the shadows show before the shells land
export const BARRAGE_GAP = 0.5; // width of the safe gap
export const BARRAGE_MAX_SHIFT = 0.9; // furthest one gap is from the last
export const BARRAGE_COUNT = 3;
export const BARRAGE_COUNT_ENRAGED = 2;
export const BARRAGE_SPACING = 2.5; // seconds between barrages
export const BARRAGE_SPACING_ENRAGED = 2;
export const SHIELD_DAMAGE = 0.2; // share of damage that reaches a shielded boss
export const SHIELD_BURST = 3; // Rapid Fire's damage multiplier against the shield
export const STUN_SECONDS = 4;

export const PROJECTILE_SPEED = 10;
export const PROJECTILE_RADIUS = 0.12;
export const PROJECTILE_BLAST_DEPTH = 1; // metres back from the front line a shell reaches (two rows)
export const BOSS_AIM_JITTER = 0.1;

export const SIZES = {
  enemy: { halfW: 0.05, halfD: 0.5 },
  heavy: { halfW: 0.08, halfD: 0.8 },
  cage: { halfW: 0.08, halfD: 0.6 },
  gate: { halfD: 0.3 },
  hazard: { halfD: 0.4 },
} as const;

export const ENRAGED_PATTERN = { single: 'volley3', volley3: 'spread5', spread5: 'spread5' } as const;

export const PATTERNS = {
  single: [0],
  volley3: [-0.25, 0, 0.25],
  spread5: [-0.5, -0.25, 0, 0.25, 0.5],
} as const;
