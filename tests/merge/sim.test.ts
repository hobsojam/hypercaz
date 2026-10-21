import { expect, test } from 'vitest';
import {
  CRATE,
  DANGER_Y,
  DROP_Y,
  FAMILY_POINTS,
  MAX_FRAME,
  POINTS,
  RADII,
  STEP,
} from '../../games/merge/sim/constants.ts';
import { type Ball, makeBall, stepPhysics } from '../../games/merge/sim/physics.ts';
import {
  clampAim,
  createMerge,
  type MergeEvent,
  type MergeState,
  rollSize,
} from '../../games/merge/sim/state.ts';
import { stepMerge } from '../../games/merge/sim/step.ts';

const FRAME = 1 / 60;
const IDLE = { aimX: null, drop: false };
type Input = Parameters<typeof stepMerge>[1];

// Steps at 1/60 for `seconds`, calling `each` after every frame; returns every event.
function run(
  s: MergeState,
  seconds: number,
  input: Input = IDLE,
  each?: (s: MergeState) => void,
): MergeEvent[] {
  const events: MergeEvent[] = [];
  for (let i = 0; i < Math.round(seconds / FRAME); i++) {
    stepMerge(s, input, FRAME);
    events.push(...s.events);
    each?.(s);
  }
  return events;
}

// A round whose crate holds exactly `balls`.
function withBalls(balls: Ball[]): MergeState {
  const s = createMerge(1);
  s.balls = balls;
  s.nextId = 1000;
  return s;
}

// A ball of `size` at rest on the floor at x.
function onFloor(id: number, size: number, x: number): Ball {
  return makeBall(id, size, x, CRATE.floor - RADII[size]);
}

function sizes(s: MergeState): number[] {
  return s.balls.map((b) => b.size).sort((a, b) => a - b);
}

test('createMerge rolls drops evenly from sizes 1-4, the same for the same seed', () => {
  const counts = [0, 0, 0, 0, 0];
  let rng = 7;
  for (let i = 0; i < 1000; i++) {
    const [size, next] = rollSize(rng);
    rng = next;
    expect(size).toBeGreaterThanOrEqual(1);
    expect(size).toBeLessThanOrEqual(4);
    counts[size]++;
  }
  // Even odds: each size gets roughly a quarter of the rolls.
  for (const count of counts.slice(1)) {
    expect(count).toBeGreaterThan(200);
    expect(count).toBeLessThan(300);
  }

  const dropped = (s: MergeState): number[] => {
    const out: number[] = [];
    for (let i = 0; i < 20; i++) {
      s.cooldown = 0;
      stepMerge(s, { aimX: 100 + i * 15, drop: true }, FRAME);
      for (const e of s.events) if (e.type === 'drop') out.push(e.size);
    }
    return out;
  };
  const a = dropped(createMerge(5));
  expect(a).toHaveLength(20);
  expect(a).toEqual(dropped(createMerge(5)));
});

test('a drop adds the current ball at the aim and shows the next', () => {
  const s = createMerge(3);
  const { current, next } = s;
  stepMerge(s, { aimX: 200, drop: true }, FRAME);
  expect(s.balls).toHaveLength(1);
  expect(s.balls[0].size).toBe(current);
  expect(s.balls[0].x).toBe(200);
  expect(s.current).toBe(next);
  expect(s.events).toContainEqual({ type: 'drop', size: current });
});

test('aim is clamped to the crate', () => {
  const s = createMerge(3);
  stepMerge(s, { aimX: -1000, drop: false }, FRAME);
  expect(s.aimX).toBe(CRATE.left + RADII[s.current]);
  stepMerge(s, { aimX: 5000, drop: false }, FRAME);
  expect(s.aimX).toBe(CRATE.right - RADII[s.current]);
  expect(clampAim(270, 9)).toBe(270);
});

test('drops during the cooldown are ignored, not queued', () => {
  const s = createMerge(3);
  stepMerge(s, { aimX: 270, drop: true }, FRAME);
  for (let i = 0; i < 10; i++) stepMerge(s, { aimX: 270, drop: true }, 0.04);
  expect(s.balls).toHaveLength(1);
  run(s, 0.2);
  expect(s.balls).toHaveLength(1);
});

test('two touching same-size balls become one of the next size where they met', () => {
  const s = withBalls([onFloor(1, 2, 200), onFloor(2, 2, 244)]);
  stepMerge(s, IDLE, FRAME);
  expect(s.balls).toHaveLength(1);
  expect(s.balls[0].size).toBe(3);
  expect(Math.abs(s.balls[0].x - 222)).toBeLessThanOrEqual(2);
  const merges = s.events.filter((e) => e.type === 'merge');
  expect(merges).toHaveLength(1);
  expect(merges[0]).toMatchObject({ size: 3, link: 1, points: POINTS[3] });
  expect(s.score).toBe(6);
});

test('different sizes never merge', () => {
  const s = withBalls([onFloor(1, 2, 200), onFloor(2, 3, 251)]);
  run(s, 2);
  expect(s.balls).toHaveLength(2);
});

test('three touching size-2 balls make one size-3 and leave one size-2', () => {
  const s = withBalls([onFloor(1, 2, 200), onFloor(2, 2, 244), onFloor(3, 2, 288)]);
  stepMerge(s, IDLE, STEP);
  expect(sizes(s)).toEqual([2, 3]);
});

