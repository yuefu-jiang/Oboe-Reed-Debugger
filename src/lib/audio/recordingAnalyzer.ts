import { symptoms } from '$lib/data/symptoms';
import { detectPitch, nearestC } from '$lib/audio/pitchDetector';

const FRAME_SIZE = 4096;
const HOP_SIZE = 2048;
// How far a partial may drift from a perfect harmonic and still count as
// related, as a fraction of THAT BAND'S OWN target frequency — not a fixed Hz
// value derived from the fundamental. A fixed-Hz tolerance is fine in cents
// terms near the fundamental but balloons toward half an octave at the 0.5x
// band, wide enough to mistake a real but unrelated resonance (a wolf tone, a
// formant, an attack transient) for "the octave below." Scaling per-target
// keeps the cents tolerance roughly constant everywhere, and 6% still stays
// well under half the gap between the closest adjacent multiples (7x and 8x,
// ~229 cents apart), so it can't overlap into a neighboring band either.
const OCTAVE_TOL = 0.06;
const OCTAVE_STEP = 10;     // Hz — resolution of each narrow band search
const NOISE_FLOOR = 0.01;   // relative power below which a band reading is just noise
const MIN_SCAN_HZ = 150;
const MAX_SCAN_HZ = 6000;
const COARSE_STEP = 10;     // Hz — resolution for the one-time fundamental estimate; must stay fine
                            // enough that FUND_MATCH_TOL's narrow window always contains a sample
// Tolerance used when scoring candidate fundamentals against the harmonic
// series. Must stay tight: at a low candidate frequency, consecutive harmonic
// targets (f*k and f*(k+1)) are only f apart — a wide relative tolerance
// makes their match windows overlap and double-count the same real peak
// across multiple k's, artificially inflating low candidates' scores.
const FUND_MATCH_TOL = 0.03;

// A crow's octaves of C (1x, 2x, 4x, 8x the fundamental — the brightest bands)
const OCTAVE_MULTIPLES = [0.5, 1, 2, 4, 8];
// The natural, non-octave partials that fill in a genuinely buzzy crow (3rd,
// 5th, 6th, 7th harmonics — dimmer, and not C's, but real and expected).
const HARMONIC_MULTIPLES = [3, 5, 6, 7];
// Candidate divisors tried against the raw detected pitch when estimating the
// true fundamental — a rich harmonic signal can make a simple pitch detector
// lock onto *any* harmonic, not necessarily a C.
const FUNDAMENTAL_DIVISORS = [1, 2, 3, 4, 5, 6, 7, 8];

export interface HarmonicBand {
  multiple: number;    // multiple of the fundamental this band sits at
  expectedHz: number;  // where this band would sit, for labeling even when absent
  hz: number;          // measured Hz if present, else -1
  level: number;       // 0–1 — share of total power among all present bands (octaves + harmonics)
  present: boolean;
}

export interface RecordingAnalysis {
  fundamentalHz: number;        // the lowest confirmed C present (-1 if none)
  centsFromC: number;           // how far fundamentalHz sits from its nearest C, any octave (0 if absent)
  pitchStability: number;       // 0–1
  octaves: HarmonicBand[];      // the C-family bands (0.5x, 1x, 2x, 4x, 8x the fundamental), low to high
  harmonics: HarmonicBand[];    // the non-octave partials (3rd/5th/6th/7th), low to high
  octaveCount: number;         // how many octave bands are present
  hasLowerOctave: boolean;     // true if the 0.5x band is present
  harmonicCompleteness: number; // 0–1 — how many of the expected non-octave partials are present
}

// Goertzel: power at a single frequency
function goertzel(samples: Float32Array, targetHz: number, sampleRate: number): number {
  const N = samples.length;
  const k = Math.round(N * targetHz / sampleRate);
  const omega = 2 * Math.PI * k / N;
  const coeff = 2 * Math.cos(omega);
  let s1 = 0, s2 = 0;
  for (let n = 0; n < N; n++) {
    const s = (samples[n] ?? 0) + coeff * s1 - s2;
    s2 = s1; s1 = s;
  }
  return s1 * s1 + s2 * s2 - coeff * s1 * s2;
}

