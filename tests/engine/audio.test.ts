import { expect, test } from 'vitest';
import { GameAudio } from '../../engine/audio.ts';

// Minimal fake of the Web Audio pieces GameAudio uses.
function fakeContext(state: 'running' | 'suspended' = 'running') {
  const ctx = {
    state,
    currentTime: 0,
    resumed: 0,
    oscillators: 0,
    destination: {},
    resume() {
      this.resumed++;
      this.state = 'running';
      return Promise.resolve();
    },
    createOscillator() {
      ctx.oscillators++;
      return { type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (n: unknown) => n, start() {}, stop() {} };
    },
    createGain() {
      return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (n: unknown) => n };
    },
  };
  return ctx;
}

test('unlocking resumes a context that starts suspended (Safari)', () => {
  const ctx = fakeContext('suspended');
  const audio = new GameAudio(() => ctx as unknown as AudioContext);
  audio.unlock();
  expect(ctx.resumed).toBe(1);
});

test('hit sounds are throttled like shots', () => {
  const ctx = fakeContext();
  const audio = new GameAudio(() => ctx as unknown as AudioContext);
  audio.unlock();
  for (let i = 0; i < 10; i++) audio.play('hit');
  expect(ctx.oscillators).toBe(1);
  ctx.currentTime = 0.1;
  audio.play('hit');
  expect(ctx.oscillators).toBe(2);
});

test('nothing plays before unlock', () => {
  const ctx = fakeContext();
  const audio = new GameAudio(() => ctx as unknown as AudioContext);
  audio.play('win');
  expect(ctx.oscillators).toBe(0);
});
