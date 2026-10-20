import { type PerspectiveConfig, type Projected, project } from '../../../engine/perspective.ts';

// Keep the front rows familiar, then pack distant rear rows onto the road.
// This map is independent of squad size so in-flight shots never jump when
// soldiers join or leave. Share it with nearby targets so hits stay aligned.
// Simulation positions and hit areas stay unchanged.
export function projectPlayfieldPoint(cfg: PerspectiveConfig, x: number, z: number): Projected {
  if (z >= 0) return project(cfg, x, z);
  const freeDepth = 1.8;
  const packedDepth = 1; // approach z=-2.8, just inside the rendered road
  const rear = Math.max(0, -z - freeDepth);
  const displayZ = rear > 0 ? -freeDepth - rear / (1 + rear / packedDepth) : z;
  const p = project(cfg, x, displayZ);
  // Keep the same aiming width as the front row, including at road edges.
  return { ...p, sx: cfg.width / 2 + x * cfg.roadHalfWidthPx };
}
