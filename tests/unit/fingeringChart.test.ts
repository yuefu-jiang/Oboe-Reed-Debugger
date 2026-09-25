import { describe, it, expect, beforeEach } from 'vitest';
import rawChart from '../../fingering-chart.svg?raw';
import { inlineSvg, applyFingering } from '$lib/components/fingeringChartDom';
import { FINGERING_OPTIONS, fingeringFor } from '$lib/music/fingerings';

// Drives the same DOM code FingeringChart.svelte runs. Worth exercising because
// all of it depends on the HTML parser accepting Inkscape's namespaced output
// and on ids surviving that round trip — if either broke, the chart would
// still render and simply never light up.
describe('fingering chart highlighting', () => {
  let host: HTMLDivElement;
  const lit = () => [...host.querySelectorAll('.key-active')].map((el) => el.id).sort();

  beforeEach(() => {
    host = document.createElement('div');
    host.innerHTML = inlineSvg(rawChart);
  });

  it('parses as HTML with a single root svg', () => {
    expect(host.children).toHaveLength(1);
    expect(host.firstElementChild?.tagName.toLowerCase()).toBe('svg');
    expect(host.firstElementChild?.getAttribute('viewBox')).toBe('0 0 114.77967 302.63696');
  });

  it('keeps every key any fingering uses reachable by id after the round trip', () => {
    for (const options of Object.values(FINGERING_OPTIONS)) {
      for (const { keys } of options) {
        for (const key of keys) expect(host.querySelector(`#${key}`), `#${key} missing`).not.toBeNull();
      }
    }
  });

  it('lights up exactly the keys a fingering names', () => {
    applyFingering(host, fingeringFor(60)!); // C4
    expect(lit()).toEqual(['a', 'b', 'd', 'e', 'f-sharp', 'g', 'right-c'].sort());
  });

  it('clears the previous note when the fingering changes', () => {
    applyFingering(host, fingeringFor(60)!); // C4 uses the RH pinky C key
    applyFingering(host, fingeringFor(67)!); // G4 uses only LH 1-2-3
    expect(lit()).toEqual(['a', 'b', 'g']);
  });

  it('leaves the whole chart dark for an empty fingering', () => {
    applyFingering(host, fingeringFor(60)!);
    applyFingering(host, []);
    expect(lit()).toHaveLength(0);
  });

  it('never marks a vent outline as a pressed key', () => {
    applyFingering(host, ['b', 'd', 'b-vent', 'd-vent']);
    expect(lit()).toEqual(['b', 'd']);
  });
});

