// Sharp, flat and double-sharp glyphs as SVG paths, measured in staff spaces.
//
// Drawn rather than typed for the same reason as the clef: the ♯ and ♭
// characters come from whatever font the viewer's system falls back to, at
// whatever size and height that font gives them — tiny on some machines,
// misplaced on others. These follow engraved proportions instead: a sharp about
// 2.7 spaces tall and one wide, straddling its line or space; a flat with its
// stem rising 1.75 spaces and its bowl sitting on the line or space.
//
// Origin: the glyph's left edge, on the note's line or space. Scale by the
// staff's line gap to draw.

export type Glyph = { d: string; width: number };

const SHARP: Glyph = {
  width: 1,
  d: 'M 0.26 -1.25 L 0.38 -1.25 L 0.38 1.45 L 0.26 1.45 Z M 0.62 -1.45 L 0.74 -1.45 L 0.74 1.25 L 0.62 1.25 Z M 0 -0.43 L 1 -0.75 L 1 -0.47 L 0 -0.15 Z M 0 0.47 L 1 0.15 L 1 0.43 L 0 0.75 Z'
};

const FLAT: Glyph = {
  width: 0.98,
  d: 'M 0 -1.87 L 0.13 -1.87 L 0.13 0.44 L 0 0.44 Z M 0.13 -0.22 C 0.5 -0.64 0.98 -0.4 0.8 -0.06 C 0.66 0.21 0.36 0.38 0.13 0.44 L 0.13 0.26 C 0.32 0.16 0.6 -0.02 0.62 -0.2 C 0.64 -0.4 0.36 -0.42 0.13 -0.06 Z'
};

const DOUBLE_SHARP: Glyph = {
  width: 0.86,
  d: 'M -0.012 -0.288 L 0.688 0.412 L 0.872 0.228 L 0.172 -0.472 Z M 0.172 0.412 L 0.872 -0.288 L 0.688 -0.472 L -0.012 0.228 Z'
};

const DOUBLE_FLAT: Glyph = {
  width: 1.7,
  d: 'M 0 -1.87 L 0.13 -1.87 L 0.13 0.44 L 0 0.44 Z M 0.13 -0.22 C 0.5 -0.64 0.98 -0.4 0.8 -0.06 C 0.66 0.21 0.36 0.38 0.13 0.44 L 0.13 0.26 C 0.32 0.16 0.6 -0.02 0.62 -0.2 C 0.64 -0.4 0.36 -0.42 0.13 -0.06 Z M 0.72 -1.87 L 0.85 -1.87 L 0.85 0.44 L 0.72 0.44 Z M 0.85 -0.22 C 1.22 -0.64 1.7 -0.4 1.52 -0.06 C 1.38 0.21 1.08 0.38 0.85 0.44 L 0.85 0.26 C 1.04 0.16 1.32 -0.02 1.34 -0.2 C 1.36 -0.4 1.08 -0.42 0.85 -0.06 Z'
};

/** The glyph for an alteration, or `null` for a natural (nothing is drawn). */
export function accidentalGlyph(alter: number): Glyph | null {
  if (alter === 1) return SHARP;
  if (alter === -1) return FLAT;
  if (alter === 2) return DOUBLE_SHARP;
  if (alter === -2) return DOUBLE_FLAT;
  return null;
}
