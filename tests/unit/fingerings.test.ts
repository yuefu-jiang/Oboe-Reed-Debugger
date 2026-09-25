import { describe, it, expect } from 'vitest';
import chartSvg from '../../fingering-chart.svg?raw';
import {
  FINGERINGS, FINGERING_MIN_MIDI, FINGERING_MAX_MIDI, fingeringFor, fingeringLabels, hasFingering,
  fingeringsFor, cycleIndex, chooseFingering, keyLabels
} from '$lib/music/fingerings';

describe('fingering coverage', () => {
  it('covers every semitone from Bb3 to A6 with no gaps', () => {
    expect(FINGERING_MIN_MIDI).toBe(58);
    expect(FINGERING_MAX_MIDI).toBe(93);
    for (let midi = FINGERING_MIN_MIDI; midi <= FINGERING_MAX_MIDI; midi++) {
      expect(fingeringFor(midi), `missing fingering for MIDI ${midi}`).toBeDefined();
    }
  });

  it('reports notes outside the charted range as unavailable', () => {
    expect(hasFingering(FINGERING_MIN_MIDI - 1)).toBe(false);
    expect(hasFingering(FINGERING_MAX_MIDI + 1)).toBe(false);
    expect(fingeringFor(FINGERING_MAX_MIDI + 1)).toBeNull();
  });
});

