import { describe, expect, it } from 'vitest';
import { encodeWav, midiToFreq, parseNote, renderSong, songSeconds, transpose, type Song } from '../../engine/music.ts';

const rest = '. . . . . . . . . . . . . . . .';

describe('notes', () => {
  it('parses note names to MIDI numbers', () => {
    expect(parseNote('A4')).toBe(69);
    expect(parseNote('C4')).toBe(60);
    expect(parseNote('Bb3')).toBe(58);
    expect(parseNote('F#4')).toBe(66);
  });

  it('rejects anything that is not a note', () => {
    expect(() => parseNote('H4')).toThrow('not a note: H4');
  });

  it('A4 is 440 Hz and an octave doubles it', () => {
    expect(midiToFreq(69)).toBeCloseTo(440);
    expect(midiToFreq(81)).toBeCloseTo(880);
  });

  it('transposes note names, keeping flats as written by default sharps', () => {
    expect(transpose('C4', 7)).toBe('G4');
    expect(transpose('C2', 12)).toBe('C3');
    expect(transpose('A4', -12)).toBe('A3');
    expect(parseNote(transpose('Bb3', 2))).toBe(60);
  });
});

describe('renderSong', () => {
  const song: Song = {
    bpm: 120,
    tracks: [
      { instrument: 'lead', volume: 1, bars: ['C5 - - - E5 - - - G5 - - - . . . .', rest] },
      { instrument: 'drums', volume: 1, bars: ['k . . . s . . . k . . . s . . .', 'k . h . s . h . k . h . s g s s'] },
    ],
  };

  it('is exactly as long as its bars', () => {
    // 2 bars of 4 beats at 120 BPM = 4 s.
    expect(songSeconds(song)).toBe(4);
    expect(renderSong(song, 8000)).toHaveLength(32000);
  });

  it('renders the same samples every time', () => {
    expect(renderSong(song, 8000)).toEqual(renderSong(song, 8000));
  });

  it('is loud but never clips', () => {
    const peak = renderSong(song, 8000).reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    expect(peak).toBeLessThanOrEqual(1);
    expect(peak).toBeGreaterThan(0.5);
  });

  it('lets a note at the end ring on into the start, so the loop is seamless', () => {
    const tail: Song = { bpm: 120, tracks: [{ instrument: 'bass', volume: 1, bars: [rest, '. . . . . . . . . . . . . . . C2'] }] };
    const out = renderSong(tail, 8000);
    const startEnergy = out.slice(0, 400).reduce((s, v) => s + Math.abs(v), 0);
    expect(startEnergy).toBeGreaterThan(1);
  });

  it('names the track and bar of a bar with the wrong number of steps', () => {
    const bad: Song = { bpm: 120, tracks: [{ instrument: 'lead', volume: 1, bars: [rest, 'C5 - - .'] }] };
    expect(() => renderSong(bad, 8000)).toThrow('track 1 bar 2: expected 16 steps, got 4');
  });

  it('rejects tracks of different lengths', () => {
    const uneven: Song = {
      bpm: 120,
      tracks: [
        { instrument: 'lead', volume: 1, bars: [rest] },
        { instrument: 'bass', volume: 1, bars: [rest, rest] },
      ],
    };
    expect(() => renderSong(uneven, 8000)).toThrow('track 2 has 2 bars, expected 1');
  });

  it('rejects unknown drum hits', () => {
    const bad: Song = { bpm: 120, tracks: [{ instrument: 'drums', volume: 1, bars: ['z . . . . . . . . . . . . . . .'] }] };
    expect(() => renderSong(bad, 8000)).toThrow('track 1 bar 1: unknown drum z');
  });
});

describe('encodeWav', () => {
  it('writes a 16-bit mono WAV header and one 2-byte sample per input sample', () => {
    const wav = encodeWav(new Float32Array([0, 1, -1]), 8000);
    const view = new DataView(wav.buffer);
    expect(new TextDecoder().decode(wav.slice(0, 4))).toBe('RIFF');
    expect(new TextDecoder().decode(wav.slice(8, 12))).toBe('WAVE');
    expect(view.getUint32(24, true)).toBe(8000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(wav).toHaveLength(44 + 6);
    expect(view.getInt16(46, true)).toBe(32767);
    expect(view.getInt16(48, true)).toBe(-32767);
  });
});
