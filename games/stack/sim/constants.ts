// Every gameplay tuning number lives here. Distances in logical px (the
// playfield is WIDTH wide), speeds in px per second, times in seconds.

export const WIDTH = 540;
export const BASE_WIDTH = 300;
export const PERFECT_TOLERANCE = 4; // px; within this a drop snaps to the slab below
export const REGROW_FROM = 3; // regrowth starts at the 3rd perfect in a row
export const REGROW = 0.03; // of BASE_WIDTH, per perfect from REGROW_FROM on

// Slider speed ramps linearly from SPEED_START to SPEED_MAX over SPEED_FULL_AT floors.
export const SPEED_START = 300;
export const SPEED_MAX = 700;
export const SPEED_FULL_AT = 40;

// Debris is measured in floor heights, so the renderer converts with its floor height.
export const DEBRIS_GRAVITY = 40; // floors per second squared
export const DEBRIS_REMOVE_Y = 15; // floors below the drop point
export const DEBRIS_SPIN_MAX = 3; // radians per second, either direction
