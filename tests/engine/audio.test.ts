import { describe, expect, it, test } from 'vitest';
import { GameAudio, MUSIC_VOLUME } from '../../engine/audio.ts';

// Minimal fake of the Web Audio pieces GameAudio uses.
function fakeContext(state: 'running' | 'suspended' = 'running') {
  const sources: { loop: boolean; started: number; stopped: number; buffer: unknown }[] = [];
  const musicGains: { value: number }[] = [];
  const ctx = {
    state,
    currentTime: 0,
    resumed: 0,
    oscillators: 0,
    frequencies: [] as number[],
    buffers: 0,
    sources,
    musicGains,
    destination: {},
    resume() {
      this.resumed++;
      this.state = 'running';
      return Promise.resolve();
    },
    suspend() {
      this.state = 'suspended';
      return Promise.resolve();
    },
    createOscillator() {
      ctx.oscillators++;
      return { type: '', frequency: { setValueAtTime(v: number) { ctx.frequencies.push(v); }, exponentialRampToValueAtTime(v: number) { ctx.frequencies.push(v); } }, connect: (n: unknown) => n, start() {}, stop() {} };
    },
    createGain() {
      const gain = {
        value: 1,
        setValueAtTime(v: number) {
          gain.value = v;
        },
        setTargetAtTime(v: number) {
          gain.value = v;
        },
        exponentialRampToValueAtTime() {},
        cancelScheduledValues() {},
      };
      return { gain, connect: (n: unknown) => n };
    },
    createBuffer(_channels: number, length: number, sampleRate: number) {
      ctx.buffers++;
      return { length, sampleRate, copyToChannel() {} };
    },
    createBufferSource() {
      const src = {
        loop: false,
        started: 0,
        stopped: 0,
        buffer: null as unknown,
        connect: (n: { gain?: { value: number } }) => {
          if (n.gain) musicGains.push(n.gain);
          return n;
        },
        start() {
          src.started++;
        },
        stop() {
          src.stopped++;
        },
      };
      sources.push(src);
      return src;
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

test('falls silent while the page is hidden, and the next gesture wakes it', () => {
  const ctx = fakeContext();
  const audio = new GameAudio(() => ctx as unknown as AudioContext);
  audio.unlock();
  audio.hide();
  expect(ctx.state).toBe('suspended');
  audio.unlock();
  expect(ctx.state).toBe('running');
});

test('hiding before any sound has played is harmless', () => {
  expect(() => new GameAudio(() => fakeContext() as unknown as AudioContext).hide()).not.toThrow();
});

test('pitch multiplies every voice frequency', () => {
  const play = (pitch?: number) => {
    const ctx = fakeContext();
    const audio = new GameAudio(() => ctx as unknown as AudioContext);
    audio.unlock();
    audio.play('perfect', pitch);
    return ctx.frequencies;
  };
  const plain = play();
  expect(plain.length).toBeGreaterThan(0);
  expect(play(2)).toEqual(plain.map((f) => f * 2));
});

test('place has a voice', () => {
  const ctx = fakeContext();
  const audio = new GameAudio(() => ctx as unknown as AudioContext);
  audio.unlock();
  audio.play('place');
  expect(ctx.oscillators).toBeGreaterThan(0);
});

test('nothing plays before unlock', () => {
  const ctx = fakeContext();
  const audio = new GameAudio(() => ctx as unknown as AudioContext);
  audio.play('win');
  expect(ctx.oscillators).toBe(0);
});

describe('music', () => {
  const track = new Float32Array(100);
  const setup = () => {
    const ctx = fakeContext();
    const audio = new GameAudio(() => ctx as unknown as AudioContext);
    return { ctx, audio };
  };
  const gain = (ctx: ReturnType<typeof fakeContext>) => ctx.musicGains.at(-1)!.value;

  it('loops the track once unlocked and started', () => {
    const { ctx, audio } = setup();
    audio.unlock();
    audio.setMusic('march', track, 22050);
    audio.startMusic('march');
    expect(ctx.sources).toHaveLength(1);
    expect(ctx.sources[0]).toMatchObject({ loop: true, started: 1 });
    expect(gain(ctx)).toBe(MUSIC_VOLUME);
  });

  it('starts as soon as a late track arrives, if play was already asked for', () => {
    const { ctx, audio } = setup();
    audio.unlock();
    audio.startMusic('march');
    expect(ctx.sources).toHaveLength(0);
    audio.setMusic('march', track, 22050);
    expect(ctx.sources).toHaveLength(1);
  });

  it('waits for unlock before playing', () => {
    const { ctx, audio } = setup();
    audio.setMusic('march', track, 22050);
    audio.startMusic('march');
    expect(ctx.sources).toHaveLength(0);
    audio.unlock();
    expect(ctx.sources).toHaveLength(1);
  });

  it('starting twice does not layer a second copy', () => {
    const { ctx, audio } = setup();
    audio.unlock();
    audio.setMusic('march', track, 22050);
    audio.startMusic('march');
    audio.startMusic('march');
    expect(ctx.sources).toHaveLength(1);
  });

  it('builds the audio buffer once and reuses it', () => {
    const { ctx, audio } = setup();
    audio.unlock();
    audio.setMusic('march', track, 22050);
    audio.startMusic('march');
    audio.stopMusic();
    audio.startMusic('march');
    expect(ctx.buffers).toBe(1);
    expect(ctx.sources).toHaveLength(2);
  });

  it('stopping stops the track, and a late track does not start it again', () => {
    const { ctx, audio } = setup();
    audio.unlock();
    audio.startMusic('march');
    audio.stopMusic();
    audio.setMusic('march', track, 22050);
    expect(ctx.sources).toHaveLength(0);
    audio.startMusic('march');
    audio.stopMusic();
    expect(ctx.sources[0].stopped).toBe(1);
  });

  it('mute silences the music and unmute brings it back', () => {
    const { ctx, audio } = setup();
    audio.unlock();
    audio.setMusic('march', track, 22050);
    audio.startMusic('march');
    audio.muted = true;
    expect(gain(ctx)).toBe(0);
    audio.muted = false;
    expect(gain(ctx)).toBe(MUSIC_VOLUME);
  });

  it('ducking lowers the music without stopping it', () => {
    const { ctx, audio } = setup();
    audio.unlock();
    audio.setMusic('march', track, 22050);
    audio.startMusic('march');
    audio.duckMusic(true);
    expect(gain(ctx)).toBeGreaterThan(0);
    expect(gain(ctx)).toBeLessThan(MUSIC_VOLUME);
    audio.duckMusic(false);
    expect(gain(ctx)).toBe(MUSIC_VOLUME);
  });

  it('switching tracks fades out the old one and starts the new one', () => {
    const { ctx, audio } = setup();
    audio.unlock();
    audio.setMusic('march', track, 22050);
    audio.setMusic('boss', track, 22050);
    audio.startMusic('march');
    const marchGain = ctx.musicGains.at(-1)!;
    audio.startMusic('boss');
    expect(ctx.sources).toHaveLength(2);
    expect(ctx.sources[0].stopped).toBe(1);
    expect(marchGain.value).toBe(0);
    expect(ctx.sources[1]).toMatchObject({ loop: true, started: 1 });
    expect(gain(ctx)).toBe(MUSIC_VOLUME);
  });

  it('keeps one buffer per track', () => {
    const { ctx, audio } = setup();
    audio.unlock();
    audio.setMusic('march', track, 22050);
    audio.setMusic('boss', track, 22050);
    for (const name of ['march', 'boss', 'march', 'boss']) audio.startMusic(name);
    expect(ctx.buffers).toBe(2);
  });

  it('a late track only starts if it is the one asked for', () => {
    const { ctx, audio } = setup();
    audio.unlock();
    audio.startMusic('boss');
    audio.setMusic('march', track, 22050);
    expect(ctx.sources).toHaveLength(0);
    audio.setMusic('boss', track, 22050);
    expect(ctx.sources).toHaveLength(1);
  });

  it('asking for a track that has not arrived stops the old one meanwhile', () => {
    const { ctx, audio } = setup();
    audio.unlock();
    audio.setMusic('march', track, 22050);
    audio.startMusic('march');
    audio.startMusic('boss');
    expect(ctx.sources[0].stopped).toBe(1);
    audio.setMusic('boss', track, 22050);
    expect(ctx.sources).toHaveLength(2);
  });

  it('a switched-to track stays ducked while paused', () => {
    const { ctx, audio } = setup();
    audio.unlock();
    audio.setMusic('march', track, 22050);
    audio.setMusic('boss', track, 22050);
    audio.startMusic('march');
    audio.duckMusic(true);
    audio.startMusic('boss');
    expect(gain(ctx)).toBeLessThan(MUSIC_VOLUME);
  });
});
