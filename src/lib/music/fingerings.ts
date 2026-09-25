// Oboe fingerings, keyed by MIDI note number.
//
// Each fingering lists the `id` attributes in fingering-chart.svg that get
// filled in, so the chart doubles as both the diagram and the data model — no
// separate coordinate table to keep in sync with the artwork.
//
// The six main tone holes are named for the note they produce as they're added
// downward from the open instrument: B A G (left hand 1-2-3) then F♯ E D
// (right hand 1-2-3).
//
// Sources, in order of authority:
//
//  - IDRS, the International Double Reed Society's standard oboe fingerings
//    (idrs.org/resources/fingerings). Its diagrams are drawn from the same
//    artwork fingering-chart.svg was traced from, so each one was read by
//    measuring which key shapes are filled rather than by eye.
//  - Yamaha's published oboe fingering chart, for F♯6 (which IDRS doesn't
//    list) and for alternates IDRS doesn't give.
//
// The default fingering for a note is the one both sources agree on where
// there is one, otherwise IDRS's first.
//
// A few things in here are counter-intuitive but come straight off the charts:
//
//  - Around C and B♭, RH1 stops behaving like a tone hole and acts as a vent
//    that *raises* the note a semitone. B4 (LH1) plus RH1 gives C5, and A4
//    (LH1+LH2) plus RH1 gives B♭4.
//  - F is E's fingering plus the F key, RH2 still down — not RH2 lifted.
//  - Low B and B♭ hold the right-pinky C key down under the left-pinky key.
//
// `b-half` is the half-hole — left index rolled down to crack a small vent —
// which is how C♯5–E♭5 speak. Above that come the octave keys: the thumb's
// 1st octave key for E5–G♯5, the side 2nd octave key alone for A5–C6. Above C6
// the pattern breaks up: C♯6 lifts LH1 and uses no octave key, D6–F6 go back
// to the half-hole, G6 and G♯6 switch to the thumb's 3rd octave key, and most
// notes lean on a pinky key to centre the pitch.

export const KEY_LABELS: Record<string, string> = {
  b: 'B (LH 1)',
  a: 'A (LH 2)',
  g: 'G (LH 3)',
  'f-sharp': 'F♯ (RH 1)',
  e: 'E (RH 2)',
  d: 'D (RH 3)',
  'b-half': 'half-hole (LH 1)',
  'octave-1': '1st octave key',
  'octave-2': '2nd octave key',
  'octave-3': '3rd octave key',
  'left-g-sharp': 'G♯ key (LH pinky)',
  'right-g-sharp': 'G♯ key (right hand)',
  'left-e-flat': 'E♭ key (LH pinky)',
  'left-f': 'F key (LH pinky)',
  'right-f': 'F key (RH pinky)',
  'right-c': 'C key (RH pinky)',
  'right-c-sharp': 'C♯ key (RH pinky)',
  'right-eb': 'E♭ key (RH pinky)',
  'low-b': 'low B key (LH pinky)',
  'low-b-flat': 'low B♭ key (LH pinky)'
};

export type Source = 'IDRS' | 'Yamaha';
export type Fingering = { name: string; keys: string[]; sources: Source[] };

const LH = ['b', 'a', 'g'];
const RH = ['f-sharp', 'e', 'd'];
const ALL = [...LH, ...RH];
const HALF = ['b-half', 'a', 'g', ...RH];
const BOTH: Source[] = ['IDRS', 'Yamaha'];

const one = (keys: string[], sources: Source[] = BOTH): Fingering[] => [{ name: 'Standard', keys, sources }];

/**
 * Every fingering for every charted note, default first. Covers B♭3 (the
 * oboe's lowest note) through A6, the top of IDRS's standard set; past that
 * the altissimo fingerings vary too much between instruments and reeds to
 * teach from a single diagram.
 */