test('a chain multiplies its points', () => {
  // A size-3 resting in the groove on top of a size-2 pair, touching both.
  const pairY = CRATE.floor - RADII[2];
  const reach = RADII[2] + RADII[3];
  const top = makeBall(3, 3, 222, pairY - Math.sqrt(reach * reach - 22 * 22));
  const s = withBalls([onFloor(1, 2, 200), onFloor(2, 2, 244), top]);
  const merges = run(s, 0.1).filter((e) => e.type === 'merge');
  expect(merges.map((e) => e.link)).toEqual([1, 2]);
  expect(merges[1].points).toBe(POINTS[4] * 2);
  expect(sizes(s)).toEqual([4]);
  expect(s.score).toBe(POINTS[3] + POINTS[4] * 2);
});

test('a new drop starts a new chain', () => {
  const s = withBalls([onFloor(1, 2, 200), onFloor(2, 2, 244)]);
  stepMerge(s, IDLE, FRAME);
  expect(s.chain).toBe(1);
  stepMerge(s, { aimX: 400, drop: true }, FRAME);
  expect(s.chain).toBe(0);
});

test('two size-9 snowmen make a family that leaves the crate', () => {
  const s = withBalls([onFloor(1, 9, 175), onFloor(2, 9, 365)]);
  stepMerge(s, IDLE, FRAME);
  expect(s.events).toContainEqual(
    expect.objectContaining({ type: 'family', link: 1, points: FAMILY_POINTS }),
  );
  expect(s.balls).toHaveLength(0);
  expect(s.score).toBe(FAMILY_POINTS);
});

test('a merge in a packed crate keeps every ball in the crate', () => {
  // 30 size-3 balls in rows, settled by the physics alone so none merge yet.
  const r3 = RADII[3];
  const packed: Ball[] = [];
  for (let i = 0; i < 30; i++) {
    const x = CRATE.left + r3 + 1 + (i % 7) * (2 * r3 + 1);
    const y = CRATE.floor - r3 - Math.floor(i / 7) * (2 * r3 + 1);
    packed.push(makeBall(i + 1, 3, x, y));
  }
  for (let i = 0; i < 240; i++) stepPhysics(packed);
  // Two touching size-6 balls on the floor, clearing the room they take. The
  // size-3s touching each other merge too, so the crate churns as it would in play.
  const r6 = RADII[6];
  const pair = [onFloor(101, 6, 211), onFloor(102, 6, 211 + 2 * r6)];
  const clear = packed.filter((b) =>
    pair.every((p) => Math.hypot(p.x - b.x, p.y - b.y) > r6 + r3),
  );
  const s = withBalls([...clear, ...pair]);
  const events = run(s, 3, IDLE, () => {
    for (const b of s.balls) {
      const r = RADII[b.size];
      expect(b.x - r).toBeGreaterThanOrEqual(CRATE.left - 0.01);
      expect(b.x + r).toBeLessThanOrEqual(CRATE.right + 0.01);
      expect(b.y + r).toBeLessThanOrEqual(CRATE.floor + 0.01);
      expect(b.y - r).toBeGreaterThan(CRATE.top - 150);
    }
  });
  expect(events).toContainEqual(expect.objectContaining({ type: 'merge', size: 7 }));
});

// Holds `ball` still with its top above the danger line, aged `age`, before every frame.
function pin(ball: Ball, age: number): () => void {
  return () => {
    ball.x = ball.px = 270;
    ball.y = ball.py = DANGER_Y - 10;
    ball.age = age;
  };
}

function runPinned(s: MergeState, seconds: number, hold: () => void): MergeEvent[] {
  const events: MergeEvent[] = [];
  for (let i = 0; i < Math.round(seconds / FRAME); i++) {
    hold();
    stepMerge(s, IDLE, FRAME);
    events.push(...s.events);
  }
  return events;
}

test('settled snow over the line for 2 s ends the round', () => {
  const ball = makeBall(1, 1, 270, DANGER_Y - 10);
  const s = withBalls([ball]);
  const hold = pin(ball, 1);
  runPinned(s, 1.9, hold);
  expect(s.phase).toBe('play');
  const events = runPinned(s, 0.2, hold);
  expect(s.phase).toBe('over');
  expect(events).toContainEqual({ type: 'over' });
  const frozen = JSON.stringify(s.balls);
  const score = s.score;
  stepMerge(s, { aimX: 100, drop: true }, FRAME);
  expect(JSON.stringify(s.balls)).toBe(frozen);
  expect(s.score).toBe(score);
  expect(s.events).toEqual([]);
});

test('a fresh drop or a brief flight over the line does not end the round', () => {
  const fresh = makeBall(1, 1, 270, DANGER_Y - 10);
  const s = withBalls([fresh]);
  runPinned(s, 3, pin(fresh, 0.5));
  expect(s.phase).toBe('play');
  expect(s.danger).toBe(0);

  const settled = makeBall(1, 1, 270, DANGER_Y - 10);
  const t = withBalls([settled]);
  runPinned(t, 1, pin(settled, 1));
  expect(t.danger).toBeGreaterThan(0.9);
  run(t, 1);
  expect(t.phase).toBe('play');
  expect(t.danger).toBe(0);
});

test('a huge dt is capped', () => {
  const s = createMerge(3);
  stepMerge(s, { aimX: 270, drop: true }, 5);
  // Falling from rest for MAX_FRAME covers about g t² / 2 = 9 px.
  const fall = s.balls[0].y - DROP_Y;
  expect(fall).toBeGreaterThan(0);
  expect(fall).toBeLessThanOrEqual(0.5 * 1800 * MAX_FRAME * MAX_FRAME + 1.5);
});
