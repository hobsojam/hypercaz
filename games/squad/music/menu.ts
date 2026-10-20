// Menu loop: a relaxed bugle tune in F major, 108 BPM, 16 bars (~36 s).
// The same cartoon-army world as the gameplay march, off duty: a lazy
// two-beat bass, soft brass on the backbeat and brushed-sounding drums.
//   A  bars 1-8   the bugle call, ending on C so it can answer itself
//   B  bars 9-16  a longer, singing reply that turns back to A
import type { Song } from '../../../engine/music.ts';
import { bassNotes, type Chord, octaveDown, REST, section, VOICING } from './parts.ts';

// prettier-ignore
const CHORDS: Chord[] = [
  'F', 'F', 'Bb', 'F', 'Dm', 'Gm', 'C', 'C',
  'Bb', 'F', 'Gm', 'Dm', 'Bb', 'F', 'C', 'C',
];

// Root on beat 1, fifth on beat 3, each held for most of a half note.
function bassBar(chord: Chord): string {
  const { r, f } = bassNotes(chord);
  return `${r} - - - - - - . ${f} - - - - - - .`;
}

// Short brass chords on beats 2 and 4.
function stabBar(chord: Chord): string {
  const c = VOICING[chord];
  return `. . . . ${c} - . . . . . . ${c} - . .`;
}

const A = [
  'C5 - - . F5 - . F5 A5 - - - F5 - - .',
  'C6 - - - A5 - - . F5 - - - . . . .',
  'D5 - - . F5 - . F5 Bb5 - - - D6 - - .',
  'C6 - - - - - - - A5 - - - . . . .',
  'A5 - - . F5 - . D5 F5 - - - A5 - - .',
  'Bb5 - - - G5 - - . D5 - - - G5 - - .',
  'E5 - - . G5 - . C6 Bb5 - - - G5 - - .',
  'C5 - - - - - - - . . . . . . . .',
];

const B = [
  'D6 - - - - - - - Bb5 - - - F5 - - -',
  'A5 - - - - - - - F5 - - - C5 - - -',
  'Bb5 - - - A5 - - - G5 - - - D5 - - -',
  'F5 - - - - - - - . . . . A4 - C5 -',
  'D5 - - . F5 - . Bb5 D6 - - - Bb5 - - .',
  'C6 - - - A5 - - - F5 - - - A5 - - -',
  'G5 - - - - - - - E5 - - - C5 - - -',
  'E5 - - - G5 - - - C5 - - - - - . .',
];

const STROLL = 'k . h . g . h . k . h . g . h .';
const STROLL_IN = 'x+k . h . g . h . k . h . g . h .';
const STROLL_TURN = 'k . h . g . h . k . h . s . g g';

export const MENU_SONG: Song = {
  bpm: 108,
  tracks: [
    { instrument: 'lead', volume: 0.45, echo: true, bars: [...A, ...B] },
    { instrument: 'lead', volume: 0.18, bars: [...A.map(() => REST), ...B.map(octaveDown)] },
    { instrument: 'bass', volume: 0.5, bars: CHORDS.map(bassBar) },
    { instrument: 'brass', volume: 0.22, bars: CHORDS.map(stabBar) },
    { instrument: 'drums', volume: 0.45, bars: [...section(STROLL_IN, STROLL, STROLL_TURN), ...section(STROLL, STROLL, STROLL_TURN)] },
  ],
};
