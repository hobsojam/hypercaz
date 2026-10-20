// Shared building blocks for the songs: chord roots and voicings, and helpers
// for writing bars.
import { transpose } from '../../../engine/music.ts';

export type Chord = 'C' | 'D' | 'F' | 'G' | 'Bb' | 'B' | 'Am' | 'Dm' | 'Em' | 'Gm';

export const REST = '. . . . . . . . . . . . . . . .';

export const ROOT: Record<Chord, string> = {
  C: 'C2',
  D: 'D2',
  F: 'F2',
  G: 'G2',
  Bb: 'Bb1',
  B: 'B1',
  Am: 'A1',
  Dm: 'D2',
  Em: 'E2',
  Gm: 'G1',
};

export const VOICING: Record<Chord, string> = {
  C: 'C4+E4+G4',
  D: 'A3+D4+F#4',
  F: 'C4+F4+A4',
  G: 'B3+D4+G4',
  Bb: 'Bb3+D4+F4',
  B: 'B3+D#4+F#4',
  Am: 'A3+C4+E4',
  Dm: 'A3+D4+F4',
  Em: 'B3+E4+G4',
  Gm: 'Bb3+D4+G4',
};

// The chord's root, its octave and its fifth, for writing bass lines.
export function bassNotes(chord: Chord): { r: string; o: string; f: string } {
  const r = ROOT[chord];
  return { r, o: transpose(r, 12), f: transpose(r, 7) };
}

export function octaveDown(bar: string): string {
  return bar
    .split(' ')
    .map((t) => (t === '.' || t === '-' ? t : transpose(t, -12)))
    .join(' ');
}

// An 8-bar drum section: an opening bar, six of the groove and a fill.
export const section = (first: string, middle: string, last: string): string[] => [first, ...Array.from({ length: 6 }, () => middle), last];
