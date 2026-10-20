// Tiny synthesized sound effects: no audio files. Silent until unlock() is
// called from a user gesture (browser autoplay rules).

export type Sfx = 'shot' | 'hit' | 'gain' | 'lose' | 'win' | 'fail' | 'boss' | 'warn' | 'ready' | 'burst';

interface Voice {
  type: OscillatorType;
  from: number;
  to: number;
  dur: number;
  vol: number;
}

const VOICES: Record<Sfx, Voice[]> = {
  shot: [{ type: 'square', from: 900, to: 500, dur: 0.04, vol: 0.03 }],
  hit: [{ type: 'triangle', from: 300, to: 120, dur: 0.06, vol: 0.08 }],
  gain: [
    { type: 'sine', from: 600, to: 900, dur: 0.12, vol: 0.12 },
    { type: 'sine', from: 900, to: 1300, dur: 0.12, vol: 0.08 },
  ],
  lose: [{ type: 'sawtooth', from: 220, to: 90, dur: 0.18, vol: 0.08 }],
  win: [
    { type: 'triangle', from: 523, to: 523, dur: 0.15, vol: 0.15 },
    { type: 'triangle', from: 659, to: 659, dur: 0.15, vol: 0.15 },
    { type: 'triangle', from: 784, to: 1046, dur: 0.4, vol: 0.15 },
  ],
  fail: [{ type: 'sawtooth', from: 300, to: 60, dur: 0.7, vol: 0.12 }],
  boss: [{ type: 'square', from: 110, to: 70, dur: 0.5, vol: 0.12 }],
  warn: [
    { type: 'square', from: 880, to: 880, dur: 0.08, vol: 0.06 },
    { type: 'square', from: 1175, to: 1175, dur: 0.12, vol: 0.06 },
  ],
  ready: [
    { type: 'triangle', from: 784, to: 784, dur: 0.1, vol: 0.12 },
    { type: 'triangle', from: 1175, to: 1568, dur: 0.2, vol: 0.12 },
  ],
  burst: [{ type: 'sawtooth', from: 200, to: 900, dur: 0.35, vol: 0.1 }],
};

// Rapid-fire sounds are rate-limited so big squads don't stack dozens of
// voices and clip.
const MIN_GAP: Partial<Record<Sfx, number>> = { shot: 0.05, hit: 0.05 };

// Music sits under the effects: its average level (~0.36 of this) stays below
// the hit, gain and boss sounds.
export const MUSIC_VOLUME = 0.12;
const DUCKED = 0.3; // fraction of the music volume while ducked (e.g. paused)

export class GameAudio {
  private ctx: AudioContext | null = null;
  private last: Partial<Record<Sfx, number>> = {};
  private createContext: () => AudioContext;
  private isMuted = false;
  // Music: the rendered track may arrive after play was asked for (it is
  // rendered off the main thread), so remember the request.
  private track: { samples: Float32Array<ArrayBuffer>; sampleRate: number } | null = null;
  private buffer: AudioBuffer | null = null;
  private music: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private wantMusic = false;
  private ducked = false;

  constructor(createContext: () => AudioContext = () => new AudioContext()) {
    this.createContext = createContext;
  }

  // Call from inside a real user-gesture handler: Safari only lets audio
  // start (or resume) while the gesture is in progress.
  unlock(): void {
    if (!this.ctx) {
      try {
        this.ctx = this.createContext();
      } catch {
        this.ctx = null;
        return;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
    this.syncMusic();
  }

  // The page went into the background: stop all sound. The next gesture's
  // unlock() resumes it.
  hide(): void {
    if (this.ctx?.state === 'running') void this.ctx.suspend().catch(() => {});
  }

  get muted(): boolean {
    return this.isMuted;
  }

  set muted(m: boolean) {
    this.isMuted = m;
    this.applyMusicVolume();
  }

  setMusic(samples: Float32Array<ArrayBuffer>, sampleRate: number): void {
    this.track = { samples, sampleRate };
    this.buffer = null;
    this.syncMusic();
  }

  startMusic(): void {
    this.wantMusic = true;
    this.syncMusic();
  }

  stopMusic(): void {
    this.wantMusic = false;
    const m = this.music;
    if (!m || !this.ctx) return;
    this.music = null;
    const t = this.ctx.currentTime;
    m.gain.gain.cancelScheduledValues(t);
    m.gain.gain.setTargetAtTime(0, t, 0.08);
    m.source.stop(t + 0.4);
  }

  duckMusic(on: boolean): void {
    this.ducked = on;
    this.applyMusicVolume();
  }

  private syncMusic(): void {
    const ctx = this.ctx;
    if (!this.wantMusic || this.music || !ctx || !this.track) return;
    if (!this.buffer) {
      this.buffer = ctx.createBuffer(1, this.track.samples.length, this.track.sampleRate);
      this.buffer.copyToChannel(this.track.samples, 0);
    }
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = this.buffer;
    source.loop = true;
    source.connect(gain).connect(ctx.destination);
    this.music = { source, gain };
    this.applyMusicVolume();
    source.start();
  }

  private applyMusicVolume(): void {
    if (!this.music || !this.ctx) return;
    let target = this.ducked ? MUSIC_VOLUME * DUCKED : MUSIC_VOLUME;
    if (this.isMuted) target = 0;
    this.music.gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
  }

  play(s: Sfx): void {
    const ctx = this.ctx;
    if (!ctx || this.isMuted) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    const gap = MIN_GAP[s];
    if (gap !== undefined) {
      const last = this.last[s];
      if (last !== undefined && ctx.currentTime - last < gap) return;
      this.last[s] = ctx.currentTime;
    }
    let t = ctx.currentTime;
    for (const v of VOICES[s]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = v.type;
      osc.frequency.setValueAtTime(v.from, t);
      osc.frequency.exponentialRampToValueAtTime(v.to, t + v.dur);
      gain.gain.setValueAtTime(v.vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + v.dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + v.dur);
      if (s === 'win') t += v.dur * 0.8;
    }
  }
}
