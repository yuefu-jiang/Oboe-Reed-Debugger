// DOM side of FingeringChart.svelte, kept out of the component so the tests
// drive the same code the page runs.

const VENT = '-vent';

/**
 * Inkscape writes an XML prolog and a generator comment ahead of <svg>. Those
 * are legal in a standalone .svg file but meaningless once the markup is set as
 * innerHTML, where the parser turns the prolog into a stray comment node — so
 * the file is trimmed to the <svg> element itself.
 */
export function inlineSvg(raw: string): string {
  return raw.slice(raw.indexOf('<svg'));
}

/**
 * Fills the keys a fingering names and clears the rest.
 *
 * Keys with a hole in them (LH1's vent, RH3's ring) carry a separate
 * `<key>-vent` outline drawn on top. It's part of the drawing, not a key of
 * its own, so it's never filled — which keeps the hole's edge visible whether
 * the key is open, half-holed or pressed.
 */
export function applyFingering(host: ParentNode, keys: string[]): void {
  const active = new Set(keys);
  for (const el of host.querySelectorAll('[id]')) {
    el.classList.toggle('key-active', !el.id.endsWith(VENT) && active.has(el.id));
  }
}