describe('LH1 plate and RH3 ring', () => {
  let host: HTMLDivElement;
  const active = (id: string) => host.querySelector(`#${id}`)!.classList.contains('key-active');
  const num = (id: string, attr: string) => Number(host.querySelector(`#${id}`)!.getAttribute(attr));
  // Endpoints of a path's M, L and A segments — not the arc radii, which are
  // written as coordinate-looking pairs too.
  const points = (id: string) =>
    [...host.querySelector(`#${id}`)!.getAttribute('d')!.matchAll(/(?:[ML]|\d \d \d) (-?[\d.]+),(-?[\d.]+)/g)]
      .map((m) => [Number(m[1]), Number(m[2])]);

  beforeEach(() => {
    host = document.createElement('div');
    host.innerHTML = inlineSvg(rawChart);
  });

  it('has only the LH1 half-hole — the other half shapes are gone', () => {
    for (const id of ['a-half', 'g-half', 'e-half', 'd-half']) {
      expect(host.querySelector(`#${id}`), id).toBeNull();
    }
    expect(host.querySelector('#b-half')).not.toBeNull();
  });

  it('draws the half-hole as the plate outline around the vent, painting nothing while unused', () => {
    const half = host.querySelector('#b-half')!;
    const style = half.getAttribute('style')!;
    expect(style).toContain('fill-rule:evenodd');
    expect(style).toContain('fill:none');
    // Two closed subpaths: the plate's outer edge (tab included) and the vent it rings.
    expect(half.getAttribute('d')!.match(/Z/g)).toHaveLength(2);
    // ...and that outer edge is exactly the plate's own outline.
    expect(half.getAttribute('d')!.startsWith(host.querySelector('#b')!.getAttribute('d')!)).toBe(true);
  });

  it('gives LH1 a small vent and RH3 a large ring hole', () => {
    expect(num('b-vent', 'r')).toBe(4);
    expect(num('d-vent', 'r')).toBe(7.5);
    expect(num('d-vent', 'cx')).toBeCloseTo(num('d', 'cx'), 5);
    expect(num('d-vent', 'cy')).toBeCloseTo(num('d', 'cy'), 5);
  });

  it("puts LH1's tab on the lower rim, pointing down and away from the plate", () => {
    const [cx, cy] = [num('b-vent', 'cx'), num('b-vent', 'cy')];
    const pts = points('b');
    const dist = pts.map(([x, y]) => Math.hypot(x - cx, y - cy));
    const tip = pts[dist.indexOf(Math.max(...dist))];
    expect(Math.max(...dist)).toBeGreaterThan(12.5 + 4);   // reaches well past the rim
    expect(tip[1]).toBeGreaterThan(cy + 12.5);              // below the plate
    // The rest of the outline sits on the rim.
    for (const d of dist.filter((d) => d !== Math.max(...dist))) expect(d).toBeCloseTo(12.5, 3);
  });

  it("keeps LH1's tab clear of the small key underneath it", () => {
    // bd's round end tops out below y=83 left of x=68; the tab's point must be
    // to the right of that and clear of the trill key further right (x>74.6).
    const tip = points('b').reduce((a, b) => (b[1] > a[1] ? b : a));
    expect(tip[0]).toBeGreaterThan(70);
    expect(tip[0]).toBeLessThan(74.6);
  });

  it('leaves LH1 blank while it is open', () => {
    applyFingering(host, fingeringFor(85)!); // C#6 — LH1 off
    expect(active('b')).toBe(false);
    expect(active('b-half')).toBe(false);
  });

  it('colors the plate ring, not the whole key, for a half-hole', () => {
    applyFingering(host, fingeringFor(74)!); // D5
    expect(active('b-half')).toBe(true);
    expect(active('b')).toBe(false);
  });

  it('colors the whole plate for a fully covered LH1', () => {
    applyFingering(host, fingeringFor(71)!); // B4
    expect(active('b')).toBe(true);
    expect(active('b-half')).toBe(false);
  });

  it('shows RH3 as either filled or blank — never half', () => {
    applyFingering(host, fingeringFor(62)!); // D4 — RH3 down
    expect(active('d')).toBe(true);
    applyFingering(host, fingeringFor(67)!); // G4 — RH3 up
    expect(active('d')).toBe(false);
  });

  it('keeps every hole outline visible and unfilled, whatever the key is doing', () => {
    for (const midi of [85, 74, 71, 62, 67]) {
      applyFingering(host, fingeringFor(midi)!);
      for (const vent of ['b-vent', 'd-vent']) {
        const el = host.querySelector(`#${vent}`)!;
        expect(el.classList.contains('key-active'), `${vent} @ ${midi}`).toBe(false);
        expect(el.getAttribute('style'), vent).toContain('fill:none');
      }
    }
  });

  it('draws the vent outlines above the keys they sit in', () => {
    const order = [...host.querySelectorAll('[id]')].map((el) => el.id);
    expect(order.indexOf('b-half')).toBeGreaterThan(order.indexOf('b'));
    expect(order.indexOf('b-vent')).toBeGreaterThan(order.indexOf('b-half'));
    expect(order.indexOf('d-vent')).toBeGreaterThan(order.indexOf('d'));
  });
});
