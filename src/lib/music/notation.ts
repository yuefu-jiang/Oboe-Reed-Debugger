// Geometry for the hand-rolled treble-staff renderer in ScaleStaff.svelte.
// Pure functions, in SVG user units, so the layout can be unit-tested without
// mounting a component.

import type { Pitch } from './scales';
import { toDiatonic } from './scales';
import { CLEF_GLYPH_G_Y, CLEF_GLYPH_HEIGHT } from './clefPath';

export const LINE_GAP = 10;                 // distance between staff lines
export const STEP = LINE_GAP / 2;           // one diatonic step = half a gap
// Headroom above the top line only has to clear the highest note the chart
// covers — A6, in the space above the fourth ledger line — plus its notehead
// and highlight halo, so 65 units is enough and anything more is dead vertical
// space on a page that has to fit a tall fingering chart beside it.
export const STAFF_TOP = 65;                // y of the top line (F5)
export const STAFF_BOTTOM = STAFF_TOP + 4 * LINE_GAP; // y of the bottom line (E4)
export const SYSTEM_HEIGHT = 155;
export const CLEF_WIDTH = 34;
export const SIDE_PADDING = 10;

// Systems are justified to the full container width, the way engraved music
// fills the page to its margins, rather than sitting at a fixed natural width
// and leaving a ragged strip of dead space beside a short scale. The minimum
// decides how many notes a line holds; the maximum stops a short final system
// from sprawling.
export const MIN_NOTE_SPACING = 32;
export const MAX_NOTE_SPACING = 48;
export const LEDGER_HALF_WIDTH = 9;
export const NAME_ROW_Y = 144;

// The bottom line of a treble staff is E4.
const BOTTOM_LINE_DIATONIC = toDiatonic({ letter: 2, alter: 0, octave: 4 });

export function yForDiatonic(diatonic: number): number {
  return STAFF_BOTTOM - (diatonic - BOTTOM_LINE_DIATONIC) * STEP;
}

export function yForPitch(p: Pitch): number {
  return yForDiatonic(toDiatonic(p));
}

/**
 * Ledger lines needed for a note, as y positions. Ledger lines only ever land
 * on whole-line positions, so a note sitting in a space still gets the line
 * below (or above) it — C6 in the space above A5 needs the A5 ledger too.
 */
export function ledgerLines(noteY: number): number[] {
  const lines: number[] = [];
  for (let y = STAFF_TOP - LINE_GAP; y >= noteY - 0.01; y -= LINE_GAP) lines.push(y);
  for (let y = STAFF_BOTTOM + LINE_GAP; y <= noteY + 0.01; y += LINE_GAP) lines.push(y);
  return lines;
}

// --- Clef ------------------------------------------------------------------

/** y of the G line (G4), the second line up, which the treble clef's spiral wraps. */
export const G_LINE_Y = STAFF_BOTTOM - LINE_GAP;

// About 7.3 staff spaces tall, the usual engraved proportion: the top curl
// rises roughly a space and a half above the staff, the tail hangs a little
// below it.
export const CLEF_SCALE = (7.3 * LINE_GAP) / CLEF_GLYPH_HEIGHT;

/** SVG transform that sets the clef glyph on the staff with its spiral on the G line. */
export function clefTransform(x = SIDE_PADDING + 2): string {
  const top = G_LINE_Y - CLEF_GLYPH_G_Y * CLEF_SCALE;
  return `translate(${x} ${top}) scale(${CLEF_SCALE})`;
}

// --- Key signature ---------------------------------------------------------

/** Horizontal step between key-signature accidentals, and the gap after the last one. */
export const KEYSIG_STEP = 11;
export const KEYSIG_GAP = 6;

// Where each accidental of a key signature sits on a treble staff, in the order
// they're added: sharps F C G D A E B, flats B E A D G C F — the conventional
// zig-zag that keeps every sharp and flat on the staff.
const at = (letter: number, octave: number): Pitch => ({ letter, alter: 0, octave });
const SHARP_POSITIONS = [at(3, 5), at(0, 5), at(4, 5), at(1, 5), at(5, 4), at(2, 5), at(6, 4)];
const FLAT_POSITIONS = [at(6, 4), at(2, 5), at(5, 4), at(1, 5), at(4, 4), at(0, 5), at(3, 4)];

/**
 * Staff positions for a key signature of `fifths` sharps (positive) or flats
 * (negative), each carrying the alteration it applies.
 */
export function keySignaturePitches(fifths: number): Pitch[] {
  const n = Math.min(7, Math.abs(Math.trunc(fifths)));
  const sign = Math.sign(fifths);
  return (sign > 0 ? SHARP_POSITIONS : FLAT_POSITIONS).slice(0, n).map((p) => ({ ...p, alter: sign }));
}

/** Gap between an accidental's right edge and the notehead it belongs to. */
export const ACCIDENTAL_GAP = 9;

/**
 * SVG transform that draws an accidental glyph (in staff spaces, origin at its
 * left edge on the line) with its left edge at `x` on a note at `y`.
 */
export function glyphTransform(x: number, y: number): string {
  return `translate(${x} ${y}) scale(${LINE_GAP})`;
}

/**
 * Width of everything before the first note: the clef, plus the key signature
 * and a little air after it when there is one.
 */
export function headerWidth(fifths = 0): number {
  const n = keySignaturePitches(fifths).length;
  return CLEF_WIDTH + (n > 0 ? n * KEYSIG_STEP + KEYSIG_GAP : 0);
}

/** Stems point away from the middle line so they stay inside the staff. */
export function stemUp(noteY: number): boolean {
  return noteY > (STAFF_TOP + STAFF_BOTTOM) / 2;
}

// Layout below takes `header` — the width before the first note, from
// headerWidth() — defaulting to a bare clef.

/** Spacing that spreads `count` notes across the measured width. */
export function noteSpacingFor(containerWidth: number, count: number, header = CLEF_WIDTH): number {
  if (containerWidth <= 0 || count <= 0) return MIN_NOTE_SPACING;
  const usable = containerWidth - SIDE_PADDING * 2 - header;
  return Math.min(MAX_NOTE_SPACING, Math.max(MIN_NOTE_SPACING, usable / count));
}

export function noteX(indexInSystem: number, spacing: number, header = CLEF_WIDTH): number {
  return SIDE_PADDING + header + spacing * (indexInSystem + 0.5);
}

/**
 * The system's viewBox width. Once measured this is the container width
 * exactly, so the SVG renders 1:1 at `width: 100%` and noteheads keep their
 * intended size instead of being scaled up to fill.
 */
export function systemWidth(containerWidth: number, count: number, spacing: number, header = CLEF_WIDTH): number {
  return containerWidth > 0 ? containerWidth : SIDE_PADDING * 2 + header + spacing * count;
}

/**
 * How many notes fit on one line at the given container width. Falls back to
 * the whole scale on a zero width (first render, before measurement) so the
 * staff never flashes as a one-note-per-line column.
 */
export function notesPerSystem(containerWidth: number, total: number, header = CLEF_WIDTH): number {
  if (containerWidth <= 0) return total;
  const usable = containerWidth - SIDE_PADDING * 2 - header;
  return Math.max(4, Math.min(total, Math.floor(usable / MIN_NOTE_SPACING)));
}

/** Splits a scale into systems (staff lines) of at most `perSystem` notes. */
export function intoSystems<T>(items: T[], perSystem: number): T[][] {
  if (perSystem <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += perSystem) out.push(items.slice(i, i + perSystem));
  return out;
}