describe('fingering key ids', () => {
  // The chart is the data model — a typo'd id would silently highlight
  // nothing, so every id has to actually exist in the artwork.
  const chartIds = new Set([...chartSvg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

  it('only references ids present in fingering-chart.svg', () => {
    for (const [midi, keys] of Object.entries(FINGERINGS)) {
      for (const key of keys) {
        expect(chartIds.has(key), `MIDI ${midi} references unknown chart id "${key}"`).toBe(true);
      }
    }
  });

  it('never lists the same key twice for one note', () => {
    for (const [midi, keys] of Object.entries(FINGERINGS)) {
      expect(new Set(keys).size, `MIDI ${midi} repeats a key`).toBe(keys.length);
    }
  });

  it('has a label for every key it uses', () => {
    for (const midi of Object.keys(FINGERINGS)) {
      for (const label of fingeringLabels(Number(midi))) {
        expect(label).not.toMatch(/^[a-z0-9-]+$/); // an unlabelled id would fall through verbatim
      }
    }
  });
});

describe('no two notes share a fingering', () => {
  it('gives every charted note a distinct key pattern', () => {
    const seen = new Map<string, number>();
    for (let midi = FINGERING_MIN_MIDI; midi <= FINGERING_MAX_MIDI; midi++) {
      const key = [...fingeringFor(midi)!].sort().join('+');
      expect(seen.has(key), `MIDI ${midi} duplicates MIDI ${seen.get(key)}`).toBe(false);
      seen.set(key, midi);
    }
    expect(seen.size).toBe(FINGERING_MAX_MIDI - FINGERING_MIN_MIDI + 1);
  });
});

// Spot checks against Yamaha's published oboe fingering chart.
describe('specific fingerings', () => {
  it('fingers low D with all six tone holes and nothing else', () => {
    expect(fingeringFor(62)).toEqual(['b', 'a', 'g', 'f-sharp', 'e', 'd']);
  });

  it('vents C and Bb with RH1 rather than treating it as a tone hole', () => {
    // B4 plus RH1 is C5, and A4 plus RH1 is Bb4 — RH1 raises, not lowers.
    expect(fingeringFor(71)).toEqual(['b']);                 // B4
    expect(fingeringFor(72)).toEqual(['b', 'f-sharp']);      // C5
    expect(fingeringFor(69)).toEqual(['b', 'a']);            // A4
    expect(fingeringFor(70)).toEqual(['b', 'a', 'f-sharp']); // Bb4
  });

  it('fingers F as E plus the F key, with RH2 still down', () => {
    expect(fingeringFor(65)).toEqual([...fingeringFor(64)!, 'right-f']);
  });

  it('half-holes C#5 rather than leaving it open', () => {
    expect(fingeringFor(73)).toContain('b-half');
    expect(fingeringFor(73)).toContain('right-c-sharp');
    expect(fingeringFor(73)).not.toContain('b');
  });

  it('uses the half-hole for C#5 through Eb5 but no octave key', () => {
    for (const midi of [73, 74, 75]) {
      expect(fingeringFor(midi)).toContain('b-half');
      expect(fingeringFor(midi)).not.toContain('b');
      expect(fingeringFor(midi)).not.toContain('octave-1');
    }
  });

  it('uses the thumb octave key for E5-G#5 and the side key alone for A5-C6', () => {
    for (let midi = 76; midi <= 80; midi++) {
      expect(fingeringFor(midi)).toContain('octave-1');
      expect(fingeringFor(midi)).not.toContain('octave-2');
    }
    for (let midi = 81; midi <= 84; midi++) {
      expect(fingeringFor(midi)).toContain('octave-2');
      expect(fingeringFor(midi)).not.toContain('octave-1');
    }
  });

  it('switches to the 3rd octave key for G6 and G#6', () => {
    for (const midi of [91, 92]) {
      expect(fingeringFor(midi)).toContain('octave-3');
      expect(fingeringFor(midi)).not.toContain('octave-1');
    }
    expect(fingeringFor(93)).toContain('octave-1'); // A6 goes back to the 1st
  });

  it('keeps each note and its octave on the same holes, differing only by the octave keys', () => {
    for (const [low, high] of [[64, 76], [65, 77], [66, 78], [67, 79], [68, 80]]) {
      expect(fingeringFor(high), `${low}/${high}`).toEqual(['octave-1', ...fingeringFor(low)!]);
    }
    for (const [low, high] of [[69, 81], [70, 82], [71, 83], [72, 84]]) {
      expect(fingeringFor(high), `${low}/${high}`).toEqual(['octave-2', ...fingeringFor(low)!]);
    }
  });

  it('builds the low notes from low D plus pinky keys', () => {
    const lowD = fingeringFor(62)!;
    for (const [midi, key] of [[60, 'right-c'], [61, 'right-c-sharp'], [63, 'right-eb']] as const) {
      expect(fingeringFor(midi)).toEqual([...lowD, key]);
    }
    // Low B and Bb hold the right-pinky C key down under the left-pinky key.
    expect(fingeringFor(59)).toEqual([...lowD, 'right-c', 'low-b']);
    expect(fingeringFor(58)).toEqual([...lowD, 'right-c', 'low-b-flat']);
  });

  it('lifts LH1 entirely for C#6, with no octave key', () => {
    const keys = fingeringFor(85)!;
    for (const k of ['b', 'b-half', 'octave-1', 'octave-2']) expect(keys).not.toContain(k);
    expect(keys).toContain('right-c');
  });

  it('goes back to the half-hole for D6 through F6', () => {
    for (const midi of [86, 87, 88, 89]) expect(fingeringFor(midi), `${midi}`).toContain('b-half');
  });

  it("keeps Yamaha's LH1-off D6 as an alternate", () => {
    const off = fingeringsFor(86).find((f) => f.name === 'LH1 off')!;
    expect(off.keys).toEqual(['a', 'g', 'right-c']);
    expect(off.sources).toEqual(['Yamaha']);
  });

  it('fingers every F6 as the matching E6 with LH3 lifted', () => {
    expect(fingeringsFor(89).map((f) => f.name)).toEqual(fingeringsFor(88).map((f) => f.name));
    fingeringsFor(88).forEach((e6, i) => {
      expect(fingeringsFor(89)[i].keys, e6.name).toEqual(e6.keys.filter((k) => k !== 'g'));
    });
  });
});

describe('alternate fingerings', () => {
  const chartIds = new Set([...chartSvg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const allOptions = () => {
    const out: { midi: number; name: string; keys: string[] }[] = [];
    for (let midi = FINGERING_MIN_MIDI; midi <= FINGERING_MAX_MIDI; midi++) {
      for (const f of fingeringsFor(midi)) out.push({ midi, ...f });
    }
    return out;
  };

  it('offers alternates exactly where the sources give more than one fingering', () => {
    const multi = [];
    for (let midi = FINGERING_MIN_MIDI; midi <= FINGERING_MAX_MIDI; midi++) {
      if (fingeringsFor(midi).length > 1) multi.push(midi);
    }
    expect(multi).toEqual([63, 65, 68, 75, 77, 80, 86, 87, 88, 89]);
  });

  it('always lists the typical fingering first, unchanged', () => {
    for (let midi = FINGERING_MIN_MIDI; midi <= FINGERING_MAX_MIDI; midi++) {
      expect(fingeringsFor(midi)[0].keys).toEqual(fingeringFor(midi));
    }
  });

  it('is empty outside the charted range', () => {
    expect(fingeringsFor(FINGERING_MAX_MIDI + 1)).toEqual([]);
  });

  it('names both options wherever there is a choice', () => {
    expect(fingeringsFor(65).map((f) => f.name)).toEqual(['Right F key', 'Left F key', 'Forked F']);
    expect(fingeringsFor(63).map((f) => f.name)).toEqual(['Right E\u266D key', 'Left E\u266D key']);
  });

  const named = (midi: number, name: string) => fingeringsFor(midi).find((f) => f.name === name)!.keys;

  it('fingers left-hand F as E plus the left F key', () => {
    expect(named(65, 'Left F key')).toEqual([...fingeringFor(64)!, 'left-f']);
  });

  it('fingers forked F with RH1 and RH3, RH2 lifted', () => {
    const forked = named(65, 'Forked F');
    expect(forked).toEqual(expect.arrayContaining(['b', 'a', 'g', 'f-sharp', 'd']));
    expect(forked).not.toContain('e');
    expect(forked).not.toContain('right-f');
  });

  it('keeps each alternate in step with its octave partner', () => {
    expect(fingeringsFor(77).map((f) => f.name)).toEqual(fingeringsFor(65).map((f) => f.name));
    fingeringsFor(65).forEach((f, i) => {
      expect(fingeringsFor(77)[i].keys, f.name).toEqual(['octave-1', ...f.keys]);
    });
    expect(fingeringsFor(75)[1].keys.filter((k) => k !== 'b-half'))
      .toEqual(fingeringsFor(63)[1].keys.filter((k) => k !== 'b'));
  });

  it('only references ids present in the chart', () => {
    for (const { midi, name, keys } of allOptions()) {
      for (const key of keys) expect(chartIds.has(key), `${midi} ${name}: "${key}"`).toBe(true);
    }
  });

  it('never repeats a key pattern anywhere, alternates included', () => {
    const seen = new Map<string, string>();
    for (const { midi, name, keys } of allOptions()) {
      const sig = [...keys].sort().join('+');
      expect(seen.has(sig), `${midi} ${name} duplicates ${seen.get(sig)}`).toBe(false);
      seen.set(sig, `${midi} ${name}`);
    }
  });

  it('labels every key an alternate uses', () => {
    for (const { keys } of allOptions()) {
      for (const label of keyLabels(keys)) expect(label).not.toMatch(/^[a-z0-9-]+$/);
    }
  });
});

describe('cycleIndex', () => {
  it('steps forward and back', () => {
    expect(cycleIndex(0, 3, 1)).toBe(1);
    expect(cycleIndex(2, 3, -1)).toBe(1);
  });

  it('wraps at both ends so the arrows never dead-end', () => {
    expect(cycleIndex(1, 2, 1)).toBe(0);
    expect(cycleIndex(0, 2, -1)).toBe(1);
  });

  it('stays at zero when there is nothing to cycle', () => {
    expect(cycleIndex(0, 0, 1)).toBe(0);
    expect(cycleIndex(0, 1, 1)).toBe(0);
  });
});

describe('chooseFingering', () => {
  it('shows the typical fingering by default', () => {
    expect(chooseFingering(2)).toBe(0);
  });

  it('shows a pinned fingering when there is one', () => {
    expect(chooseFingering(2, 1)).toBe(1);
  });

  it('lets an on-the-spot choice override the pin', () => {
    expect(chooseFingering(2, 1, 0)).toBe(0);
  });

  it('ignores anything out of range rather than indexing past the end', () => {
    expect(chooseFingering(2, 5)).toBe(0);
    expect(chooseFingering(2, 1, 9)).toBe(1);
    expect(chooseFingering(1, -1, 1.5)).toBe(0);
  });
});

describe('sources', () => {
  it('credits every fingering to at least one source', () => {
    for (let midi = FINGERING_MIN_MIDI; midi <= FINGERING_MAX_MIDI; midi++) {
      for (const f of fingeringsFor(midi)) {
        expect(f.sources.length, `${midi} ${f.name}`).toBeGreaterThan(0);
        for (const src of f.sources) expect(['IDRS', 'Yamaha']).toContain(src);
      }
    }
  });

  it('defaults to a fingering IDRS gives wherever IDRS gives one', () => {
    for (let midi = FINGERING_MIN_MIDI; midi <= FINGERING_MAX_MIDI; midi++) {
      const options = fingeringsFor(midi);
      if (options.some((f) => f.sources.includes('IDRS'))) {
        expect(options[0].sources, `${midi}`).toContain('IDRS');
      }
    }
  });
});
