import { expect, test } from 'vitest';
import { type Scene, SceneStack } from '../../engine/scenes.ts';

function scene(log: string[], name: string): Scene {
  return { enter: () => log.push(`enter ${name}`), exit: () => log.push(`exit ${name}`), update() {}, render() {} };
}

test('push, replace and pop call enter/exit and track the top', () => {
  const log: string[] = [];
  const stack = new SceneStack();
  const a = scene(log, 'a');
  const b = scene(log, 'b');
  const c = scene(log, 'c');
  stack.push(a);
  stack.push(b);
  expect(stack.top).toBe(b);
  stack.replace(c);
  expect(stack.top).toBe(c);
  stack.pop();
  expect(stack.top).toBe(a);
  expect(log).toEqual(['enter a', 'enter b', 'exit b', 'enter c', 'exit c']);
});
