// Tiny synthesized sound effects: no audio files. Silent until unlock() is
// called from a user gesture (browser autoplay rules).

export type Sfx = 'shot' | 'hit' | 'gain' | 'lose' | 'win' | 'fail' | 'boss';

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
};

// Rapid-fire sounds are rate-limited so big squads don't stack dozens of
// voices and clip.
const MIN_GAP: Partial<Record<Sfx, number>> = { shot: 0.05, hit: 0.05 };

export class GameAudio {
  muted = false;
  private ctx: AudioContext | null = null;
  private last: Partial<Record<Sfx, number>> = {};
  private createContext: () => AudioContext;

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
  }

  play(s: Sfx): void {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
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
