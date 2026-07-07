import { describe, it, expect } from 'vitest';
import { analyzeRecording, matchSymptoms, type RecordingAnalysis, type HarmonicBand } from '$lib/audio/recordingAnalyzer';

function makeMockAudioBuffer(freqs: number[], sampleRate: number, duration: number): AudioBuffer {
  const length = Math.floor(sampleRate * duration);
  const data = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let s = 0;
    for (const f of freqs) s += Math.sin((2 * Math.PI * f * i) / sampleRate);
    data[i] = s / freqs.length;
  }
  return {
    sampleRate,
    length,
    duration,
    numberOfChannels: 1,
    getChannelData: () => data
  } as unknown as AudioBuffer;
}

function octaveAt(analysis: RecordingAnalysis, multiple: number): HarmonicBand {
  return analysis.octaves.find(o => o.multiple === multiple)!;
}

// Weighted tones + a tiny deterministic noise floor, to mimic real breath/reed noise
function makeWeightedBuffer(tones: [freq: number, amp: number][], sampleRate: number, duration: number): AudioBuffer {
  const length = Math.floor(sampleRate * duration);
  const data = new Float32Array(length);
  let seed = 7;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed / 0x7fffffff) * 2 - 1;
  };
  const norm = tones.reduce((sum, [, a]) => sum + a, 0) + 0.1;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    let s = 0.1 * rand();
    for (const [f, a] of tones) s += a * Math.sin(2 * Math.PI * f * t);
    data[i] = s / norm;
  }
  return { sampleRate, length, duration, numberOfChannels: 1, getChannelData: () => data } as unknown as AudioBuffer;
}

