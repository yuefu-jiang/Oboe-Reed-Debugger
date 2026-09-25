import { describe, it, expect } from 'vitest';
import {
  LINE_GAP, STAFF_TOP, STAFF_BOTTOM, CLEF_WIDTH, SIDE_PADDING,
  MIN_NOTE_SPACING, MAX_NOTE_SPACING,
  yForPitch, ledgerLines, stemUp, notesPerSystem, intoSystems, noteSpacingFor, noteX, systemWidth,
  G_LINE_Y, CLEF_SCALE, SYSTEM_HEIGHT, clefTransform, keySignaturePitches, headerWidth, KEYSIG_STEP, glyphTransform, ACCIDENTAL_GAP
} from '$lib/music/notation';
import { accidentalGlyph } from '$lib/music/accidentalGlyphs';
import { CLEF_GLYPH_G_Y, CLEF_GLYPH_HEIGHT, CLEF_GLYPH_WIDTH, CLEF_PATH } from '$lib/music/clefPath';
import type { Pitch } from '$lib/music/scales';

const p = (letter: number, octave: number, alter = 0): Pitch => ({ letter, alter, octave });
const E4 = p(2, 4), F5 = p(3, 5), C4 = p(0, 4), C6 = p(0, 6), A5 = p(5, 5), B3 = p(6, 3);

describe('yForPitch', () => {
  it('puts E4 on the bottom line and F5 on the top line', () => {
    expect(yForPitch(E4)).toBe(STAFF_BOTTOM);
    expect(yForPitch(F5)).toBe(STAFF_TOP);
  });

  it('moves up the page as pitch rises', () => {
    expect(yForPitch(p(4, 4))).toBeLessThan(yForPitch(E4));
  });

  it('ignores accidentals', () => {
    expect(yForPitch(p(2, 4, -1))).toBe(yForPitch(E4));
  });

  it('spaces a whole octave across seven diatonic steps', () => {
    expect(yForPitch(C4) - yForPitch(p(0, 5))).toBe(7 * (LINE_GAP / 2));
  });
});

describe('ledgerLines', () => {
  it('gives notes inside the staff no ledger lines', () => {
    expect(ledgerLines(yForPitch(E4))).toEqual([]);
    expect(ledgerLines(yForPitch(p(0, 5)))).toEqual([]);
  });

  it('gives middle C a single ledger line below', () => {
    expect(ledgerLines(yForPitch(C4))).toEqual([STAFF_BOTTOM + LINE_GAP]);
  });

  it('keeps a note hanging below its ledger line on one line', () => {
    expect(ledgerLines(yForPitch(B3))).toEqual([STAFF_BOTTOM + LINE_GAP]);
  });

  it('gives A5 one ledger line above and C6 two', () => {
    expect(ledgerLines(yForPitch(A5))).toEqual([STAFF_TOP - LINE_GAP]);
    expect(ledgerLines(yForPitch(C6))).toEqual([STAFF_TOP - LINE_GAP, STAFF_TOP - 2 * LINE_GAP]);
  });

  it('gives A6, the top of the range, four ledger lines and keeps it on the canvas', () => {
    const y = yForPitch(p(5, 6));
    expect(ledgerLines(y)).toEqual([1, 2, 3, 4].map((n) => STAFF_TOP - n * LINE_GAP));
    expect(y - 13).toBeGreaterThanOrEqual(0); // highlight halo radius
  });

  it('gives a note in the space above a ledger line that line only', () => {
    expect(ledgerLines(yForPitch(p(6, 5)))).toEqual([STAFF_TOP - LINE_GAP]); // B5
  });
});

describe('stemUp', () => {
  it('points stems up below the middle line and down above it', () => {
    expect(stemUp(yForPitch(E4))).toBe(true);
    expect(stemUp(yForPitch(F5))).toBe(false);
  });
});

describe('notesPerSystem', () => {
  it('puts everything on one line before the container has been measured', () => {
    expect(notesPerSystem(0, 29)).toBe(29);
  });

  it('never splits more finely than four notes per line', () => {
    expect(notesPerSystem(60, 29)).toBe(4);
  });

  it('fits as many notes as the width allows at the minimum spacing', () => {
    const width = SIDE_PADDING * 2 + CLEF_WIDTH + MIN_NOTE_SPACING * 10;
    expect(notesPerSystem(width, 29)).toBe(10);
  });

  it('never returns more notes than there are', () => {
    expect(notesPerSystem(5000, 15)).toBe(15);
  });
});

