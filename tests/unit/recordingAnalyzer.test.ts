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

// multiple is the harmonic number n relative to the virtual fundamental f0
// (n = 1,2,4,8,16,32 for C3..C8) — see recordingAnalyzer.ts.
function octaveAt(analysis: RecordingAnalysis, multiple: number): HarmonicBand {
  return analysis.octaves.find(o => o.multiple === multiple)!;
}

function allBuzzHarmonics(analysis: RecordingAnalysis): HarmonicBand[] {
  return analysis.buzzBands.flatMap(b => b.harmonics);
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

// A band-limited sawtooth-ish tone: every integer harmonic of f0 up to
// numHarmonics, amplitude decaying as 1/k — this is what the PDF's model
// describes a genuinely rich crow as being: one harmonic series descending
// from a single virtual fundamental, not a hand-picked handful of multiples.
function makeHarmonicSeriesBuffer(f0: number, numHarmonics: number, sampleRate: number, duration: number): AudioBuffer {
  const length = Math.floor(sampleRate * duration);
  const data = new Float32Array(length);
  let seed = 3;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed / 0x7fffffff) * 2 - 1;
  };
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    let s = 0.05 * rand();
    for (let k = 1; k <= numHarmonics; k++) s += (1 / Math.sqrt(k)) * Math.sin(2 * Math.PI * k * f0 * t);
    data[i] = s / 4;
  }
  return { sampleRate, length, duration, numberOfChannels: 1, getChannelData: () => data } as unknown as AudioBuffer;
}

