// Scale construction with *correct spelling* — a scale isn't just a set of
// pitch classes, it's one letter per degree. E♭ major is E♭ F G A♭ B♭ C D, not
// D♯ F G G♯ A♯ C D: same keys on the instrument, but only the first one
// renders as readable notation. So a pitch here is a (letter, alter, octave)
// triple rather than a bare MIDI number, and the accidental for each degree is
// derived from the gap between the letter's natural pitch and the pitch the
// scale's interval pattern actually asks for.

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

// Semitones above C for each natural letter.
const LETTER_SEMITONES = [0, 2, 4, 5, 7, 9, 11];

export type Pitch = {
  letter: number; // 0 = C .. 6 = B
  alter: number;  // -2 = double flat .. +2 = double sharp
  octave: number; // scientific pitch notation: middle C is C4
};

export function toMidi(p: Pitch): number {
  return 12 * (p.octave + 1) + LETTER_SEMITONES[p.letter] + p.alter;
}

// Position on the staff ignores accidentals entirely — C♯4 and C♭4 sit on the
// same line as C4 — so notation geometry counts diatonic steps, not semitones.
export function toDiatonic(p: Pitch): number {
  return p.octave * 7 + p.letter;
}

export function alterSymbol(alter: number): string {
  if (alter === 0) return '';
  if (alter === -1) return '♭';
  if (alter === 1) return '♯';
  if (alter === -2) return '♭♭';
  if (alter === 2) return '♯♯';
  return alter > 0 ? '♯'.repeat(alter) : '♭'.repeat(-alter);
}

export function pitchName(p: Pitch): string {
  return `${LETTERS[p.letter]}${alterSymbol(p.alter)}${p.octave}`;
}

export function pitchNameNoOctave(p: Pitch): string {
  return `${LETTERS[p.letter]}${alterSymbol(p.alter)}`;
}

export type ScaleTypeId = 'major' | 'natural-minor' | 'harmonic-minor' | 'melodic-minor' | 'chromatic';

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const NATURAL_MINOR = [0, 2, 3, 5, 7, 8, 10];
const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11];
const MELODIC_MINOR_UP = [0, 2, 3, 5, 7, 9, 11];
const CHROMATIC = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export type ScaleType = {
  id: ScaleTypeId;
  label: string;
  up: number[];
  // Melodic minor is the one scale whose descent is spelled differently from
  // its ascent — it comes back down as natural minor.
  down: number[];
  /** Twelve notes an octave, so it can't take one letter per degree. */
  chromatic?: true;
};

export const SCALE_TYPES: ScaleType[] = [
  { id: 'major', label: 'Major', up: MAJOR, down: MAJOR },
  { id: 'natural-minor', label: 'Natural minor', up: NATURAL_MINOR, down: NATURAL_MINOR },
  { id: 'harmonic-minor', label: 'Harmonic minor', up: HARMONIC_MINOR, down: HARMONIC_MINOR },
  { id: 'melodic-minor', label: 'Melodic minor', up: MELODIC_MINOR_UP, down: NATURAL_MINOR },
  { id: 'chromatic', label: 'Chromatic', up: CHROMATIC, down: CHROMATIC, chromatic: true }
];

// The scales that *have* a key, and so belong under a key signature. Chromatic
// is deliberately absent: it has no tonic and no key signature, so it's offered
// as a choice of key rather than a choice of mode.
export const KEYED_SCALE_TYPES: ScaleType[] = SCALE_TYPES.filter((s) => !s.chromatic);

export function scaleType(id: ScaleTypeId): ScaleType {
  const found = SCALE_TYPES.find((s) => s.id === id);
  if (!found) throw new Error(`unknown scale type: ${id}`);
  return found;
}

export function isMinor(id: ScaleTypeId): boolean {
  return id === 'natural-minor' || id === 'harmonic-minor' || id === 'melodic-minor';
}

export type TonicSpelling = { letter: number; alter: number };