// A narrow scan + peak pick anchored on an already-known-good frequency — not
// a blind search across the whole spectrum, so it can't lock onto an
// unrelated peak elsewhere. Tolerance is an absolute Hz half-width, not a
// percentage of the target: consecutive harmonics are a fixed `fundamental`
// Hz apart regardless of how high the harmonic number is, so a
// percentage-of-target tolerance would grow with the target and eventually
// overlap into the neighboring harmonic's window at high multiples.
function findPeakNear(
  frame: Float32Array,
  sampleRate: number,
  targetHz: number,
  tolHz: number,
  step: number
): { hz: number; power: number } | null {
  const lo = targetHz - tolHz;
  const hi = targetHz + tolHz;
  let best: { hz: number; power: number } | null = null;
  for (let hz = lo; hz <= hi; hz += step) {
    const power = goertzel(frame, hz, sampleRate);
    if (!best || power > best.power) best = { hz, power };
  }
  return best;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function computeStability(pitches: number[]): number {
  if (pitches.length < 2) return 1;
  const mean = pitches.reduce((a, b) => a + b, 0) / pitches.length;
  const variance = pitches.reduce((a, b) => a + (b - mean) ** 2, 0) / pitches.length;
  return Math.max(0, 1 - Math.sqrt(variance) / 30);
}

// One coarse power spectrum, averaged over a handful of representative
// frames — cheap enough to run once, just to score candidate fundamentals.
function coarseSpectrum(frames: Float32Array[], sampleRate: number): { hz: number; power: number }[] {
  const sample = frames.length <= 5
    ? frames
    : [0, 0.25, 0.5, 0.75, 1].map(f => frames[Math.min(frames.length - 1, Math.round(f * (frames.length - 1)))]);
  const spectrum: { hz: number; power: number }[] = [];
  for (let hz = MIN_SCAN_HZ; hz <= MAX_SCAN_HZ; hz += COARSE_STEP) {
    let sum = 0;
    for (const f of sample) sum += goertzel(f, hz, sampleRate);
    spectrum.push({ hz, power: sum / sample.length });
  }
  return spectrum;
}

function powerNear(spectrum: { hz: number; power: number }[], targetHz: number, tolerance: number): number {
  let best = 0;
  for (const bin of spectrum) {
    if (Math.abs(bin.hz - targetHz) / targetHz <= tolerance) best = Math.max(best, bin.power);
  }
  return best;
}

// A rich, buzzy crow has energy at many simultaneous partials of a single
// fundamental — a simple per-frame pitch detector can lock onto *any* of
// them (an octave error can go either direction: it might land on a
// harmonic ABOVE the true fundamental, or on a spurious sub-harmonic BELOW
// it). Test the raw estimate along with simple multiples and divisions of it
// against the full harmonic series (1x through 8x) and pick whichever
// explains the most real, corroborated energy.
function estimateFundamental(rawMedianHz: number, spectrum: { hz: number; power: number }[]): number {
  const maxPower = spectrum.reduce((m, b) => Math.max(m, b.power), 1e-20);

  // A real fundamental should have some actual energy at its own frequency —
  // not just at a few of its harmonics. Without this, two entirely unrelated
  // real tones (e.g. 634 Hz and 1047 Hz) can share a low common divisor
  // (~209 Hz, since 209x3≈634 and 209x5≈1047) that "explains" both while
  // having zero real content at 209 Hz itself — a fabricated fundamental,
  // not a true one.
  function scoreOf(f: number): number | null {
    const ownPower = powerNear(spectrum, f, FUND_MATCH_TOL);
    if (ownPower < maxPower * 0.05) return null;
    let score = ownPower;
    for (let k = 2; k <= 8; k++) {
      const target = f * k;
      if (target > MAX_SCAN_HZ) break;
      score += powerNear(spectrum, target, FUND_MATCH_TOL);
    }
    return score;
  }

  const candidates: { f: number; score: number }[] = [];
  const baseScore = scoreOf(rawMedianHz);
  if (baseScore !== null) candidates.push({ f: rawMedianHz, score: baseScore });

  for (const d of FUNDAMENTAL_DIVISORS) {
    if (d === 1) continue;
    const fDown = rawMedianHz / d;
    if (fDown >= MIN_SCAN_HZ) {
      const score = scoreOf(fDown);
      if (score !== null) candidates.push({ f: fDown, score });
    }
    const fUp = rawMedianHz * d;
    if (fUp <= MAX_SCAN_HZ) {
      const score = scoreOf(fUp);
      if (score !== null) candidates.push({ f: fUp, score });
    }
  }

  if (candidates.length === 0) return rawMedianHz;

  // Prefer whichever candidate is corroborated by the most real harmonic
  // energy; among near-ties, prefer the lowest frequency (avoids a
  // gratuitous octave jump when the evidence doesn't clearly favor one).
  const maxScore = Math.max(...candidates.map(c => c.score));
  const viable = candidates.filter(c => c.score >= maxScore * 0.9).sort((a, b) => a.f - b.f);
  return viable[0].f;
}

function emptyBands(multiples: number[]): HarmonicBand[] {
  return multiples.map(m => ({ multiple: m, expectedHz: -1, hz: -1, level: 0, present: false }));
}

function absent(): RecordingAnalysis {
  return {
    fundamentalHz: -1, centsFromC: 0, pitchStability: 0,
    octaves: emptyBands(OCTAVE_MULTIPLES), harmonics: emptyBands(HARMONIC_MULTIPLES),
    octaveCount: 0, hasLowerOctave: false, harmonicCompleteness: 0
  };
}

export function analyzeRecording(audioBuffer: AudioBuffer): RecordingAnalysis {
  const data = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  let rms = 0;
  for (let i = 0; i < data.length; i++) rms += data[i] ** 2;
  rms = Math.sqrt(rms / data.length);
  if (rms < 0.005) return absent();

  const frames: Float32Array[] = [];
  const pitches: number[] = [];
  for (let offset = 0; offset + FRAME_SIZE <= data.length; offset += HOP_SIZE) {
    const frame = data.slice(offset, offset + FRAME_SIZE);
    frames.push(frame);
    const hz = detectPitch(frame, sampleRate);
    if (hz > 0) pitches.push(hz);
  }

  if (pitches.length === 0) return absent();

  const rawMedianHz = median(pitches);
  const pitchStability = computeStability(pitches);

  // Correct the raw per-frame pitch estimate against the full harmonic series
  // before doing anything else — everything downstream (octave bands, the
  // non-octave harmonics, and the reported fundamental) is derived from this
  // single, harmonic-series-verified value, not the raw detector output.
  const spectrum = coarseSpectrum(frames, sampleRate);
  const fundamentalEstimate = estimateFundamental(rawMedianHz, spectrum);

  const allMultiples = [...OCTAVE_MULTIPLES, ...HARMONIC_MULTIPLES];
  const targets = allMultiples
    .map(m => ({ m, hz: fundamentalEstimate * m }))
    .filter(t => t.hz >= MIN_SCAN_HZ && t.hz <= MAX_SCAN_HZ);

  const bandHits: Record<number, { hz: number; power: number }[]> = {};
  for (const m of allMultiples) bandHits[m] = [];

  for (const frame of frames) {
    for (const { m, hz: target } of targets) {
      const peak = findPeakNear(frame, sampleRate, target, target * OCTAVE_TOL, OCTAVE_STEP);
      if (peak) bandHits[m].push(peak);
    }
  }

  const rawPower: Record<number, number> = {};
  const rawHz: Record<number, number> = {};
  for (const m of allMultiples) {
    const hits = bandHits[m];
    rawPower[m] = hits.length > 0 ? median(hits.map(h => h.power)) : 0;
    rawHz[m] = hits.length > 0 ? median(hits.map(h => h.hz)) : -1;
  }
  const totalPower = allMultiples.reduce((sum, m) => sum + rawPower[m], 0) + 1e-20;

  const makeBand = (m: number): HarmonicBand => {
    const level = rawPower[m] / totalPower;
    // A band is "present" if it was consistently found across frames and
    // carries at least a sliver of real energy — NOISE_FLOOR only exists to
    // reject spectral-leakage noise, not a genuine-but-quiet partial.
    const present = bandHits[m].length >= frames.length / 2 && level > NOISE_FLOOR;
    return {
      multiple: m,
      expectedHz: fundamentalEstimate * m,
      hz: present ? rawHz[m] : -1,
      level: present ? level : 0,
      present
    };
  };

  const octaves = OCTAVE_MULTIPLES.map(makeBand);
  const harmonics = HARMONIC_MULTIPLES.map(makeBand);

  const presentOctaves = octaves.filter(o => o.present);
  const octaveCount = presentOctaves.length;
  const hasLowerOctave = octaves.find(o => o.multiple === 0.5)?.present ?? false;

  // Report the verified root (from estimateFundamental) as the crow's
  // fundamental — not just "whichever octave band happens to be lowest."
  // A lower band can register as "present" from a real but unrelated
  // resonance falling inside its tolerance window; that shouldn't be able to
  // override a fundamental that was already corroborated against the full
  // harmonic series.
  const rootBand = octaves.find(o => o.multiple === 1)!;
  const fundamentalHz = rootBand.present ? rootBand.hz : fundamentalEstimate;

  const harmonicCompleteness = harmonics.filter(h => h.present).length / HARMONIC_MULTIPLES.length;

  // A crow rooted on any octave of C counts as in tune — what matters is how
  // far it drifts from the *nearest* C, not whether it happens to be C6.
  const centsFromC = fundamentalHz > 0 ? nearestC(fundamentalHz).cents : 0;

  return { fundamentalHz, centsFromC, pitchStability, octaves, harmonics, octaveCount, hasLowerOctave, harmonicCompleteness };
}

export function matchSymptoms(analysis: RecordingAnalysis): string[] {
  const matched: string[] = [];
  for (const symptom of symptoms) {
    if (!symptom.matchConditions) continue;
    const c = symptom.matchConditions;
    let match = true;
    if (c.flatBeyondCents !== undefined) {
      if (analysis.fundamentalHz < 0 || analysis.centsFromC > -c.flatBeyondCents) match = false;
    }
    if (c.sharpBeyondCents !== undefined) {
      if (analysis.fundamentalHz < 0 || analysis.centsFromC < c.sharpBeyondCents) match = false;
    }
    if (c.stabilityBelow !== undefined) {
      if (analysis.pitchStability >= c.stabilityBelow) match = false;
    }
    if (c.monotoneCrow) {
      if (analysis.octaveCount !== 1) match = false;
    }
    if (c.missingLowerOctave) {
      if (analysis.hasLowerOctave || analysis.octaveCount === 0 || analysis.octaveCount >= 3) match = false;
    }
    if (c.completenessBelow !== undefined) {
      if (analysis.harmonicCompleteness >= c.completenessBelow) match = false;
    }
    if (match) matched.push(symptom.id);
  }
  return matched;
}