export const FINGERING_OPTIONS: Record<number, Fingering[]> = {
  58: one([...ALL, 'right-c', 'low-b-flat']),   // Bb3
  59: one([...ALL, 'right-c', 'low-b']),        // B3
  60: one([...ALL, 'right-c']),                 // C4
  61: one([...ALL, 'right-c-sharp']),           // C#4
  62: one([...ALL]),                            // D4
  63: [                                         // Eb4
    { name: 'Right E♭ key', keys: [...ALL, 'right-eb'], sources: BOTH },
    { name: 'Left E♭ key', keys: [...ALL, 'left-e-flat'], sources: BOTH }
  ],
  64: one([...LH, 'f-sharp', 'e']),             // E4
  65: [                                         // F4 — E4 plus an F key, or forked
    { name: 'Right F key', keys: [...LH, 'f-sharp', 'e', 'right-f'], sources: BOTH },
    { name: 'Left F key', keys: [...LH, 'f-sharp', 'e', 'left-f'], sources: ['IDRS'] },
    { name: 'Forked F', keys: [...LH, 'f-sharp', 'd'], sources: BOTH }
  ],
  66: one([...LH, 'f-sharp']),                  // F#4
  67: one([...LH]),                             // G4
  68: [                                         // G#4
    { name: 'Left G♯ key', keys: [...LH, 'left-g-sharp'], sources: BOTH },
    { name: 'Right G♯ key', keys: [...LH, 'right-g-sharp'], sources: ['IDRS'] }
  ],
  69: one(['b', 'a']),                          // A4
  70: one(['b', 'a', 'f-sharp']),               // Bb4 — A4 vented by RH1
  71: one(['b']),                               // B4
  72: one(['b', 'f-sharp']),                    // C5 — "one and one": B4 vented by RH1
  73: one([...HALF, 'right-c-sharp']),          // C#5
  74: one([...HALF]),                           // D5
  75: [                                         // Eb5
    { name: 'Right E♭ key', keys: [...HALF, 'right-eb'], sources: BOTH },
    { name: 'Left E♭ key', keys: [...HALF, 'left-e-flat'], sources: BOTH }
  ],
  76: one(['octave-1', ...LH, 'f-sharp', 'e']), // E5
  77: [                                         // F5
    { name: 'Right F key', keys: ['octave-1', ...LH, 'f-sharp', 'e', 'right-f'], sources: BOTH },
    { name: 'Left F key', keys: ['octave-1', ...LH, 'f-sharp', 'e', 'left-f'], sources: ['IDRS'] },
    { name: 'Forked F', keys: ['octave-1', ...LH, 'f-sharp', 'd'], sources: BOTH }
  ],
  78: one(['octave-1', ...LH, 'f-sharp']),      // F#5
  79: one(['octave-1', ...LH]),                 // G5
  80: [                                         // G#5
    { name: 'Left G♯ key', keys: ['octave-1', ...LH, 'left-g-sharp'], sources: BOTH },
    { name: 'Right G♯ key', keys: ['octave-1', ...LH, 'right-g-sharp'], sources: ['IDRS'] }
  ],
  // A5–C6 on the side octave key alone. Yamaha also marks the thumb key as
  // held, which a semi-automatic mechanism makes equivalent; IDRS's cleaner
  // instruction is the one shown.
  81: one(['octave-2', 'b', 'a'], ['IDRS']),              // A5
  82: one(['octave-2', 'b', 'a', 'f-sharp'], ['IDRS']),   // Bb5
  83: one(['octave-2', 'b'], ['IDRS']),                   // B5
  84: one(['octave-2', 'b', 'f-sharp'], ['IDRS']),        // C6
  85: one(['a', 'g', 'f-sharp', 'right-c']),              // C#6 — LH1 off, no octave key
  86: [                                                    // D6
    { name: 'Half-hole + RH2', keys: ['b-half', 'a', 'g', 'e', 'right-c'], sources: ['IDRS'] },
    { name: 'Half-hole', keys: ['b-half', 'a', 'g', 'right-c'], sources: ['IDRS'] },
    { name: 'LH1 off', keys: ['a', 'g', 'right-c'], sources: ['Yamaha'] }
  ],
  87: [                                                    // Eb6
    { name: 'Low B key', keys: ['b-half', 'a', 'g', 'e', 'd', 'low-b'], sources: BOTH },
    { name: 'G♯ + C keys', keys: ['b-half', 'a', 'g', 'left-g-sharp', 'right-c'], sources: ['Yamaha'] }
  ],
  // E6 and F6 come in three pinky combinations; F6 is each E6 with LH3 lifted.
  88: [                                                    // E6
    { name: 'Left G♯ + right E♭', keys: ['octave-1', ...HALF.filter((k) => k !== 'f-sharp'), 'left-g-sharp', 'right-eb'], sources: BOTH },
    { name: 'Left G♯ + left E♭', keys: ['octave-1', ...HALF.filter((k) => k !== 'f-sharp'), 'left-g-sharp', 'left-e-flat'], sources: ['IDRS'] },
    { name: 'Right G♯ + right E♭', keys: ['octave-1', ...HALF.filter((k) => k !== 'f-sharp'), 'right-g-sharp', 'right-eb'], sources: ['IDRS'] }
  ],
  89: [                                                    // F6
    { name: 'Left G♯ + right E♭', keys: ['octave-1', 'b-half', 'a', 'e', 'd', 'left-g-sharp', 'right-eb'], sources: BOTH },
    { name: 'Left G♯ + left E♭', keys: ['octave-1', 'b-half', 'a', 'e', 'd', 'left-g-sharp', 'left-e-flat'], sources: ['IDRS'] },
    { name: 'Right G♯ + right E♭', keys: ['octave-1', 'b-half', 'a', 'e', 'd', 'right-g-sharp', 'right-eb'], sources: ['IDRS'] }
  ],
  90: one(['octave-1', 'b', 'a', 'e', 'd', 'right-c'], ['Yamaha']),          // F#6
  91: one(['octave-3', 'b', 'g', 'f-sharp', 'left-g-sharp'], ['IDRS']),      // G6
  92: one(['octave-3', 'b', 'g', 'e', 'd', 'low-b'], ['IDRS']),              // G#6
  93: one(['octave-1', 'b', 'g', 'e'], ['IDRS'])                             // A6
};

