import { VECTORS, type Arrow, type Cell } from './sim.ts';

function pointAlong(arrow: Arrow, distance: number): Cell {
  const path = arrow.path, index = Math.floor(distance);
  if (index < path.length - 1) {
    const a = path[index], b = path[index + 1], t = distance - index;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  const head = path.at(-1)!, v = VECTORS[arrow.direction], beyond = distance - (path.length - 1);
  return { x: head.x + v.x * beyond, y: head.y + v.y * beyond };
}

// A moving window of constant arc length over the body's original path,
// extended straight ahead from the head. The tail traces every original bend.
export function followingPath(arrow: Arrow, distance: number): readonly Cell[] {
  const start = Math.max(0, Number.isFinite(distance) ? distance : 0), end = start + arrow.path.length - 1;
  const points: Cell[] = [pointAlong(arrow, start)];
  for (let i = Math.floor(start) + 1; i < Math.min(end, arrow.path.length); i++) points.push(arrow.path[i]);
  if (end > start) points.push(pointAlong(arrow, end));
  return points;
}

export function exitDistance(size: number, arrow: Arrow): number {
  const head = arrow.path.at(-1)!, v = VECTORS[arrow.direction];
  let toEdge = size - head.x;
  if (v.x < 0) toEdge = head.x + 1;
  if (v.y > 0) toEdge = size - head.y;
  if (v.y < 0) toEdge = head.y + 1;
  return arrow.path.length - 1 + toEdge + 0.6;
}
