import { describe, it, expect } from 'vitest';
import {
  buildScale, lowestTonic, maxOctaves, pitchName, pitchNameNoOctave, toDiatonic, toMidi,
  MAJOR_TONICS, MINOR_TONICS, tonicPitchClass, tonicLabel, isMinor, tonicsFor, spellChromatic,
  SCALE_TYPES, KEYED_SCALE_TYPES, buildChromaticRange, keySignature,
  type Pitch
} from '$lib/music/scales';
import { FINGERING_MIN_MIDI, FINGERING_MAX_MIDI, hasFingering } from '$lib/music/fingerings';

const C4: Pitch = { letter: 0, alter: 0, octave: 4 };
const Eb4: Pitch = { letter: 2, alter: -1, octave: 4 };
const names = (ps: Pitch[]) => ps.map(pitchNameNoOctave);

describe('toMidi', () => {
  it('puts middle C at 60', () => {
    expect(toMidi(C4)).toBe(60);
  });

  it('accounts for accidentals', () => {
    expect(toMidi(Eb4)).toBe(63);
    expect(toMidi({ letter: 1, alter: 1, octave: 4 })).toBe(63); // D#4 is the same pitch
  });

  it('handles double accidentals', () => {
    expect(toMidi({ letter: 3, alter: 2, octave: 4 })).toBe(67); // F##4 == G4
  });
});

describe('toDiatonic', () => {
  it('ignores accidentals — staff position is by letter', () => {
    expect(toDiatonic(Eb4)).toBe(toDiatonic({ letter: 2, alter: 0, octave: 4 }));
  });

  it('advances one per letter and seven per octave', () => {
    expect(toDiatonic({ letter: 0, alter: 0, octave: 5 }) - toDiatonic(C4)).toBe(7);
  });
});

