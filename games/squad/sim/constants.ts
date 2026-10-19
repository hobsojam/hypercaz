// Every gameplay tuning number lives here. Distances: x in road units
// ([-1, 1] = full road width), z in metres. Times in seconds.

export const FORMATION_MAX_WIDTH = 0.76; // 38% of the road (road width = 2)
export const SLOT_DX = 0.07;
export const SLOT_DZ = 0.9;
export const MAX_DRAWN = 150;

export const FIRE_INTERVAL = 0.4;
export const MAX_BULLETS_PER_SEC = MAX_DRAWN / FIRE_INTERVAL; // 375
export const BULLET_SPEED = 40;
// Crowd fire: each gap between shots is the average gap times a random factor
// in [1 - SHOT_GAP_JITTER, 1 + SHOT_GAP_JITTER], from a random soldier.
export const SHOT_GAP_JITTER = 0.85;
export const SHOT_X_JITTER = 0.02;
export const SHOT_Z_JITTER = 0.3;
export const BULLET_DRIFT = 0.04; // max sideways drift, road units per second
export const BULLET_RANGE = 60;
export const SPAWN_HORIZON = 60;
export const DESPAWN_Z = -5;

export const ENEMY_SPEED = 1.5;
export const HEAVY_SPEED = 0.8;
export const SQUAD_OMEGA = 12;

export const BOSS_Z = 18;
export const BOSS_ENTRY_Z = 38;
export const BOSS_ENTRY_SPEED = 5;
export const BOSS_HALF_W = 0.5;
export const BOSS_HALF_D = 2;

export const PROJECTILE_SPEED = 10;
export const PROJECTILE_RADIUS = 0.12;
export const BOSS_AIM_JITTER = 0.1;

export const SIZES = {
  enemy: { halfW: 0.05, halfD: 0.5 },
  heavy: { halfW: 0.08, halfD: 0.8 },
  cage: { halfW: 0.08, halfD: 0.6 },
  gate: { halfD: 0.3 },
  hazard: { halfD: 0.4 },
} as const;

export const PATTERNS = {
  single: [0],
  volley3: [-0.25, 0, 0.25],
  spread5: [-0.5, -0.25, 0, 0.25, 0.5],
} as const;