describe('intoSystems', () => {
  it('chunks in order and keeps every item', () => {
    expect(intoSystems([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns a single system when everything fits', () => {
    expect(intoSystems([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
  });
});

describe('noteSpacingFor', () => {
  const usable = (w: number) => w - SIDE_PADDING * 2 - CLEF_WIDTH;

  it('spreads the notes across the whole measured width', () => {
    const width = SIDE_PADDING * 2 + CLEF_WIDTH + 40 * 12;
    expect(noteSpacingFor(width, 12)).toBe(40);
    // No dead strip left over: the last note's slot ends at the right padding.
    expect(noteX(11, 40) + 40 / 2).toBe(width - SIDE_PADDING);
  });

  it('never packs tighter than the minimum', () => {
    expect(noteSpacingFor(200, 29)).toBe(MIN_NOTE_SPACING);
  });

  it('caps the spread so a short final system does not sprawl', () => {
    expect(noteSpacingFor(2000, 2)).toBe(MAX_NOTE_SPACING);
  });

  it('falls back to the minimum before the container is measured', () => {
    expect(noteSpacingFor(0, 15)).toBe(MIN_NOTE_SPACING);
    expect(usable(0)).toBeLessThan(0); // sanity: the unmeasured case really is degenerate
  });
});

describe('systemWidth', () => {
  it('matches the container exactly once measured, so the svg renders 1:1', () => {
    expect(systemWidth(660, 15, 40)).toBe(660);
  });

  it('falls back to a natural width before the container is measured', () => {
    expect(systemWidth(0, 4, 32)).toBe(SIDE_PADDING * 2 + CLEF_WIDTH + 32 * 4);
  });
});

describe('treble clef', () => {
  const parse = (t: string) => {
    const [, x, y, k] = t.match(/translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)/)!.map(Number);
    return { x, y, k };
  };

  it('puts the G line one line-gap above the bottom line, where G4 sits', () => {
    expect(G_LINE_Y).toBe(STAFF_BOTTOM - LINE_GAP);
    expect(yForPitch(p(4, 4))).toBe(G_LINE_Y);
  });

  it('lands the spiral exactly on the G line', () => {
    const { y, k } = parse(clefTransform());
    expect(y + CLEF_GLYPH_G_Y * k).toBeCloseTo(G_LINE_Y, 6);
  });

  it('stands about seven staff spaces tall, straddling the staff', () => {
    const { y, k } = parse(clefTransform());
    expect(CLEF_GLYPH_HEIGHT * k / LINE_GAP).toBeCloseTo(7.3, 6);
    expect(y).toBeLessThan(STAFF_TOP);                          // curl rises above the top line
    expect(y + CLEF_GLYPH_HEIGHT * k).toBeGreaterThan(STAFF_BOTTOM); // tail hangs below the bottom line
  });

  it('fits on the canvas and inside the space reserved for it', () => {
    const { x, y, k } = parse(clefTransform());
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y + CLEF_GLYPH_HEIGHT * k).toBeLessThan(SYSTEM_HEIGHT);
    expect(x + CLEF_GLYPH_WIDTH * k).toBeLessThanOrEqual(SIDE_PADDING + CLEF_WIDTH);
  });

  it('carries a real outline', () => {
    expect(CLEF_PATH.startsWith('m')).toBe(true);
    expect(CLEF_PATH.match(/z/g)!.length).toBe(4);
    expect(CLEF_SCALE).toBeGreaterThan(0);
  });
});

describe('key signature layout', () => {
  const names = (fifths: number) =>
    keySignaturePitches(fifths).map((q) => 'CDEFGAB'[q.letter] + q.octave + (q.alter > 0 ? '#' : 'b'));

  it('is empty for no sharps or flats', () => {
    expect(keySignaturePitches(0)).toEqual([]);
    expect(headerWidth(0)).toBe(CLEF_WIDTH);
  });

  it('places sharps in the conventional F C G D A E B zig-zag', () => {
    expect(names(7)).toEqual(['F5#', 'C5#', 'G5#', 'D5#', 'A4#', 'E5#', 'B4#']);
  });

  it('places flats in the conventional B E A D G C F zig-zag', () => {
    expect(names(-7)).toEqual(['B4b', 'E5b', 'A4b', 'D5b', 'G4b', 'C5b', 'F4b']);
  });

  it('takes the first n in order', () => {
    expect(names(2)).toEqual(['F5#', 'C5#']);
    expect(names(-3)).toEqual(['B4b', 'E5b', 'A4b']);
  });

  it('keeps every accidental on the staff, needing no ledger lines', () => {
    for (const fifths of [7, -7]) {
      for (const q of keySignaturePitches(fifths)) expect(ledgerLines(yForPitch(q))).toEqual([]);
    }
  });

  it('widens the header by one step per accidental plus a gap, and moves the notes over', () => {
    expect(headerWidth(3) - headerWidth(2)).toBe(KEYSIG_STEP);
    expect(headerWidth(1)).toBeGreaterThan(CLEF_WIDTH + KEYSIG_STEP);
    expect(noteX(0, 40, headerWidth(4)) - noteX(0, 40)).toBe(headerWidth(4) - CLEF_WIDTH);
  });

  it('fits fewer notes on a line once a signature takes room', () => {
    const width = SIDE_PADDING * 2 + CLEF_WIDTH + MIN_NOTE_SPACING * 12;
    expect(notesPerSystem(width, 29, headerWidth(6))).toBeLessThan(notesPerSystem(width, 29));
  });
});

describe('accidental glyphs', () => {
  // Bounding box of a glyph path, in staff spaces. The paths use absolute
  // coordinates throughout, so every number pair is a point.
  const bbox = (d: string) => {
    const nums = d.match(/-?[\d.]+/g)!.map(Number);
    const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  };

  it('has a glyph for every alteration a scale can produce, and none for a natural', () => {
    for (const alter of [-2, -1, 1, 2]) expect(accidentalGlyph(alter), `${alter}`).not.toBeNull();
    expect(accidentalGlyph(0)).toBeNull();
  });

  it('draws a sharp about 2.7 spaces tall and one wide, straddling its line', () => {
    const b = bbox(accidentalGlyph(1)!.d);
    expect(b.y1 - b.y0).toBeGreaterThan(2.5);
    expect(b.y1 - b.y0).toBeLessThan(3.2);
    expect(Math.abs((b.y0 + b.y1) / 2)).toBeLessThan(0.2);
    expect(b.x1 - b.x0).toBeCloseTo(accidentalGlyph(1)!.width, 1);
  });

  it("stands a flat's stem well above its line, with little below", () => {
    const b = bbox(accidentalGlyph(-1)!.d);
    expect(-b.y0).toBeGreaterThan(1.6);
    expect(b.y1).toBeLessThan(0.6);
  });

  it('keeps every glyph within its declared width, starting at the origin', () => {
    for (const alter of [-2, -1, 1, 2]) {
      const g = accidentalGlyph(alter)!, b = bbox(g.d);
      expect(b.x0, `${alter}`).toBeGreaterThanOrEqual(-0.1);
      expect(b.x1, `${alter}`).toBeLessThanOrEqual(g.width + 0.05);
    }
  });

  it('spaces key-signature accidentals so neighbours never overlap', () => {
    for (const alter of [-1, 1]) expect(accidentalGlyph(alter)!.width * LINE_GAP).toBeLessThan(KEYSIG_STEP);
  });

  it('scales glyphs by the line gap, placed at the point given', () => {
    expect(glyphTransform(12, 40)).toBe(`translate(12 40) scale(${LINE_GAP})`);
  });

  it("clears the previous note's head even with the widest accidental", () => {
    const widest = Math.max(...[-2, -1, 1, 2].map((a) => accidentalGlyph(a)!.width)) * LINE_GAP;
    // left edge of the accidental vs right edge of the previous notehead (rx 6.2)
    expect(MIN_NOTE_SPACING - ACCIDENTAL_GAP - widest).toBeGreaterThan(6.2 - 1);
  });
});