describe('analyzeRecording', () => {
  it('detects a single-octave (monotone) crow for one steady tone', () => {
    const buf = makeMockAudioBuffer([1047], 44100, 1);
    const result = analyzeRecording(buf);
    expect(octaveAt(result, 1).present).toBe(true);
    expect(result.octaveCount).toBe(1);
    expect(result.fundamentalHz).toBeGreaterThan(1040);
    expect(result.fundamentalHz).toBeLessThan(1054);
  });

  it('detects two stacked octaves for a double-crow signal', () => {
    const buf = makeMockAudioBuffer([1047, 2093], 44100, 1);
    const result = analyzeRecording(buf);
    expect(octaveAt(result, 1).present).toBe(true);
    expect(octaveAt(result, 2).present).toBe(true);
    expect(result.octaveCount).toBe(2);
    expect(result.hasLowerOctave).toBe(false);
  });

  it('detects a full three-octave crow with the fundamental at the lowest present band', () => {
    const buf = makeMockAudioBuffer([523, 1047, 2093], 44100, 1);
    const result = analyzeRecording(buf);
    expect(result.octaveCount).toBe(3);
    expect(result.fundamentalHz).toBeGreaterThan(500);
    expect(result.fundamentalHz).toBeLessThan(560);
    // 523 Hz is itself a C (C5) — a crow rooted there should read as in tune,
    // not "flat" just because it isn't C6.
    expect(Math.abs(result.centsFromC)).toBeLessThan(30);
  });

  it('reports the dominant C6 as fundamental, not an unrelated resonance below it', () => {
    // Regression test: a real C6+C7 crow plus an unrelated real resonance
    // (e.g. a formant or wolf tone) near 634 Hz must not be mistaken for "the
    // octave below." Two unrelated real tones can share a low common divisor
    // (634 and 1047 both roughly divide by ~209) that superficially "explains"
    // both — but a genuine fundamental should have real energy at its own
    // frequency, and the dominant, best-corroborated candidate here is 1047,
    // not a fabricated common sub-multiple.
    const buf = makeWeightedBuffer([[1047, 1.0], [2093, 0.6], [634, 0.5]], 44100, 1);
    const result = analyzeRecording(buf);
    expect(result.fundamentalHz).toBeGreaterThan(1000);
    expect(result.fundamentalHz).toBeLessThan(1090);
    expect(Math.abs(result.centsFromC)).toBeLessThan(30);
    // C6 (multiple 1) should be the dominant band, matching the real spectrogram
    const c6 = result.octaves.find(o => o.multiple === 1)!;
    const c7 = result.octaves.find(o => o.multiple === 2)!;
    expect(c6.present).toBe(true);
    expect(c6.level).toBeGreaterThan(c7.level);
  });

  it('identifies the true fundamental even when the raw pitch detector locks onto a non-octave harmonic', () => {
    // Regression test: a rich crow's raw per-frame pitch estimate can land on
    // any harmonic (e.g. the 3rd, which is a fifth above the octave, not a C).
    // The true fundamental must be recovered from the full harmonic series,
    // not taken at face value from the raw detector output.
    const root = 517; // a slightly-flat C5
    const buf = makeMockAudioBuffer(
      [root, root * 2, root * 3, root * 4, root * 5, root * 6, root * 7, root * 8],
      44100,
      1
    );
    const result = analyzeRecording(buf);
    // The C-family octaves (1x, 2x, 4x, 8x) should all be present
    expect(octaveAt(result, 1).present).toBe(true);
    expect(octaveAt(result, 2).present).toBe(true);
    expect(octaveAt(result, 4).present).toBe(true);
    expect(octaveAt(result, 8).present).toBe(true);
    expect(result.octaveCount).toBe(4);
    // fundamentalHz should land near the true root, not a non-octave harmonic
    expect(result.fundamentalHz).toBeGreaterThan(500);
    expect(result.fundamentalHz).toBeLessThan(540);
    // The non-octave harmonics (3rd/5th/6th/7th) should be picked up as buzz
    expect(result.harmonicCompleteness).toBeGreaterThan(0.5);
    // Regression: at high multiples, a too-wide search window can "steal" a
    // neighboring harmonic's peak instead of measuring its own — every band's
    // measured hz should sit close to its own multiple of the fundamental,
    // not several hundred Hz off toward an adjacent harmonic.
    for (const band of [...result.octaves, ...result.harmonics]) {
      if (!band.present) continue;
      expect(Math.abs(band.hz - band.expectedHz) / band.expectedHz).toBeLessThan(0.05);
    }
  });

  it('reports low harmonic completeness for a clean crow with only the octaves', () => {
    const buf = makeMockAudioBuffer([1047, 2093], 44100, 1);
    const result = analyzeRecording(buf);
    expect(result.harmonicCompleteness).toBeLessThan(0.25);
  });

  it('finds multiple octave bands in a noisy, richly-buzzy full crow', () => {
    // Regression test: octave-band targets must be derived once from a stable,
    // harmonic-series-corrected fundamental, not recomputed per frame from that
    // frame's own noisy detectPitch estimate. A richly buzzy crow (many
    // simultaneous partials plus breath noise) is exactly the kind of signal
    // that can perturb a simple per-frame autocorrelation estimate.
    const sampleRate = 44100;
    const length = sampleRate * 1.5;
    const data = new Float32Array(length);
    let seed = 99;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return (seed / 0x7fffffff) * 2 - 1;
    };
    const root = 1029; // a slightly flat C6, as in a real reed
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const s =
        1.0 * Math.sin(2 * Math.PI * root * t) +
        0.7 * Math.sin(2 * Math.PI * root * 2 * t) +
        0.5 * Math.sin(2 * Math.PI * root * 4 * t) +
        0.3 * Math.sin(2 * Math.PI * root * 0.5 * t) +
        0.4 * rand();
      data[i] = s / 3.4;
    }
    const buf = {
      sampleRate, length, duration: 1.5, numberOfChannels: 1, getChannelData: () => data
    } as unknown as AudioBuffer;
    const result = analyzeRecording(buf);
    expect(result.octaveCount).toBeGreaterThanOrEqual(3);
  });

  it('reports high stability for a pure steady tone', () => {
    const buf = makeMockAudioBuffer([1047], 44100, 1);
    const result = analyzeRecording(buf);
    expect(result.pitchStability).toBeGreaterThan(0.9);
  });

  it('reports low stability for a wobbling pitch', () => {
    const sampleRate = 44100;
    const length = sampleRate;
    const data = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const wobble = 1047 + 40 * Math.sin(2 * Math.PI * 3 * t);
      data[i] = Math.sin(2 * Math.PI * wobble * t);
    }
    const buf = {
      sampleRate,
      length,
      duration: 1,
      numberOfChannels: 1,
      getChannelData: () => data
    } as unknown as AudioBuffer;
    const result = analyzeRecording(buf);
    expect(result.pitchStability).toBeLessThan(0.5);
  });

  it('returns absent defaults for silence', () => {
    const buf = makeMockAudioBuffer([0], 44100, 1);
    const result = analyzeRecording(buf);
    expect(result.fundamentalHz).toBe(-1);
    expect(result.octaveCount).toBe(0);
    expect(result.hasLowerOctave).toBe(false);
    expect(result.pitchStability).toBe(0);
    expect(result.harmonicCompleteness).toBe(0);
  });
});

