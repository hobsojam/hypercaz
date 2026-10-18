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

export class GameAudio {
  muted = false;
  private ctx: AudioContext | null = null;
  private lastShot = 0;

  unlock(): void {
    if (this.ctx) return;
    try {
      this.ctx = new AudioContext();
    } catch {
      this.ctx = null;
    }
  }

  play(s: Sfx): void {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    if (s === 'shot') {
      if (ctx.currentTime - this.lastShot < 0.05) return;
      this.lastShot = ctx.currentTime;
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
