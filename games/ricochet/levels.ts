import { BOARD, CAGE_RADIUS, LAUNCHER, BALL_RADIUS } from './sim/constants.ts';
import { contains, expand, type Point, type Rect } from './sim/geometry.ts';

export interface Cage extends Point { id: string }
export interface Level {
  id: number;
  name: string;
  lesson: string;
  par: number;
  shots: number;
  walls: Rect[];
  cages: Cage[];
}

export function validateLevel(level: Level): Level {
  const fail = (message: string): never => { throw new Error(`Ricochet level ${level.id}: ${message}`); };
  if (!Number.isInteger(level.id) || level.id < 1 || !level.name || !level.lesson) fail('needs an id, name and lesson');
  if (!Number.isInteger(level.par) || level.par < 1 || !Number.isInteger(level.shots) || level.shots < level.par) fail('invalid shot budget');
  const finite = (p: Point) => Number.isFinite(p.x) && Number.isFinite(p.y);
  for (const wall of level.walls) {
    if (!finite(wall) || !Number.isFinite(wall.w) || !Number.isFinite(wall.h) || wall.w <= 0 || wall.h <= 0) fail('invalid wall');
    if (!contains(BOARD, wall) || !contains(BOARD, { x: wall.x + wall.w, y: wall.y + wall.h })) fail('wall outside courtyard');
    if (contains(expand(wall, BALL_RADIUS), LAUNCHER)) fail('wall blocks launcher');
  }
  const ids = new Set<string>();
  if (!level.cages.length) fail('needs a cage');
  for (const cage of level.cages) {
    if (!finite(cage) || !cage.id || ids.has(cage.id)) fail('invalid or duplicate cage');
    ids.add(cage.id);
    const safe = { x: BOARD.x + CAGE_RADIUS, y: BOARD.y + CAGE_RADIUS, w: BOARD.w - CAGE_RADIUS * 2, h: BOARD.h - CAGE_RADIUS * 2 };
    if (!contains(safe, cage)) fail('cage outside courtyard');
    if (level.walls.some(w => contains(expand(w, CAGE_RADIUS), cage))) fail('cage overlaps wall');
    if (Math.hypot(cage.x - LAUNCHER.x, cage.y - LAUNCHER.y) <= CAGE_RADIUS + BALL_RADIUS) fail('cage blocks launcher');
  }
  for (let i = 0; i < level.cages.length; i++) for (let j = i + 1; j < level.cages.length; j++) {
    if (Math.hypot(level.cages[i].x - level.cages[j].x, level.cages[i].y - level.cages[j].y) < CAGE_RADIUS * 2) fail('cages overlap');
  }
  for (let i = 0; i < level.walls.length; i++) for (let j = i + 1; j < level.walls.length; j++) {
    const a = level.walls[i], b = level.walls[j];
    if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) fail('walls overlap');
  }
  return level;
}

export const LEVELS: readonly Level[] = [
  {
    id: 1, name: 'First Rescue', lesson: 'Aim at the cage. Release to launch your rescue ball.', par: 1, shots: 3,
    walls: [], cages: [{ id: 'a', x: 270, y: 330 }],
  },
  {
    id: 2, name: 'Side Door', lesson: 'The wall blocks a direct shot. Try a bank off either side.', par: 1, shots: 3,
    walls: [{ x: 180, y: 470, w: 180, h: 24 }], cages: [{ id: 'a', x: 270, y: 300 }],
  },
  {
    id: 3, name: 'Chain Reaction', lesson: 'A rescued cage lets the ball pass through. Line up two!', par: 1, shots: 3,
    walls: [{ x: 180, y: 450, w: 180, h: 24 }], cages: [{ id: 'a', x: 420, y: 610 }, { id: 'b', x: 370, y: 385 }],
  },
  {
    id: 4, name: 'Over the Top', lesson: 'The top edge is a wall too. Use it to get behind the pillar.', par: 1, shots: 3,
    walls: [{ x: 360, y: 400, w: 24, h: 280 }], cages: [{ id: 'a', x: 420, y: 500 }],
  },
  {
    id: 5, name: 'Split Decision', lesson: 'Rescues stay between shots. Plan one side, then the other.', par: 2, shots: 4,
    walls: [{ x: 170, y: 450, w: 200, h: 24 }], cages: [{ id: 'a', x: 130, y: 300 }, { id: 'b', x: 410, y: 300 }],
  },
  {
    id: 6, name: 'Two Banks', lesson: 'Look beyond the first bounce. One shot can take the long way.', par: 1, shots: 3,
    walls: [{ x: 230, y: 500, w: 120, h: 24 }], cages: [{ id: 'a', x: 145, y: 572 }, { id: 'b', x: 350, y: 430 }],
  },
  {
    id: 7, name: 'The Courtyard', lesson: 'Follow the dotted line, then imagine the next bank.', par: 1, shots: 3,
    walls: [{ x: 220, y: 520, w: 110, h: 22 }], cages: [{ id: 'a', x: 400, y: 671 }, { id: 'b', x: 210, y: 386 }, { id: 'c', x: 420, y: 369 }],
  },
  {
    id: 8, name: 'Rescue Party', lesson: 'Two sides, four friends. Try to finish in two shots.', par: 2, shots: 4,
    walls: [{ x: 210, y: 480, w: 120, h: 24 }, { x: 256, y: 220, w: 28, h: 180 }],
    cages: [{ id: 'a', x: 420, y: 610 }, { id: 'b', x: 370, y: 385 }, { id: 'c', x: 120, y: 610 }, { id: 'd', x: 170, y: 385 }],
  },
].map(validateLevel);
