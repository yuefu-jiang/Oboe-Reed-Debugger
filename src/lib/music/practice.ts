// How a scale is laid over the metronome's clicks.
//
// The click engine only knows about beats and measure length, so this maps
// between "beat N since I pressed start" and "note N of the scale, beat M of
// that note" — which is all the practice view needs to drive the staff, the
// fingering chart and the beat dots.

export type NoteLength = { beats: number; label: string };

export const NOTE_LENGTHS: NoteLength[] = [
  { beats: 1, label: '1 beat' },
  { beats: 2, label: '2 beats' },
  { beats: 4, label: '4 beats (4/4)' },
  { beats: 8, label: '8 beats' }
];

/**
 * Measure length to hand the metronome, which is really a choice about where
 * the accent falls.
 *
 * Holding each note for several beats, the useful accent is the downbeat that
 * starts each note — you need to hear "one" to know when to change. At one
 * note per beat every click already starts a note, so accenting all of them
 * says nothing; the accent goes on the top of the run instead, marking the
 * tonic each time around.
 */
export function accentEvery(noteCount: number, beatsPerNote: number): number {
  return beatsPerNote > 1 ? beatsPerNote : Math.max(1, noteCount);
}

/** Length of one full pass through the scale, in beats. */
export function totalBeats(noteCount: number, beatsPerNote: number): number {
  return Math.max(1, noteCount * beatsPerNote);
}

/** Which note of the scale a given beat belongs to. */
export function noteIndexAt(beatsElapsed: number, beatsPerNote: number): number {
  return Math.floor(beatsElapsed / beatsPerNote);
}

/** How far into the held note a given beat is — 0 is the downbeat. */
export function beatWithinNote(beatsElapsed: number, beatsPerNote: number): number {
  return ((beatsElapsed % beatsPerNote) + beatsPerNote) % beatsPerNote;
}
