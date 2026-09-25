import { describe, it, expect } from 'vitest';
import { NOTE_LENGTHS, accentEvery, totalBeats, noteIndexAt, beatWithinNote } from '$lib/music/practice';
import { initialBeat, nextBeatIndex } from '$lib/audio/metronome';

// Walks the practice view's whole scheme: seed the beat counter from the note
// the reader picked, seed the metronome's measure counter to match, then step
// both the way the click callback does.
function play(noteCount: number, perNote: number, startNote: number, steps: number) {
  const total = totalBeats(noteCount, perNote);
  const accent = accentEvery(noteCount, perNote);
  let elapsed = (startNote * perNote) % total;
  let measureBeat = initialBeat(elapsed % accent, accent);

  const frames = [];
  for (let i = 0; i < steps; i++) {
    frames.push({
      note: noteIndexAt(elapsed, perNote),
      beat: beatWithinNote(elapsed, perNote),
      accented: measureBeat === 0
    });
    elapsed = (elapsed + 1) % total;
    measureBeat = nextBeatIndex(measureBeat, accent);
  }
  return frames;
}

describe('accentEvery', () => {
  it('accents every measure when notes are held for several beats', () => {
    expect(accentEvery(15, 4)).toBe(4);
    expect(accentEvery(15, 2)).toBe(2);
  });

  it('accents the top of the run when every click is a new note', () => {
    expect(accentEvery(15, 1)).toBe(15);
    expect(accentEvery(29, 1)).toBe(29);
  });

  it('never hands the metronome a zero-length measure', () => {
    expect(accentEvery(0, 1)).toBe(1);
  });
});

describe('totalBeats', () => {
  it('multiplies the scale length by the note length', () => {
    expect(totalBeats(15, 1)).toBe(15);
    expect(totalBeats(15, 4)).toBe(60);
  });

  it('stays positive for an empty scale, so the modulo is safe', () => {
    expect(totalBeats(0, 4)).toBe(1);
  });
});

describe('walking a scale beat by beat', () => {
  it('advances one note per beat at the shortest note length', () => {
    for (let beat = 0; beat < 15; beat++) {
      expect(noteIndexAt(beat, 1)).toBe(beat);
      expect(beatWithinNote(beat, 1)).toBe(0);
    }
  });

  it('holds each note for four beats in 4/4', () => {
    expect([0, 1, 2, 3].map((b) => noteIndexAt(b, 4))).toEqual([0, 0, 0, 0]);
    expect([0, 1, 2, 3].map((b) => beatWithinNote(b, 4))).toEqual([0, 1, 2, 3]);
    expect(noteIndexAt(4, 4)).toBe(1);
    expect(beatWithinNote(4, 4)).toBe(0);
  });

  it('lands the last beat of the run on the last note', () => {
    const notes = 15, per = 4;
    const last = totalBeats(notes, per) - 1;
    expect(noteIndexAt(last, per)).toBe(notes - 1);
    expect(beatWithinNote(last, per)).toBe(per - 1);
  });

  it('covers every note exactly beatsPerNote times across one pass', () => {
    const notes = 15, per = 4;
    const counts = new Array(notes).fill(0);
    for (let beat = 0; beat < totalBeats(notes, per); beat++) counts[noteIndexAt(beat, per)]++;
    expect(counts.every((c) => c === per)).toBe(true);
  });

  it('starts every note on a downbeat', () => {
    const per = 2;
    for (let beat = 0; beat < totalBeats(15, per); beat++) {
      const startsNote = beat === 0 || noteIndexAt(beat, per) !== noteIndexAt(beat - 1, per);
      expect(startsNote).toBe(beatWithinNote(beat, per) === 0);
    }
  });
});

describe('NOTE_LENGTHS', () => {
  it('offers one beat per note through eight beats per note', () => {
    expect(NOTE_LENGTHS.map((n) => n.beats)).toEqual([1, 2, 4, 8]);
  });

  it('walks every offered length cleanly, one downbeat per note', () => {
    for (const { beats: per } of NOTE_LENGTHS) {
      const notes = 15;
      const counts = new Array(notes).fill(0);
      let downbeats = 0;
      for (let beat = 0; beat < totalBeats(notes, per); beat++) {
        counts[noteIndexAt(beat, per)]++;
        if (beatWithinNote(beat, per) === 0) downbeats++;
      }
      expect(counts.every((c) => c === per), `${per} beats per note`).toBe(true);
      expect(downbeats, `${per} beats per note`).toBe(notes);
      expect(accentEvery(notes, per)).toBe(per > 1 ? per : notes);
    }
  });
});

describe('starting from a note picked off the staff', () => {
  it('lands on the note that was picked', () => {
    expect(play(15, 4, 6, 1)[0]).toEqual({ note: 6, beat: 0, accented: true });
    expect(play(15, 1, 9, 1)[0].note).toBe(9);
  });

  it('plays out exactly as if the run had started from the top', () => {
    for (const perNote of [1, 2, 4, 8]) {
      const fromTop = play(15, perNote, 0, 15 * perNote + 40); // long enough to slice a window from any start
      for (const startNote of [1, 7, 14]) {
        const skip = startNote * perNote;
        expect(play(15, perNote, startNote, 20), `${perNote} beats, from note ${startNote}`)
          .toEqual(fromTop.slice(skip, skip + 20));
      }
    }
  });

  it('keeps the accent on each note change when notes are held', () => {
    for (const frame of play(15, 4, 6, 40)) {
      expect(frame.accented).toBe(frame.beat === 0);
    }
  });

  it('keeps the accent on the tonic at one note per click', () => {
    // Starting from the middle must not drag the accent onto some other note.
    for (const frame of play(15, 1, 9, 40)) {
      expect(frame.accented).toBe(frame.note === 0);
    }
  });

  it('wraps back to the tonic after the last note', () => {
    const frames = play(15, 2, 14, 4);
    expect(frames.map((f) => f.note)).toEqual([14, 14, 0, 0]);
  });
});
