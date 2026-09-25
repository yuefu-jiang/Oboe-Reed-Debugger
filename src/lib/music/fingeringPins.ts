// Pinned fingering choices, remembered per note across visits.
//
// Kept in localStorage: this is a per-player preference ("I play forked F"),
// never shared, and the page works exactly the same without it — so every
// access is wrapped, and a private window or blocked storage just means pins
// last for the session.

import { fingeringsFor } from './fingerings';

// v1 stored list positions, which silently re-pointed when an alternate was
// inserted ahead of a pinned one; v2 stores names. Old v1 pins are ignored.
const STORAGE_KEY = 'obt.fingeringPins.v2';

/**
 * MIDI note -> name of the pinned fingering. Stored by name rather than by
 * position so adding or reordering alternates can't move a pin onto a
 * different fingering.
 */
export type Pins = Record<number, string>;

/**
 * Parses stored pins, dropping anything that no longer points at a real
 * alternate — if the fingering table changes under a saved pin, the pin quietly
 * falls away instead of selecting the wrong fingering.
 */
export function parsePins(raw: string | null): Pins {
  if (!raw) return {};
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return {}; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};

  const pins: Pins = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const midi = Number(key);
    if (!Number.isInteger(midi) || typeof value !== 'string') continue;
    if (fingeringsFor(midi).some((f) => f.name === value)) pins[midi] = value;
  }
  return pins;
}

export function loadPins(): Pins {
  try { return parsePins(localStorage.getItem(STORAGE_KEY)); } catch { return {}; }
}

export function savePins(pins: Pins): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pins)); } catch { /* storage unavailable */ }
}