export const FINGERING_MIN_MIDI = 58; // Bb3
export const FINGERING_MAX_MIDI = 93; // A6

export function hasFingering(midi: number): boolean {
  return midi >= FINGERING_MIN_MIDI && midi <= FINGERING_MAX_MIDI;
}

/** Every fingering for a note, default first. Empty outside the charted range. */
export function fingeringsFor(midi: number): Fingering[] {
  return hasFingering(midi) ? FINGERING_OPTIONS[midi] : [];
}

/** The default fingering's chart key ids, for callers that only want one. */
export const FINGERINGS: Record<number, string[]> = Object.fromEntries(
  Object.entries(FINGERING_OPTIONS).map(([midi, options]) => [midi, options[0].keys])
);

/** Default chart key ids for a note, or `null` if it's outside the charted range. */
export function fingeringFor(midi: number): string[] | null {
  return hasFingering(midi) ? FINGERINGS[midi] : null;
}

/** Human-readable key names, for the caption under the chart. */
export function keyLabels(keys: string[]): string[] {
  return keys.map((id) => KEY_LABELS[id] ?? id);
}

export function fingeringLabels(midi: number): string[] {
  return keyLabels(fingeringFor(midi) ?? []);
}

/** Steps through `count` options with wraparound, so the arrows never dead-end. */
export function cycleIndex(index: number, count: number, step: number): number {
  if (count <= 0) return 0;
  return (((index + step) % count) + count) % count;
}

/**
 * Which fingering to show: a choice made on the spot for this note wins, then
 * a pinned one, then the default. Anything out of range for this note is
 * skipped rather than trusted, so a stale pin can never index past the end.
 */
export function chooseFingering(count: number, pinned?: number | null, peek?: number | null): number {
  for (const c of [peek, pinned]) {
    if (c !== undefined && c !== null && Number.isInteger(c) && c >= 0 && c < count) return c;
  }
  return 0;
}
