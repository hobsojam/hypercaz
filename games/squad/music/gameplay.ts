// Main gameplay loop: a cartoon military march in C major, 136 BPM, 32 bars
// (~56 s), looping seamlessly. Bugle-call hook, octave-bouncing bass,
// "oom-pah" brass stabs on the offbeats and a marching snare.
//   A  bars 1-8   the hook
//   B  bars 9-16  heroic long notes (borrowed Bb chord)
//   C  bars 17-24 staccato riff in A minor over a busier snare
//   D  bars 25-32 the hook again, doubled an octave down, rolling back to A
import type { Song } from '../../../engine/music.ts';
import { bassNotes, type Chord, octaveDown, REST, section, VOICING } from './parts.ts';

// prettier-ignore
const CHORDS: Chord[] = [
  'C', 'F', 'C', 'G', 'C', 'F', 'G', 'C',
  'C', 'Bb', 'F', 'C', 'C', 'Bb', 'F', 'G',
  'Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'G',
  'C', 'Bb', 'F', 'C', 'F', 'G', 'C', 'G',
];

// Root, octave, fifth, octave on the eighths.
function bassBar(chord: Chord): string {
  const { r, o, f } = bassNotes(chord);
  return `${r} . ${o} . ${f} . ${o} . ${r} . ${o} . ${f} . ${o} .`;
}

// Chord stabs on the "and" of every beat.
function stabBar(chord: Chord): string {
  const c = VOICING[chord];
  return `. . ${c} . . . ${c} . . . ${c} . . . ${c} .`;
}

const HOOK_1 = 'G4 . C5 . E5 - G5 - . . E5 . C5 - - .';
const HOOK_3 = 'G4 . C5 . E5 - G5 - C6 - - - G5 - E5 .';
const HOOK_6 = 'A4 - C5 . F5 - - . A5 - G5 . F5 . E5 .';

const A = [
  HOOK_1,
  'A4 - C5 . F5 - - . E5 . D5 . C5 - A4 .',
  HOOK_3,
  'D5 - - . B4 . G4 . A4 . B4 . D5 - - .',
  HOOK_1,
  HOOK_6,
  'D5 - G5 - B4 - D5 . G5 - F5 . D5 . B4 .',
  'C5 - - - E5 . G5 . C6 - - - . . . .',
];

const B = [
  'E5 - - - - - G5 - - - C6 - - - - -',
  'D6 - - - - - C6 - - - Bb5 - - - - -',
  'A5 - - - - - G5 - - - F5 - - - A5 -',
  'G5 - - - - - - - - - - - . . . .',
  'E5 - - - - - G5 - - - C6 - - - - -',
  'D6 - - - - - F6 - - - D6 - - - Bb5 -',
  'C6 - - - - - A5 - - - F5 - - - A5 -',
  'G5 - - - - - - - B5 - - - D6 - - -',
];

const RIFF_AM = 'A4 . C5 . E5 . A5 . G5 . E5 . C5 . E5 .';
const RIFF_F = 'F4 . A4 . C5 . F5 . E5 . C5 . A4 . C5 .';

const C = [
  RIFF_AM,
  RIFF_F,
  'E4 . G4 . C5 . E5 . D5 . C5 . G4 . C5 .',
  'D5 . B4 . G4 . B4 . D5 - - . G5 - - .',
  RIFF_AM,
  RIFF_F,
  'D5 . F5 . A5 . F5 . D5 . F5 . A5 . D6 .',
  'B5 - - - A5 - - - G5 - - - F5 - D5 -',
];

const D = [
  HOOK_1,
  'Bb4 - D5 . F5 - - . F5 . D5 . C5 - Bb4 .',
  HOOK_6,
  HOOK_3,
  'A5 - - - G5 - F5 - A5 - - - C6 - - -',
  'B5 - - - A5 - G5 - D6 - - - B5 - - -',
  'C6 - - - G5 . E5 . C5 - - - E5 . G5 .',
  'D5 - - - - - - - . . . . . . . .',
];

const GROOVE = 'k+h . h . s+h . h g k+h . k+h . s+h . h g';
const CRASH = 'x+k . h . s+h . h g k+h . k+h . s+h . h g';
const MARCH = 'k+h g h g s+h g h g k+h g k+h g s+h g s g';
const MARCH_CRASH = 'x+k g h g s+h g h g k+h g k+h g s+h g s g';
const TURN = 'k+h . h . s+h . h g k+h . s . s s s s';
const ROLL = 'k . s . s . s . s s s s s s s s';

export const GAMEPLAY_SONG: Song = {
  bpm: 136,
  tracks: [
    { instrument: 'lead', volume: 0.5, echo: true, bars: [...A, ...B, ...C, ...D] },
    {
      instrument: 'lead',
      volume: 0.22,
      bars: [...A.map(() => REST), ...B.map(octaveDown), ...C.map(() => REST), ...D.map(octaveDown)],
    },
    { instrument: 'bass', volume: 0.55, bars: CHORDS.map(bassBar) },
    { instrument: 'brass', volume: 0.3, bars: CHORDS.map(stabBar) },
    {
      instrument: 'drums',
      volume: 0.7,
      bars: [
        ...section(CRASH, GROOVE, TURN),
        ...section(CRASH, GROOVE, TURN),
        ...section(MARCH_CRASH, MARCH, ROLL),
        ...section(CRASH, GROOVE, ROLL),
      ],
    },
  ],
};
