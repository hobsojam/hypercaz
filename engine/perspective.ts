// Maps world coordinates (x across the road in [-1, 1], z metres up the road)
// to screen space. This is the only module that knows about pixels.

export interface PerspectiveConfig {
  width: number;
  height: number;
  horizonY: number;
  squadLineY: number;
  focal: number;
  roadHalfWidthPx: number;
}

export interface Projected {
  sx: number;
  sy: number;
  scale: number;
}

export const DEFAULT_VIEW: PerspectiveConfig = {
  width: 540,
  height: 960,
  horizonY: 220,
  squadLineY: 800,
  focal: 20,
  roadHalfWidthPx: 230,
};

function scaleAt(cfg: PerspectiveConfig, z: number): number {
  const safeZ = Math.max(z, -cfg.focal * 0.9);
  return cfg.focal / (cfg.focal + safeZ);
}

export function project(cfg: PerspectiveConfig, x: number, z: number): Projected {
  const scale = scaleAt(cfg, z);
  return {
    sx: cfg.width / 2 + x * cfg.roadHalfWidthPx * scale,
    sy: cfg.horizonY + (cfg.squadLineY - cfg.horizonY) * scale,
    scale,
  };
}

export function unprojectX(cfg: PerspectiveConfig, sx: number, z: number): number {
  return (sx - cfg.width / 2) / (cfg.roadHalfWidthPx * scaleAt(cfg, z));
}
