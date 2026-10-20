export interface Point { x: number; y: number }
export interface Rect extends Point { w: number; h: number }
export interface Collision { time: number; nx: number; ny: number }
const EPS = 1e-8;

// Slab intersection. Obstacles are expanded by the ball radius by the caller.
export function sweepRect(p: Point, v: Point, box: Rect, limit: number): Collision | null {
  const axis = (position: number, speed: number, min: number, max: number) => {
    if (Math.abs(speed) < EPS) return position >= min && position <= max ? [-Infinity, Infinity] : null;
    const a = (min - position) / speed, b = (max - position) / speed;
    return [Math.min(a, b), Math.max(a, b)];
  };
  const x = axis(p.x, v.x, box.x, box.x + box.w);
  const y = axis(p.y, v.y, box.y, box.y + box.h);
  if (!x || !y) return null;
  const enter = Math.max(x[0], y[0]), exit = Math.min(x[1], y[1]);
  if (enter < -EPS || enter > exit + EPS || enter > limit + EPS || !Number.isFinite(enter)) return null;
  return {
    time: Math.max(0, enter),
    nx: x[0] >= y[0] - EPS ? -Math.sign(v.x) : 0,
    ny: y[0] >= x[0] - EPS ? -Math.sign(v.y) : 0,
  };
}

export function sweepCircle(p: Point, v: Point, centre: Point, radius: number, limit: number): Collision | null {
  const dx = p.x - centre.x, dy = p.y - centre.y;
  const a = v.x * v.x + v.y * v.y;
  if (a < EPS) return null;
  const c = dx * dx + dy * dy - radius * radius;
  if (c <= EPS) return { time: 0, nx: 0, ny: 0 };
  const b = dx * v.x + dy * v.y;
  const discriminant = b * b - a * c;
  if (discriminant < 0) return null;
  const time = (-b - Math.sqrt(discriminant)) / a;
  return time >= -EPS && time <= limit + EPS ? { time: Math.max(0, time), nx: 0, ny: 0 } : null;
}

export function expand(rect: Rect, radius: number): Rect {
  return { x: rect.x - radius, y: rect.y - radius, w: rect.w + radius * 2, h: rect.h + radius * 2 };
}

export function contains(rect: Rect, p: Point): boolean {
  return p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h;
}
