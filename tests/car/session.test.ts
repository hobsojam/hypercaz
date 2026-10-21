import { expect, test } from 'vitest';
import { createStorage } from '../../engine/storage.ts';
import { PUZZLES } from '../../games/car/levels.ts';
import { Session } from '../../games/car/session.ts';

function storage() {
  const data = new Map<string, string>();
  return createStorage('hypercaz.car-test', { getItem: key => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) });
}

test('a completed drag is one undo step; reset restores the whole board', () => {
  const s = new Session(storage()), start = [...s.state.positions];
  expect(s.commit(1, 3)).toBe(true);
  expect(s.history).toHaveLength(1);
  expect(s.state.positions[1]).toBe(3);
  expect(s.undo()).toBe(true);
  expect(s.state.positions).toEqual(start);
  s.commit(1, 3); s.reset();
  expect(s.state.positions).toEqual(start);
  expect(s.history).toHaveLength(0);
});

test('hint gives a legal next move from the current state without changing it', () => {
  const s = new Session(storage()), start = [...s.state.positions];
  s.hint();
  expect(s.hintMove).not.toBeNull();
  expect(s.state.positions).toEqual(start);
  const step = s.hintMove!;
  expect(s.commit(PUZZLES[0].cars.findIndex(c => c.id === step.carId), step.to)).toBe(true);
  expect(s.hintMove).toBeNull();
});

test('winning saves known completion and undo remains available', () => {
  const store = storage(), s = new Session(store);
  s.commit(1, 3); s.commit(0, 4);
  expect(s.screen).toBe('won');
  expect(s.completed.has(1)).toBe(true);
  expect(new Session(store).completed.has(1)).toBe(true);
  expect(s.undo()).toBe(true);
  expect(s.screen).toBe('play');
  expect(s.state.positions[0]).toBe(0);
});


test('live status names keyboard cursor cells and announces car movement', () => {
  const s = new Session(storage());
  s.cursorVisible = true;
  expect(s.status).toContain('Cursor row 3, column 1. Car T.');
  s.focus = { x: 5, y: 5 };
  expect(s.status).toContain('Cursor row 6, column 6. Empty cell.');
  s.selected = 1;
  expect(s.status).toContain('column 4, rows 2 through 3');
  s.commit(1, 3);
  expect(s.status).toContain('column 4, rows 4 through 5');
});