// One spelling per pitch class, chosen so the resulting key signature is the
// one players actually read: D♭ major (5 flats) rather than C♯ major (7
// sharps), but C♯ minor (4 sharps) rather than D♭ minor (8 flats).
export const MAJOR_TONICS: TonicSpelling[] = [
  { letter: 0, alter: 0 },  // C
  { letter: 1, alter: -1 }, // Db
  { letter: 1, alter: 0 },  // D
  { letter: 2, alter: -1 }, // Eb
  { letter: 2, alter: 0 },  // E
  { letter: 3, alter: 0 },  // F
  { letter: 3, alter: 1 },  // F#
  { letter: 4, alter: 0 },  // G
  { letter: 5, alter: -1 }, // Ab
  { letter: 5, alter: 0 },  // A
  { letter: 6, alter: -1 }, // Bb
  { letter: 6, alter: 0 }   // B
];

export const MINOR_TONICS: TonicSpelling[] = [
  { letter: 0, alter: 0 },  // C
  { letter: 0, alter: 1 },  // C#
  { letter: 1, alter: 0 },  // D
  { letter: 2, alter: -1 }, // Eb
  { letter: 2, alter: 0 },  // E
  { letter: 3, alter: 0 },  // F
  { letter: 3, alter: 1 },  // F#
  { letter: 4, alter: 0 },  // G
  { letter: 4, alter: 1 },  // G#
  { letter: 5, alter: 0 },  // A
  { letter: 6, alter: -1 }, // Bb
  { letter: 6, alter: 0 }   // B
];

// Minor keys read better from the sharp-leaning table, because that's how
// they're written.
export function tonicsFor(id: ScaleTypeId): TonicSpelling[] {
  return id === 'major' ? MAJOR_TONICS : MINOR_TONICS;
}

export function tonicPitchClass(t: TonicSpelling): number {
  return (((LETTER_SEMITONES[t.letter] + t.alter) % 12) + 12) % 12;
}

export function tonicLabel(t: TonicSpelling): string {
  return `${LETTERS[t.letter]}${alterSymbol(t.alter)}`;
}

// A chromatic scale has no letter-per-degree rule to follow, so it uses the
// convention players actually read: sharps on the way up, flats on the way
// down. Both tables are indexed by pitch class and never cross an octave
// boundary (no B♯ or C♭), so the octave comes straight from the MIDI number.
const SHARP_SPELLING: TonicSpelling[] = [
  { letter: 0, alter: 0 }, { letter: 0, alter: 1 },  // C  C#
  { letter: 1, alter: 0 }, { letter: 1, alter: 1 },  // D  D#
  { letter: 2, alter: 0 },                           // E
  { letter: 3, alter: 0 }, { letter: 3, alter: 1 },  // F  F#
  { letter: 4, alter: 0 }, { letter: 4, alter: 1 },  // G  G#
  { letter: 5, alter: 0 }, { letter: 5, alter: 1 },  // A  A#
  { letter: 6, alter: 0 }                            // B
];

const FLAT_SPELLING: TonicSpelling[] = [
  { letter: 0, alter: 0 },                            // C
  { letter: 1, alter: -1 }, { letter: 1, alter: 0 },  // Db D
  { letter: 2, alter: -1 }, { letter: 2, alter: 0 },  // Eb E
  { letter: 3, alter: 0 },                            // F
  { letter: 4, alter: -1 }, { letter: 4, alter: 0 },  // Gb G
  { letter: 5, alter: -1 }, { letter: 5, alter: 0 },  // Ab A
  { letter: 6, alter: -1 }, { letter: 6, alter: 0 }   // Bb B
];

export function spellChromatic(midi: number, descending: boolean): Pitch {
  const pc = ((midi % 12) + 12) % 12;
  const { letter, alter } = (descending ? FLAT_SPELLING : SHARP_SPELLING)[pc];
  return { letter, alter, octave: Math.floor(midi / 12) - 1 };
}

// Position of each natural letter on the circle of fifths, counted from C:
// F is one flat, G one sharp, and so on round to B at five sharps.
const LETTER_FIFTHS = [0, 2, 4, -1, 1, 3, 5];

