// Boss loop: a driving minor-key battle theme in E minor, 156 BPM, 16 bars
// (~25 s). Pumping eighth-note bass, syncopated brass hits and a busy
// snare; the B major chord (borrowed from harmonic minor) keeps it tense.
//   A  bars 1-8   a low, menacing riff
//   B  bars 9-16  the lead climbs into long, urgent notes, doubled an octave
//                 down, and lands on B to throw the loop back to the riff
import type { Song } from '../../../engine/music.ts';
import { bassNotes, type Chord, octaveDown, REST, section, VOICING } from './parts.ts';

// prettier-ignore
const CHORDS: Chord[] = [
  'Em', 'Em', 'C', 'D', 'Em', 'Em', 'C', 'B',
  'Am', 'Am', 'Em', 'Em', 'C', 'D', 'B', 'B',
];

// Eighth-note pulse on the root, jumping to the octave and the fifth.
function bassBar(chord: Chord): string {
  const { r, o, f } = bassNotes(chord);
  return `${r} . ${r} . ${o} . ${r} . ${r} . ${r} . ${o} . ${f} .`;
}

// Hits on 1, the "and" of 2, and 3.
function stabBar(chord: Chord): string {
  const c = VOICING[chord];
  return `${c} - . . . . ${c} . . . ${c} - . . . .`;
}

const RIFF = 'E5 . E5 . G5 . E5 . B5 - A5 . G5 . F#5 .';

const A = [
  RIFF,
  'E5 . E5 . G5 . B5 . E6 - - . D6 . B5 .',
  'C6 - - . B5 . G5 . E5 - - . G5 . C6 .',
  'D6 - - . C6 . A5 . F#5 - - . A5 . D6 .',
  RIFF,
  'E5 . E5 . G5 . E5 . B5 - C6 . B5 . A5 .',
  'G5 - - . E5 . C5 . E5 - G5 - C6 - - .',
  'B5 - - - D#6 - - - F#6 - - - D#6 - B5 -',
];

const B = [
  'A5 - - - - - C6 - - - E6 - - - - -',
  'D6 - - - C6 - - - B5 - - - A5 - - -',
  'G5 - - - - - B5 - - - E6 - - - - -',
  'F#6 - - - E6 - - - D6 - - - B5 - - -',
  'C6 - - - - - E6 - - - G5 - - - - -',
  'F#6 - - - - - D6 - - - A5 - - - - -',
  'B5 - - - - - - - D#6 - - - - - - -',
  'F#6 - - - E6 - D#6 - B5 - - - . . . .',
];

const DRIVE = 'k+h h k+h h s+h h k+h h k+h h k+h h s+h h s+h s';
const DRIVE_IN = 'x+k h k+h h s+h h k+h h k+h h k+h h s+h h s+h s';
const FILL = 's s s s s s s s k+s . k+s . s s s s';

export const BOSS_SONG: Song = {
  bpm: 156,
  tracks: [
    { instrument: 'lead', volume: 0.45, echo: true, bars: [...A, ...B] },
    { instrument: 'lead', volume: 0.22, bars: [...A.map(() => REST), ...B.map(octaveDown)] },
    { instrument: 'bass', volume: 0.6, bars: CHORDS.map(bassBar) },
    { instrument: 'brass', volume: 0.32, bars: CHORDS.map(stabBar) },
    { instrument: 'drums', volume: 0.75, bars: [...section(DRIVE_IN, DRIVE, FILL), ...section(DRIVE_IN, DRIVE, FILL)] },
  ],
};