describe('buildScale spelling', () => {
  it('spells C major with no accidentals', () => {
    const up = buildScale(C4, 'major', 1).notes.slice(0, 8);
    expect(names(up)).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C']);
  });

  it('spells E flat major with flats, not sharps', () => {
    const up = buildScale(Eb4, 'major', 1).notes.slice(0, 8);
    expect(names(up)).toEqual(['E♭', 'F', 'G', 'A♭', 'B♭', 'C', 'D', 'E♭']);
  });

  it('uses one letter per degree even when that needs a double sharp', () => {
    const gSharp: Pitch = { letter: 4, alter: 1, octave: 4 };
    const up = buildScale(gSharp, 'harmonic-minor', 1).notes.slice(0, 8);
    expect(names(up)).toEqual([
      'G♯', 'A♯', 'B', 'C♯', 'D♯', 'E', 'F♯♯', 'G♯'
    ]);
  });

  it('raises the seventh in harmonic minor', () => {
    const up = buildScale({ letter: 5, alter: 0, octave: 4 }, 'harmonic-minor', 1).notes.slice(0, 8);
    expect(names(up)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G♯', 'A']);
  });
});

describe('buildScale shape', () => {
  it('returns 15 notes for a one-octave run up and back down', () => {
    const run = buildScale(C4, 'major', 1);
    expect(run.notes).toHaveLength(15);
    expect(run.turnaround).toBe(7);
  });

  it('returns 29 notes for two octaves', () => {
    const run = buildScale(C4, 'major', 2);
    expect(run.notes).toHaveLength(29);
    expect(run.turnaround).toBe(14);
  });

  it('plays the top note exactly once', () => {
    const run = buildScale(C4, 'major', 1);
    const top = toMidi(run.notes[run.turnaround]);
    expect(run.notes.filter((p) => toMidi(p) === top)).toHaveLength(1);
    expect(top).toBe(72);
  });

  it('starts and ends on the tonic', () => {
    const run = buildScale(Eb4, 'natural-minor', 1);
    expect(pitchName(run.notes[0])).toBe('E♭4');
    expect(pitchName(run.notes[run.notes.length - 1])).toBe('E♭4');
  });

  it('ascends strictly to the turnaround and descends strictly after it', () => {
    const run = buildScale(C4, 'melodic-minor', 2);
    for (let i = 1; i <= run.turnaround; i++) {
      expect(toMidi(run.notes[i])).toBeGreaterThan(toMidi(run.notes[i - 1]));
    }
    for (let i = run.turnaround + 1; i < run.notes.length; i++) {
      expect(toMidi(run.notes[i])).toBeLessThan(toMidi(run.notes[i - 1]));
    }
  });
});

describe('melodic minor', () => {
  it('raises 6 and 7 going up but comes back down as natural minor', () => {
    const run = buildScale(C4, 'melodic-minor', 1);
    expect(names(run.notes.slice(0, 8))).toEqual(['C', 'D', 'E♭', 'F', 'G', 'A', 'B', 'C']);
    expect(names(run.notes.slice(8))).toEqual(['B♭', 'A♭', 'G', 'F', 'E♭', 'D', 'C']);
  });
});

describe('chromatic', () => {
  it('runs all twelve semitones per octave', () => {
    const run = buildScale(C4, 'chromatic', 1);
    expect(run.turnaround).toBe(12);
    expect(run.notes).toHaveLength(25);
    for (let i = 1; i <= run.turnaround; i++) {
      expect(toMidi(run.notes[i]) - toMidi(run.notes[i - 1])).toBe(1);
    }
  });

  it('spells the ascent with sharps and the descent with flats', () => {
    const run = buildScale(C4, 'chromatic', 1);
    expect(names(run.notes.slice(0, 13))).toEqual([
      'C', 'C\u266F', 'D', 'D\u266F', 'E', 'F', 'F\u266F', 'G', 'G\u266F', 'A', 'A\u266F', 'B', 'C'
    ]);
    expect(names(run.notes.slice(13))).toEqual([
      'B', 'B\u266D', 'A', 'A\u266D', 'G', 'G\u266D', 'F', 'E', 'E\u266D', 'D', 'D\u266D', 'C'
    ]);
  });

  it('never spells a chromatic note across an octave boundary', () => {
    // No B# or Cb, so the octave can come straight from the MIDI number.
    for (let midi = 58; midi <= 84; midi++) {
      for (const descending of [false, true]) {
        const p = spellChromatic(midi, descending);
        expect(toMidi(p), `MIDI ${midi} round trip`).toBe(midi);
      }
    }
  });

  it('starts from whichever key is selected', () => {
    const run = buildScale({ letter: 2, alter: -1, octave: 4 }, 'chromatic', 1);
    expect(toMidi(run.notes[0])).toBe(63);
    expect(names(run.notes.slice(0, 4))).toEqual(['D\u266F', 'E', 'F', 'F\u266F']);
  });

  it('is not treated as a minor key when picking tonic spellings', () => {
    expect(isMinor('chromatic')).toBe(false);
    expect(isMinor('harmonic-minor')).toBe(true);
    expect(tonicsFor('chromatic')).toBe(MINOR_TONICS);   // sharp-leaning, matching the ascent
    expect(tonicsFor('major')).toBe(MAJOR_TONICS);
  });
});

describe('full-range chromatic', () => {
  const run = buildChromaticRange(FINGERING_MIN_MIDI, FINGERING_MAX_MIDI);

  it('runs every charted note from the lowest to the highest and back', () => {
    const span = FINGERING_MAX_MIDI - FINGERING_MIN_MIDI;
    expect(run.turnaround).toBe(span);
    expect(run.notes).toHaveLength(2 * span + 1);
    expect(toMidi(run.notes[0])).toBe(FINGERING_MIN_MIDI);
    expect(toMidi(run.notes[run.turnaround])).toBe(FINGERING_MAX_MIDI);
    expect(toMidi(run.notes[run.notes.length - 1])).toBe(FINGERING_MIN_MIDI);
  });

  it('moves one semitone at a time and plays the top note once', () => {
    for (let i = 1; i < run.notes.length; i++) {
      const step = toMidi(run.notes[i]) - toMidi(run.notes[i - 1]);
      expect(Math.abs(step), `step ${i}`).toBe(1);
      expect(step, `step ${i}`).toBe(i <= run.turnaround ? 1 : -1);
    }
  });

  it('has a fingering for every note in it', () => {
    for (const p of run.notes) expect(hasFingering(toMidi(p)), pitchName(p)).toBe(true);
  });

  it('spells sharps going up and flats coming down, like the octave chromatic', () => {
    const up = run.notes.slice(0, run.turnaround + 1);
    const down = run.notes.slice(run.turnaround + 1);
    expect(up.every((p) => p.alter >= 0)).toBe(true);
    expect(down.every((p) => p.alter <= 0)).toBe(true);
  });
});

describe('range fitting', () => {
  it('starts each key from its lowest playable tonic', () => {
    expect(toMidi(lowestTonic({ letter: 6, alter: -1 }, 58))).toBe(58); // Bb3
    expect(toMidi(lowestTonic({ letter: 0, alter: 0 }, 58))).toBe(60);  // C4
    expect(toMidi(lowestTonic({ letter: 5, alter: 0 }, 58))).toBe(69);  // A4
  });

  it('allows two octaves only when they fit under the top of the range', () => {
    expect(maxOctaves({ letter: 0, alter: 0 }, 58, 84)).toBe(2);  // C4-C6
    expect(maxOctaves({ letter: 1, alter: 0 }, 58, 84)).toBe(1);  // D4-D6 is past C6
    expect(maxOctaves({ letter: 5, alter: 0 }, 58, 93)).toBe(2);  // A4-A6, right at the top
    expect(maxOctaves({ letter: 5, alter: 0 }, 58, 92)).toBe(1);  // one semitone short
  });

  it('gives every key two octaves across the charted range', () => {
    for (const tonic of [...MAJOR_TONICS, ...MINOR_TONICS]) {
      expect(maxOctaves(tonic, FINGERING_MIN_MIDI, FINGERING_MAX_MIDI), tonicLabel(tonic)).toBe(2);
    }
  });

  it('never proposes a scale that leaves the charted range', () => {
    for (const tonics of [MAJOR_TONICS, MINOR_TONICS]) {
      for (const tonic of tonics) {
        const octaves = maxOctaves(tonic, FINGERING_MIN_MIDI, FINGERING_MAX_MIDI);
        for (const type of ['major', 'harmonic-minor', 'melodic-minor', 'chromatic'] as const) {
          const run = buildScale(lowestTonic(tonic, FINGERING_MIN_MIDI), type, octaves);
          for (const p of run.notes) {
            expect(hasFingering(toMidi(p)), `${pitchName(p)} in ${type}`).toBe(true);
          }
        }
      }
    }
  });
});

describe('scale type table', () => {
  it('offers major, three minors and chromatic', () => {
    expect(SCALE_TYPES.map((t) => t.id)).toEqual([
      'major', 'natural-minor', 'harmonic-minor', 'melodic-minor', 'chromatic'
    ]);
  });

  it('leaves chromatic out of the keyed scales, since it has no key', () => {
    expect(KEYED_SCALE_TYPES.map((t) => t.id)).toEqual([
      'major', 'natural-minor', 'harmonic-minor', 'melodic-minor'
    ]);
    expect(KEYED_SCALE_TYPES.some((t) => t.chromatic)).toBe(false);
  });

  it('keeps every keyed pattern seven notes long', () => {
    for (const t of KEYED_SCALE_TYPES) {
      expect(t.up, t.id).toHaveLength(7);
      expect(t.down, t.id).toHaveLength(7);
    }
  });
});

describe('tonic tables', () => {
  it('indexes both tables by pitch class, so switching mode keeps the key', () => {
    expect(MAJOR_TONICS).toHaveLength(12);
    expect(MINOR_TONICS).toHaveLength(12);
    MAJOR_TONICS.forEach((t, pc) => expect(tonicPitchClass(t)).toBe(pc));
    MINOR_TONICS.forEach((t, pc) => expect(tonicPitchClass(t)).toBe(pc));
  });
});

describe('keySignature', () => {
  const t = (letter: number, alter = 0) => ({ letter, alter });

  it('counts sharps up and flats down the circle of fifths for major keys', () => {
    expect(keySignature(t(0), 'major')).toBe(0);      // C
    expect(keySignature(t(4), 'major')).toBe(1);      // G
    expect(keySignature(t(3), 'major')).toBe(-1);     // F
    expect(keySignature(t(3, 1), 'major')).toBe(6);   // F#
    expect(keySignature(t(1, -1), 'major')).toBe(-5); // Db
  });

  it('puts each minor key three steps flatwards of its tonic major', () => {
    expect(keySignature(t(5), 'natural-minor')).toBe(0);    // A minor
    expect(keySignature(t(0, 1), 'natural-minor')).toBe(4); // C# minor
    expect(keySignature(t(2, -1), 'natural-minor')).toBe(-6); // Eb minor
    expect(keySignature(t(4, 1), 'natural-minor')).toBe(5); // G# minor
  });

  it('gives harmonic and melodic minor the natural minor signature', () => {
    for (const tonic of MINOR_TONICS) {
      const natural = keySignature(tonic, 'natural-minor');
      expect(keySignature(tonic, 'harmonic-minor')).toBe(natural);
      expect(keySignature(tonic, 'melodic-minor')).toBe(natural);
    }
  });

  it('gives chromatic no signature', () => {
    for (const tonic of MAJOR_TONICS) expect(keySignature(tonic, 'chromatic')).toBe(0);
  });

  it('never needs more than seven accidentals for any key offered', () => {
    for (const tonic of MAJOR_TONICS) expect(Math.abs(keySignature(tonic, 'major'))).toBeLessThanOrEqual(7);
    for (const tonic of MINOR_TONICS) expect(Math.abs(keySignature(tonic, 'natural-minor'))).toBeLessThanOrEqual(7);
  });

  it("agrees with the scale's own spelling in every key", () => {
    // The letters the signature alters must be exactly the letters the major /
    // natural minor scale spells with an accidental, in the same direction.
    const SHARPS = [3, 0, 4, 1, 5, 2, 6], FLATS = [6, 2, 5, 1, 4, 0, 3];
    for (const [tonics, type] of [[MAJOR_TONICS, 'major'], [MINOR_TONICS, 'natural-minor']] as const) {
      for (const tonic of tonics) {
        const fifths = keySignature(tonic, type);
        const expected = new Map<number, number>(
          (fifths > 0 ? SHARPS : FLATS).slice(0, Math.abs(fifths)).map((l) => [l, Math.sign(fifths)])
        );
        const run = buildScale({ ...tonic, octave: 4 }, type, 1).notes.slice(0, 7);
        for (const p of run) {
          expect(p.alter, `${tonicLabel(tonic)} ${type}: ${pitchName(p)}`).toBe(expected.get(p.letter) ?? 0);
        }
      }
    }
  });
});
