// Every gameplay tuning number lives here. Distances in logical px (the
// playfield is WIDTH x HEIGHT), speeds in px per second, times in seconds.

export const WIDTH = 540;
export const HEIGHT = 960;

// Inner edges of the crate. The walls extend upward without limit; there is no lid.
export const CRATE = { left: 60, right: 480, top: 330, floor: 900 } as const;
export const DANGER_Y = 360;
export const DROP_Y = 260; // centre height of the hanging ball

// Radius by size; index 0 is unused so RADII[size] reads naturally for sizes 1..9.
export const RADII: readonly number[] = [0, 16, 22, 29, 37, 47, 59, 74, 92, 114];
export const MAX_SIZE = 9;

export const STEP = 1 / 120; // fixed physics step
export const GRAVITY = 1800; // px/s²
export const ITERATIONS = 8; // collision passes per step
export const MAX_PUSH = 3; // px a ball may move per pair per pass, so big overlaps ease apart
export const MAX_PUSH_SPEED = 300; // px/s a collision can give a ball beyond its own speed: enough to roll, not to launch
export const DAMPING = 0.995; // velocity kept per step
export const RESTITUTION = 0.1; // share of speed kept bouncing off a wall or the floor