describe('analyzeRecording', () => {
  it('detects a single-octave (monotone) crow for one steady tone', () => {
    const buf = makeMockAudioBuffer([1047], 44100, 1);
    const result = analyzeRecording(buf);
    expect(octaveAt(result, 8).present).toBe(true);
    expect(result.octaveCount).toBe(1);
    expect(result.fundamentalHz).toBeGreaterThan(1040);
    expect(result.fundamentalHz).toBeLessThan(1054);
  });

  it('detects two stacked octaves (C6+C7) as missing the TOP octave, not the lower one', () => {
    // A rooted C6+C7 crow is missing C8 above it — it must NOT be mislabelled
    // as "missing its lower octave" (the sharp/stuffy, no-root diagnosis).
    const buf = makeMockAudioBuffer([1047, 2093], 44100, 1);
    const result = analyzeRecording(buf);
    expect(octaveAt(result, 8).present).toBe(true);
    expect(octaveAt(result, 16).present).toBe(true);
    expect(result.octaveCount).toBe(2);
    expect(result.missingUpperOctave).toBe(true);
    expect(result.missingLowerOctave).toBe(false);
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
    // C6 (n=8) should be the dominant band, matching the real spectrogram
    const c6 = octaveAt(result, 8);
    const c7 = octaveAt(result, 16);
    expect(c6.present).toBe(true);
    expect(c6.level).toBeGreaterThan(c7.level);
  });

  it('roots on the true C even when the 3rd harmonic (a twelfth up) is the loudest band', () => {
    // Regression test (real-world case): a bright oboe crow rooted on C6 whose
    // fundamental is weak and whose 3rd harmonic (G7, ~3138 Hz — a twelfth
    // above the root) is actually the loudest band. A pure "energy at its own
    // frequency" gate disqualified the weak C6 root and let the loud, childless
    // G7 win, folding the whole octave grid onto G instead of C (labels G2..G7,
    // false "monotone"). The estimator must still root on C6 here.
    const root = 1046; // C6
    const buf = makeWeightedBuffer(
      [
        [root, 0.25],       // weak fundamental
        [root * 2, 0.5],    // C7
        [root * 3, 1.0],    // G7 — the LOUDEST band
        [root * 4, 0.4],    // C8
        [root * 5, 0.3]
      ],
      44100,
      1.5
    );
    const result = analyzeRecording(buf);
    // The grid must be C-based: f0 folds to ~C3, and the lowest present octave
    // reads as a C near 1046 Hz, not a G.
    expect(Math.abs(result.centsFromC)).toBeLessThan(30);
    expect(result.fundamentalHz).toBeGreaterThan(1000);
    expect(result.fundamentalHz).toBeLessThan(2200); // C6 or C7, not G7 (~3138)
    // C6 and C7 octaves both present — not a monotone.
    expect(octaveAt(result, 8).present).toBe(true);
    expect(octaveAt(result, 16).present).toBe(true);
    expect(result.octaveCount).toBeGreaterThanOrEqual(2);
  });

  it('exposes a clean off-C tone with plain harmonics as sharp and thin, not a full crow', () => {
    // Regression test (real-world case): a reed merely "speaking" one note at
    // ~1093 Hz with ordinary 2x/3x/4x harmonics registers octave bands at
    // 1x/2x/4x of that root, which used to read as "Excellent — three-octave
    // crow." The analysis must expose that it is neither rooted on a C (+75
    // cents sharp of C6) nor carrying real buzz, so the verdict can refuse to
    // call it excellent.
    const buf = makeWeightedBuffer([[1093, 1.0], [2186, 0.5], [3279, 0.3], [4372, 0.2]], 44100, 1);
    const result = analyzeRecording(buf);
    expect(result.octaveCount).toBeGreaterThanOrEqual(3);
    expect(Math.abs(result.centsFromC)).toBeGreaterThan(50);
    expect(result.harmonicCompleteness).toBeLessThan(0.15);
  });

  it('keeps a genuine in-tune buzzy crow distinguishable from the case above', () => {
    // Counterpart: a real harmonic series rooted right on C3 (so C6 lands
    // exactly in tune), rich enough to light up several octaves and a good
    // spread of the non-octave buzz between them — this is what "excellent"
    // should look like in the analysis data.
    const buf = makeHarmonicSeriesBuffer(130.8127826502993, 31, 44100, 1.5);
    const result = analyzeRecording(buf);
    expect(result.octaveCount).toBeGreaterThanOrEqual(3);
    expect(Math.abs(result.centsFromC)).toBeLessThanOrEqual(30);
    expect(result.harmonicCompleteness).toBeGreaterThanOrEqual(0.25);
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
    // The C-family octaves at n=4 (C5), 8 (C6), 16 (C7), 32 (C8) should all
    // be present — root*1, root*2, root*4, root*8 are exactly those.
    expect(octaveAt(result, 4).present).toBe(true);
    expect(octaveAt(result, 8).present).toBe(true);
    expect(octaveAt(result, 16).present).toBe(true);
    expect(octaveAt(result, 32).present).toBe(true);
    expect(result.octaveCount).toBe(4);
    // fundamentalHz should land near the true root, not a non-octave harmonic
    expect(result.fundamentalHz).toBeGreaterThan(500);
    expect(result.fundamentalHz).toBeLessThan(540);
    // root*3, *5, *6, *7 fall at non-octave n's relative to f0 and should
    // register as buzz.
    expect(result.harmonicCompleteness).toBeGreaterThan(0.1);
    // Regression: a too-wide search window can "steal" a neighboring
    // harmonic's peak instead of measuring its own — every present band's
    // measured hz should sit close to its own multiple of f0, not several
    // hundred Hz off toward an adjacent harmonic.
    for (const band of [...result.octaves, ...allBuzzHarmonics(result)]) {
      if (!band.present) continue;
      expect(Math.abs(band.hz - band.expectedHz) / band.expectedHz).toBeLessThan(0.05);
    }
  });

  it('reports low harmonic completeness for a clean crow with only the octaves', () => {
    const buf = makeMockAudioBuffer([1047, 2093], 44100, 1);
    const result = analyzeRecording(buf);
    expect(result.harmonicCompleteness).toBeLessThan(0.1);
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

  it('detects a crow that only sounds during part of the recording', () => {
    // Regression test (real-world case): the user held Record, then crowed for
    // only the last ~20% of the take (pre-roll silence before the crow). The
    // crow's octave bands were present in far fewer than half of ALL frames,
    // so the presence gate reported "No clear crow detected" even though the
    // spectrogram clearly showed strong C6/C7 bands. Analysis must isolate the
    // voiced region and judge presence against that, not the whole clip.
    const sampleRate = 44100;
    const duration = 5;
    const length = sampleRate * duration;
    const data = new Float32Array(length);
    let seed = 42;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return (seed / 0x7fffffff) * 2 - 1;
    };
    const root = 1047; // C6
    const crowStart = Math.floor(length * 0.8); // crow only in the last 20%
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      // faint breath/handling noise throughout
      let s = 0.01 * rand();
      if (i >= crowStart) {
        s +=
          1.0 * Math.sin(2 * Math.PI * root * t) +
          0.7 * Math.sin(2 * Math.PI * root * 2 * t) +
          0.4 * Math.sin(2 * Math.PI * root * 0.5 * t);
      }
      data[i] = s / 2.2;
    }
    const buf = {
      sampleRate, length, duration, numberOfChannels: 1, getChannelData: () => data
    } as unknown as AudioBuffer;
    const result = analyzeRecording(buf);
    expect(result.octaveCount).toBeGreaterThanOrEqual(2);
    expect(result.fundamentalHz).toBeGreaterThan(490);
    expect(result.fundamentalHz).toBeLessThan(1100);
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
    expect(result.virtualFundamentalHz).toBe(-1);
    expect(result.octaveCount).toBe(0);
    expect(result.missingLowerOctave).toBe(false);
    expect(result.missingUpperOctave).toBe(false);
    expect(result.pitchStability).toBe(0);
    expect(result.harmonicCompleteness).toBe(0);
  });
});

