// A tiny step-sequenced synthesizer. Songs are written as bars of 16 steps
// (sixteenth notes): a note name starts a note, '-' holds it, '.' is silence,
// and '+' joins notes into a chord (or drum hits into one step). Rendering
// produces raw mono samples, so the same song can be written to a WAV file or
// played in the browser. Output loops seamlessly: anything still ringing at
// the end of the song wraps round onto its start.
import { createRng, nextFloat } from './rng.ts';

export type Instrument = 'lead' | 'bass' | 'brass' | 'drums';

export interface Track {
  instrument: Instrument;
  volume: number;
  bars: string[];
  echo?: boolean; // a dotted-eighth echo, for the melody
}

export interface Song {
  bpm: number;
  tracks: Track[];
}

export const STEPS_PER_BAR = 16;

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const LETTERS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACCIDENTALS: Record<string, number> = { '#': 1, b: -1, '': 0 };

export function parseNote(name: string): number {
  const m = /^([A-G])([#b])?(-?\d)$/.exec(name);
  if (!m) throw new Error(`not a note: ${name}`);
  return (Number(m[3]) + 1) * 12 + LETTERS[m[1]] + ACCIDENTALS[m[2] ?? ''];
}

export function noteName(midi: number): string {
  return `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

export function transpose(name: string, semitones: number): string {
  return noteName(parseNote(name) + semitones);
}

export function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function stepSeconds(song: Song): number {
  return 60 / song.bpm / 4;
}

export function songSeconds(song: Song): number {
  return (song.tracks[0]?.bars.length ?? 0) * STEPS_PER_BAR * stepSeconds(song);
}

interface NoteEvent {
  step: number;
  steps: number;
  parts: string[];
}

const DRUMS = new Set(['k', 's', 'g', 'h', 'o', 'x']);

function parseTrack(track: Track, index: number, barCount: number): NoteEvent[] {
  const where = (bar: number) => `track ${index + 1} bar ${bar + 1}`;
  if (track.bars.length !== barCount) throw new Error(`track ${index + 1} has ${track.bars.length} bars, expected ${barCount}`);
  const events: NoteEvent[] = [];
  let last: NoteEvent | null = null;
  track.bars.forEach((bar, b) => {
    const tokens = bar.trim().split(/\s+/);
    if (tokens.length !== STEPS_PER_BAR) throw new Error(`${where(b)}: expected ${STEPS_PER_BAR} steps, got ${tokens.length}`);
    tokens.forEach((token, s) => {
      if (token === '-') {
        if (last) last.steps++;
        return;
      }
      if (token === '.') {
        last = null;
        return;
      }
      const parts = token.split('+');
      for (const p of parts) {
        if (track.instrument === 'drums') {
          if (!DRUMS.has(p)) throw new Error(`${where(b)}: unknown drum ${p}`);
        } else {
          parseNote(p);
        }
      }
      last = { step: b * STEPS_PER_BAR + s, steps: 1, parts };
      events.push(last);
    });
  });
  return events;
}

// Writes into a circular buffer, so tails wrap round to the start.
class Bus {
  readonly data: Float32Array;
  readonly length: number;
  constructor(length: number) {
    this.length = length;
    this.data = new Float32Array(length);
  }
  add(i: number, v: number): void {
    this.data[((i % this.length) + this.length) % this.length] += v;
  }
}

type Noise = () => number;

interface Voice {
  bus: Bus;
  start: number; // sample index
  dur: number; // seconds the note is held
  freq: number;
  vol: number;
  sr: number;
}

// Square-ish lead: a 25% pulse with a little delayed vibrato.
function lead({ bus, start, dur, freq, vol, sr }: Voice): void {
  const hold = dur * 0.9;
  const release = 0.05;
  const duty = 0.25;
  let phase = 0;
  const level = (t: number) => (t < 0.005 ? t / 0.005 : 0.6 + 0.4 * Math.exp(-(t - 0.005) / 0.06));
  for (let k = 0, n = Math.ceil((hold + release) * sr); k < n; k++) {
    const t = k / sr;
    const env = t < hold ? level(t) : level(hold) * (1 - (t - hold) / release);
    const vib = t > 0.12 ? 1 + 0.004 * Math.sin(2 * Math.PI * 5.5 * t) : 1;
    phase += (freq * vib) / sr;
    const pulse = (phase % 1 < duty ? 1 : -1) - (2 * duty - 1);
    bus.add(start + k, pulse * env * vol);
  }
}

// Round bass: triangle with a touch of square for punch.
function bass({ bus, start, dur, freq, vol, sr }: Voice): void {
  const hold = dur * 0.85;
  const release = 0.03;
  let phase = 0;
  for (let k = 0, n = Math.ceil((hold + release) * sr); k < n; k++) {
    const t = k / sr;
    const sustain = Math.exp(-t / 0.6);
    const env = (t < 0.003 ? t / 0.003 : 1) * (t < hold ? sustain : sustain * (1 - (t - hold) / release));
    phase += freq / sr;
    const p = phase % 1;
    const tri = 1 - 4 * Math.abs(p - 0.5);
    const sq = p < 0.5 ? 1 : -1;
    bus.add(start + k, (0.8 * tri + 0.2 * sq) * env * vol);
  }
}

// Brass stab: two slightly detuned saws through a closing low-pass filter.
function brass({ bus, start, dur, freq, vol, sr }: Voice): void {
  const hold = Math.max(dur, 0.08);
  const release = 0.04;
  let p1 = 0;
  let p2 = 0;
  let y = 0;
  for (let k = 0, n = Math.ceil((hold + release) * sr); k < n; k++) {
    const t = k / sr;
    const decay = Math.exp(-t / 0.09);
    const env = (t < 0.008 ? t / 0.008 : 1) * (t < hold ? decay : decay * (1 - (t - hold) / release));
    p1 += (freq * 1.003) / sr;
    p2 += (freq * 0.997) / sr;
    const x = (2 * (p1 % 1) - 1 + 2 * (p2 % 1) - 1) / 2;
    const cutoff = 800 + 2400 * Math.exp(-t / 0.05);
    y += (1 - Math.exp((-2 * Math.PI * cutoff) / sr)) * (x - y);
    bus.add(start + k, y * env * vol);
  }
}

function drum(hit: string, bus: Bus, start: number, vol: number, sr: number, noise: Noise): void {
  const run = (seconds: number, sample: (t: number, n: number) => number) => {
    let prev = 0;
    for (let k = 0, n = Math.ceil(seconds * sr); k < n; k++) {
      const raw = noise();
      const hp = raw - prev; // crude high-pass: brighter noise for snares and hats
      prev = raw;
      bus.add(start + k, sample(k / sr, hp) * vol);
    }
  };
  switch (hit) {
    case 'k': {
      let phase = 0;
      run(0.35, (t) => {
        phase += (45 + 105 * Math.exp(-t / 0.03)) / sr;
        return Math.sin(2 * Math.PI * phase) * Math.exp(-t / 0.18);
      });
      break;
    }
    case 's':
    case 'g': {
      const ghost = hit === 'g' ? 0.3 : 1;
      run(hit === 'g' ? 0.1 : 0.25, (t, n) => ghost * (0.7 * n * Math.exp(-t / 0.09) + 0.5 * Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t / 0.04)));
      break;
    }
    case 'h':
      run(0.06, (t, n) => 0.5 * n * Math.exp(-t / 0.025));
      break;
    case 'o':
      run(0.3, (t, n) => 0.5 * n * Math.exp(-t / 0.12));
      break;
    case 'x':
      run(2, (t, n) => 0.5 * n * Math.exp(-t / 0.9));
      break;
  }
}

const VOICES: Record<Exclude<Instrument, 'drums'>, (v: Voice) => void> = { lead, bass, brass };

// Feedback delay on a loop: the echo of the last notes lands on the first.
function addEcho(bus: Bus, delay: number, feedback: number, mix: number): void {
  const dry = bus.data.slice();
  const wet = dry.slice();
  const n = bus.length;
  for (let k = 0; k < 3 * n; k++) {
    const i = k % n;
    wet[i] = dry[i] + feedback * wet[(i - delay + n) % n];
  }
  for (let i = 0; i < n; i++) bus.data[i] = dry[i] + mix * (wet[i] - dry[i]);
}

export function renderSong(song: Song, sampleRate: number, seed = 1): Float32Array {
  const barCount = song.tracks[0]?.bars.length ?? 0;
  const parsed = song.tracks.map((t, i) => parseTrack(t, i, barCount));
  const length = Math.round(songSeconds(song) * sampleRate);
  const step = stepSeconds(song);
  let rng = createRng(seed);
  const noise = () => {
    const [v, next] = nextFloat(rng);
    rng = next;
    return v * 2 - 1;
  };

  const mix = new Float32Array(length);
  song.tracks.forEach((track, ti) => {
    const bus = new Bus(length);
    for (const e of parsed[ti]) {
      const start = Math.round(e.step * step * sampleRate);
      if (track.instrument === 'drums') {
        for (const hit of e.parts) drum(hit, bus, start, track.volume, sampleRate, noise);
        continue;
      }
      const voice = VOICES[track.instrument];
      const vol = track.volume / Math.sqrt(e.parts.length);
      for (const p of e.parts) voice({ bus, start, dur: e.steps * step, freq: midiToFreq(parseNote(p)), vol, sr: sampleRate });
    }
    if (track.echo) addEcho(bus, Math.round(3 * step * sampleRate), 0.35, 0.3);
    for (let i = 0; i < length; i++) mix[i] += bus.data[i];
  });

  // Gentle saturation, then normalise so the loudest moment sits just under full scale.
  let peak = 0;
  for (let i = 0; i < length; i++) {
    mix[i] = Math.tanh(mix[i] * 1.2);
    peak = Math.max(peak, Math.abs(mix[i]));
  }
  if (peak > 0) for (let i = 0; i < length; i++) mix[i] *= 0.9 / peak;
  return mix;
}

// 16-bit mono PCM WAV.
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const out = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const text = (at: number, s: string) => [...s].forEach((c, i) => out.setUint8(at + i, c.codePointAt(0)!));
  text(0, 'RIFF');
  out.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, 1, true);
  out.setUint32(24, sampleRate, true);
  out.setUint32(28, sampleRate * 2, true);
  out.setUint16(32, 2, true);
  out.setUint16(34, 16, true);
  text(36, 'data');
  out.setUint32(40, samples.length * 2, true);
  samples.forEach((v, i) => out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 32767, true));
  return new Uint8Array(out.buffer);
}