function makeAnalysis(overrides: Partial<RecordingAnalysis>): RecordingAnalysis {
  return {
    fundamentalHz: 1047,
    centsFromC: 0,
    pitchStability: 0.9,
    octaves: [],
    harmonics: [],
    octaveCount: 3,
    hasLowerOctave: true,
    harmonicCompleteness: 0.6,
    ...overrides
  };
}

describe('matchSymptoms', () => {
  it('matches crow-flat when well flat of the nearest C', () => {
    const ids = matchSymptoms(makeAnalysis({ centsFromC: -80 }));
    expect(ids).toContain('crow-flat');
  });

  it('matches crow-sharp when well sharp of the nearest C', () => {
    const ids = matchSymptoms(makeAnalysis({ centsFromC: 80 }));
    expect(ids).toContain('crow-sharp');
  });

  it('does not match crow-flat for a crow rooted on C5 instead of C6', () => {
    // The core fix: a crow doesn't have to be C6 specifically to be in tune —
    // any octave of C, close to 0 cents off, counts.
    const ids = matchSymptoms(makeAnalysis({ fundamentalHz: 523, centsFromC: 0 }));
    expect(ids).not.toContain('crow-flat');
    expect(ids).not.toContain('crow-sharp');
  });

  it('matches crow-unstable for low stability', () => {
    const ids = matchSymptoms(makeAnalysis({ pitchStability: 0.4 }));
    expect(ids).toContain('crow-unstable');
  });

  it('matches crow-one-wire for a monotone crow', () => {
    const ids = matchSymptoms(makeAnalysis({ octaveCount: 1, hasLowerOctave: false }));
    expect(ids).toContain('crow-one-wire');
  });

  it('matches crow-missing-lower-octave when upper Cs are present but nothing below the root', () => {
    const ids = matchSymptoms(makeAnalysis({ octaveCount: 2, hasLowerOctave: false }));
    expect(ids).toContain('crow-missing-lower-octave');
  });

  it('does not flag missing-lower-octave once a full three-octave crow is present', () => {
    const ids = matchSymptoms(makeAnalysis({ octaveCount: 3, hasLowerOctave: true }));
    expect(ids).not.toContain('crow-missing-lower-octave');
  });

  it('matches crow-thin for low harmonic completeness', () => {
    const ids = matchSymptoms(makeAnalysis({ harmonicCompleteness: 0.1 }));
    expect(ids).toContain('crow-thin');
  });

  it('returns empty for a normal, full three-octave, stable, buzzy crow', () => {
    const ids = matchSymptoms(makeAnalysis({
      fundamentalHz: 1100, pitchStability: 0.9, octaveCount: 3, hasLowerOctave: true, harmonicCompleteness: 0.6
    }));
    expect(ids.length).toBe(0);
  });
});
