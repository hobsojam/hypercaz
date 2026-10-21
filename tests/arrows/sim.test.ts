import { describe, expect, test } from 'vitest';
import { blocker, cells, createState, removable, remove, validatePuzzle, VECTORS, type Arrow, type Puzzle } from '../../games/arrows/sim.ts';

const puzzle = (arrows: readonly Arrow[]): Puzzle => ({ id: 1, name: 'Test', lesson: 'Find the exit.', size: 5, arrows });
const arrow = (id: number, x: number, y: number, direction: Arrow['direction'], length = 1): Arrow => ({ id, direction, path: Array.from({ length }, (_, i) => ({ x: x + i * VECTORS[direction]?.x, y: y + i * VECTORS[direction]?.y })) });

describe('exit rays', () => {
  test.each([
    ['N', 2, 0], ['E', 4, 2], ['S', 2, 4], ['W', 0, 2],
  ] as const)('%s checks cells all the way to its edge', (direction, x, y) => {
    const p = puzzle([arrow(1, 2, 2, direction), arrow(2, x, y, direction)]);
    const s = createState(p);
    expect(blocker(p, s.remaining, 1)?.id).toBe(2);
    expect(remove(s, 1)).toBe('blocked');
    expect([...s.remaining]).toEqual([1, 2]);
    expect(remove(s, 2)).toBe('removed');
    expect(blocker(p, s.remaining, 1)).toBeNull();
    expect(remove(s, 1)).toBe('removed');
    expect(s.remaining.size).toBe(0);
  });
  test('the shaft blocks, not just the head, and nearest blocker wins', () => {
    const p = puzzle([arrow(1, 0, 2, 'E', 2), arrow(2, 4, 3, 'N', 3), arrow(3, 3, 2, 'S')]);
    const s = createState(p);
    expect(cells(p.arrows[1])).toEqual([{ x: 4, y: 3 }, { x: 4, y: 2 }, { x: 4, y: 1 }]);
    expect(blocker(p, s.remaining, 1)?.id).toBe(3);
    remove(s, 3);
    expect(blocker(p, s.remaining, 1)?.id).toBe(2);
  });
  test('ignores arrows behind the head or off its row', () => {
    const p = puzzle([arrow(1, 2, 2, 'E', 2), arrow(2, 0, 2, 'W'), arrow(3, 4, 3, 'S')]);
    expect(removable(p, createState(p).remaining).map(a => a.id)).toEqual([1, 2, 3]);
  });
  test('missing and already removed ids cannot alter the board', () => {
    const s = createState(puzzle([arrow(1, 0, 0, 'N')]));
    expect(remove(s, 9)).toBe('ignored');
    expect(s.remaining.size).toBe(1);
    remove(s, 1);
    expect(remove(s, 1)).toBe('ignored');
    expect(s.remaining.size).toBe(0);
  });
});

describe('validation', () => {
  test.each([
    { size: 0 }, { size: Infinity }, { arrows: [] },
    { arrows: [arrow(1, -1, 0, 'E')] },
    { arrows: [arrow(1, 4, 0, 'E', 2)] },
    { arrows: [arrow(1, 2, 2, 'N', 0)] },
    { arrows: [arrow(1, 2.5, 2, 'N')] },
    { arrows: [arrow(1, 2, 2, 'diagonal' as Arrow['direction'])] },
    { arrows: [arrow(1, 0, 0, 'N'), arrow(1, 1, 1, 'E')] },
    { arrows: [arrow(1, 0, 0, 'E', 2), arrow(2, 1, 0, 'S')] },
    { arrows: [arrow(1, 1, 2, 'E'), arrow(2, 3, 2, 'W')] },
  ])('rejects malformed or cyclic layout %j', bad => {
    expect(() => validatePuzzle({ ...puzzle([arrow(1, 0, 0, 'N')]), ...bad })).toThrow();
  });
  test('validates a solvable layout without mutating it', () => {
    const p = puzzle([arrow(1, 1, 1, 'E'), arrow(2, 3, 1, 'N')]);
    const before = structuredClone(p);
    expect(validatePuzzle(p)).toBe(p);
    expect(p).toEqual(before);
  });
});