function makeAnalysis(overrides: Partial<RecordingAnalysis>): RecordingAnalysis {
  return {
    fundamentalHz: 1047,
    centsFromC: 0,
    pitchStability: 0.9,
    virtualFundamentalHz: 130.8,
    octaves: [],
    buzzBands: [],
    octaveCount: 3,
    missingLowerOctave: false,
    missingUpperOctave: false,
    harmonicCompleteness: 0.3,
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
    const ids = matchSymptoms(makeAnalysis({ octaveCount: 1 }));
    expect(ids).toContain('crow-one-wire');
  });

  it('matches crow-missing-lower-octave when the crow sits high with no C6 root', () => {
    const ids = matchSymptoms(makeAnalysis({ octaveCount: 2, missingLowerOctave: true }));
    expect(ids).toContain('crow-missing-lower-octave');
    expect(ids).not.toContain('crow-missing-upper-octave');
  });

  it('matches crow-missing-upper-octave for a rooted C6+C7 crow that lacks C8', () => {
    const ids = matchSymptoms(makeAnalysis({ octaveCount: 2, missingUpperOctave: true }));
    expect(ids).toContain('crow-missing-upper-octave');
    expect(ids).not.toContain('crow-missing-lower-octave');
  });

  it('does not flag either missing-octave symptom once a full three-octave crow is present', () => {
    const ids = matchSymptoms(makeAnalysis({ octaveCount: 3 }));
    expect(ids).not.toContain('crow-missing-lower-octave');
    expect(ids).not.toContain('crow-missing-upper-octave');
  });

  it('matches crow-thin for low harmonic completeness', () => {
    const ids = matchSymptoms(makeAnalysis({ harmonicCompleteness: 0.05 }));
    expect(ids).toContain('crow-thin');
  });

  it('does not match crow-thin for a normal, moderately buzzy crow', () => {
    const ids = matchSymptoms(makeAnalysis({ harmonicCompleteness: 0.3 }));
    expect(ids).not.toContain('crow-thin');
  });

  it('returns empty for a normal, full three-octave, stable, buzzy crow', () => {
    const ids = matchSymptoms(makeAnalysis({
      fundamentalHz: 1100, pitchStability: 0.9, octaveCount: 3, harmonicCompleteness: 0.3
    }));
    expect(ids.length).toBe(0);
  });
});