/**
 * Key signature for a keyed scale, as a count of sharps (positive) or flats
 * (negative). Every minor form takes the natural minor's signature — the
 * raised notes of harmonic and melodic minor are written as accidentals — and
 * a minor key sits three steps flatwards of the major on the same tonic.
 * Chromatic has no key, so no signature.
 */
export function keySignature(tonic: TonicSpelling, typeId: ScaleTypeId): number {
  if (typeId === 'chromatic') return 0;
  const major = LETTER_FIFTHS[tonic.letter] + 7 * tonic.alter;
  return typeId === 'major' ? major : major - 3;
}

// Spells one run of `intervals` (semitones above the tonic) starting from
// `tonic`. Degree i always takes the i-th letter above the tonic's letter, so
// the accidental falls out of the difference between that letter's natural
// pitch and the pitch the interval asks for.
function spell(tonic: Pitch, intervals: number[]): Pitch[] {
  const tonicMidi = toMidi(tonic);
  return intervals.map((semitones, i) => {
    const letterIndex = tonic.letter + i;
    const letter = ((letterIndex % 7) + 7) % 7;
    const octave = tonic.octave + Math.floor(letterIndex / 7);
    const naturalMidi = 12 * (octave + 1) + LETTER_SEMITONES[letter];
    return { letter, alter: tonicMidi + semitones - naturalMidi, octave };
  });
}

// Stacks the seven-note pattern `octaves` times and caps it with the tonic an
// octave (or two) up, so a two-octave scale is 15 notes, not 14.
function runIntervals(pattern: number[], octaves: number): number[] {
  const out: number[] = [];
  for (let o = 0; o < octaves; o++) out.push(...pattern.map((s) => s + 12 * o));
  out.push(12 * octaves);
  return out;
}

export type ScaleRun = {
  /** The full practice sequence: up, then back down, with the top note played once. */
  notes: Pitch[];
  /** Index of the highest note — where the run turns around. */
  turnaround: number;
};

export function buildScale(tonic: Pitch, typeId: ScaleTypeId, octaves: number): ScaleRun {
  const type = scaleType(typeId);
  const root = toMidi(tonic);
  const render = (intervals: number[], descending: boolean) =>
    type.chromatic
      ? intervals.map((s) => spellChromatic(root + s, descending))
      : spell(tonic, intervals);

  const up = render(runIntervals(type.up, octaves), false);
  const down = render(runIntervals(type.down, octaves), true).reverse();
  return { notes: [...up, ...down.slice(1)], turnaround: up.length - 1 };
}

/**
 * A chromatic run over an arbitrary span rather than whole octaves — used for
 * the full-range exercise, which runs every note the instrument has.
 */
export function buildChromaticRange(lowMidi: number, highMidi: number): ScaleRun {
  const up: Pitch[] = [];
  for (let m = lowMidi; m <= highMidi; m++) up.push(spellChromatic(m, false));
  const down: Pitch[] = [];
  for (let m = highMidi - 1; m >= lowMidi; m--) down.push(spellChromatic(m, true));
  return { notes: [...up, ...down], turnaround: up.length - 1 };
}

// --- Fitting a scale into the instrument's range -------------------------

/**
 * Lowest octave number at which this tonic sits at or above `minMidi`, so a
 * scale always starts from the lowest playable instance of its tonic and gets
 * the most room to climb.
 */
export function lowestTonic(t: TonicSpelling, minMidi: number): Pitch {
  let octave = Math.floor(minMidi / 12) - 1;
  while (toMidi({ ...t, octave }) < minMidi) octave++;
  return { ...t, octave };
}

/** How many whole octaves of this scale fit between `minMidi` and `maxMidi`. */
export function maxOctaves(t: TonicSpelling, minMidi: number, maxMidi: number, cap = 2): number {
  const start = toMidi(lowestTonic(t, minMidi));
  let n = 0;
  while (n < cap && start + 12 * (n + 1) <= maxMidi) n++;
  return Math.max(1, n);
}
