import { symptoms } from '$lib/data/symptoms';
import { detectPitch, nearestC } from '$lib/audio/pitchDetector';

const FRAME_SIZE = 4096;
const HOP_SIZE = 2048;
// How far a partial may drift from a perfect harmonic and still count as
// related, as a fraction of THAT BAND'S OWN target frequency — not a fixed Hz
// value. Octave bands are always a full doubling apart, so a target-relative
// tolerance can never overlap into a neighbor even at 6%.
const OCTAVE_TOL = 0.06;
const OCTAVE_STEP = 6;     // Hz — resolution of each narrow band search
const NOISE_FLOOR = 0.01;   // relative power below which a band reading is just noise
// A frame counts as "voiced" (part of the actual crow) if its RMS is at least
// this fraction of the loudest frame's — enough to exclude silence, breath,
// and handling noise before/after the crow, low enough to keep the quieter
// sustain and decay of a real crow.
const VOICED_RMS_FRACTION = 0.25;
// Lowered from 150 so the virtual fundamental's own octave (C3, ~130.8Hz,
// which can fold as low as ~92.5Hz for a flat root) is still scannable.
const MIN_SCAN_HZ = 90;
const MAX_SCAN_HZ = 6000;
const COARSE_STEP = 10;     // Hz — resolution for the one-time fundamental estimate; must stay fine
                            // enough that FUND_MATCH_TOL's narrow window always contains a sample
// Tolerance used when scoring candidate fundamentals against the harmonic
// series. Must stay tight: at a low candidate frequency, consecutive harmonic
// targets (f*k and f*(k+1)) are only f apart — a wide relative tolerance
// makes their match windows overlap and double-count the same real peak
// across multiple k's, artificially inflating low candidates' scores.
const FUND_MATCH_TOL = 0.03;

// A440-based C3 — the octave every reed's crow ultimately folds down to as
// its virtual fundamental (see below).
const C3_HZ = 130.8127826502993;

// Buzz-harmonic match tolerance, as an ABSOLUTE fraction of the virtual
// fundamental f0 — NOT of each harmonic's own target frequency. Adjacent
// integer harmonics (n and n+1) are always exactly f0 apart in Hz, no matter
// how high n climbs, so a percentage-of-target tolerance would keep growing
// with n and eventually swallow the neighboring harmonic's window. A fixed
// fraction of f0 keeps the window width constant everywhere; 0.15 leaves
// wide margin under the fixed 1.0x f0 spacing between neighbors.
// Wide enough that a small f0 error (or real reed inharmonicity), which
// accumulates as n·δ, still lands the high buzz partials (n up to 31) inside
// the search window — but comfortably under the half-harmonic spacing (0.5·f0)
// so a target can't reach into its neighbour's slot.
const BUZZ_TOL_FRACTION = 0.33;
// A buzz partial counts as present when it stands at least this many times
// above the recording's genuine quiet floor (a low percentile of the whole
// spectrum, i.e. the breath/room-noise level between and beyond the partials).
// This is the PDF's An > alpha with alpha set to the real noise floor — so a
// densely buzzy crow, where every slot carries real energy, correctly reads as
// full rather than being penalised for lacking silent gaps.
const BUZZ_SNR = 3;
// Half-width of the window used to estimate the LOCAL noise floor around each
// buzz target (see localNoiseFloor). Wide enough to span a couple of harmonic
// spacings and their troughs so the percentile lands on real between-partial
// noise, narrow enough that the floor still tracks the loud skirt of a nearby
// tone rather than being dragged down by a distant quiet region.
const BUZZ_FLOOR_WIN_HZ = 250;
// Percentile of that local window treated as the noise floor.
const BUZZ_NOISE_PERCENTILE = 0.25;
// An absolute backstop, as a fraction of the spectrum's peak power, so the
// local-SNR test can't fire on pure numerical noise in a genuinely silent
// region (where the local floor is ~0 and any ratio is meaningless). Empirically
// the worst-case leakage at a buzz target beside a strong tone is ~0.16% of
// peak; 0.2% clears that while still admitting faint real partials.
const BUZZ_ABS_MIN = 0.002;
// A gentle local-prominence guard: the partial must still be a local maximum,
// at least this far above the troughs halfway to its neighbours. Its job is to
// reject the smooth spectral-leakage skirt of a nearby dominant tone (which
// rises monotonically toward that tone, not into a local peak) — kept mild so
// it doesn't punish genuinely dense buzz.
const BUZZ_PROMINENCE = 1.3;
// How much of the loud crow's steady core (frames at least this fraction of the
// peak frame's RMS) is used to build the denoised spectrum. Higher than the
// voiced threshold used for pitch: the spectrum wants the cleanest, strongest,
// most stationary part of the crow, not its quiet attack/decay or breath tails.
const CROW_CORE_FRACTION = 0.5;
// Cap on frames averaged into the coarse spectrum — enough to denoise well,
// bounded so a long recording doesn't blow up the one-time analysis cost.
const MAX_SPECTRUM_FRAMES = 24;

// Candidate divisors tried against the raw detected pitch when estimating the
// true root — a rich harmonic signal can make a simple pitch detector lock
// onto *any* harmonic, not necessarily a C.
const FUNDAMENTAL_DIVISORS = [1, 2, 3, 4, 5, 6, 7, 8];

// The octave set O: powers-of-2 harmonics of the virtual fundamental f0 —
// n = 2^j. The full series runs C3 (j=0) to C8 (j=5), but an American-scrape
// oboe crow lives in C5..C8: the C3/C4 octaves essentially never sound, so we
// neither scan for nor display them. C6 (j=3) is the usual root of the crow.
const C6_J = 3;
const C8_J = 5;
const OCTAVE_J_RANGE = [2, 3, 4, 5]; // C5, C6, C7, C8
// Buzz is computed per octave span, from C5->C6 (j=2) up through C7->C8 (j=4),
// matching the displayed octave range above.
const MIN_BUZZ_J = 2;
const MAX_BUZZ_J = 4;

export interface HarmonicBand {
  multiple: number;    // harmonic number n, relative to the virtual fundamental f0
  expectedHz: number;  // where this band would sit, for labeling even when absent
  hz: number;          // measured Hz if present, else -1
  level: number;       // 0–1 — share of total power among all present bands (octaves + buzz)
  present: boolean;
}

// One octave span's non-octave ("buzz") harmonics — the PDF's B_j.
export interface BuzzBand {
  octaveIndex: number;      // j — this band spans f0*2^j .. f0*2^(j+1)
  lowHz: number;            // f0*2^j
  highHz: number;           // f0*2^(j+1)
  harmonics: HarmonicBand[]; // the n's strictly between 2^j and 2^(j+1)
  richness: number;         // 0–1 fill ratio — the PDF's R_j
}

export interface RecordingAnalysis {
  fundamentalHz: number;        // the lowest confirmed C present (-1 if none)
  centsFromC: number;           // how far fundamentalHz sits from its nearest C, any octave (0 if absent)
  pitchStability: number;       // 0–1
  virtualFundamentalHz: number; // f0 — the harmonic series' true root, folded to the C3 octave (-1 if absent)
  octaves: HarmonicBand[];      // the C-family bands (C5..C8, n = 4,8,16,32), low to high
  buzzBands: BuzzBand[];        // non-octave harmonics, grouped per octave span
  octaveCount: number;          // how many octave bands are present
  missingLowerOctave: boolean;  // true = the stack sits high (C7+), with no C6 root — tends sharp/stuffy
  missingUpperOctave: boolean;  // true = rooted (C6 or lower present) but doesn't reach the top C8
  harmonicCompleteness: number; // 0–1 — present buzz harmonics / total buzz harmonics across all bands
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
// unrelated peak elsewhere.
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

// One coarse power spectrum, averaged over many frames of the crow's steady
// core (Welch's method). Averaging is itself a denoise: the broadband
// breath/room noise is incoherent frame-to-frame and averages down toward its
// mean, while the steady harmonic peaks stay put — so real buzz partials stand
// out far more clearly than in any single frame or a 5-frame sample. Used both
// to score candidate fundamentals and as the lookup table for buzz presence.
function coarseSpectrum(frames: Float32Array[], sampleRate: number): { hz: number; power: number }[] {
  const sample = frames.length <= MAX_SPECTRUM_FRAMES
    ? frames
    : Array.from({ length: MAX_SPECTRUM_FRAMES }, (_, i) =>
        frames[Math.round((i / (MAX_SPECTRUM_FRAMES - 1)) * (frames.length - 1))]);
  const spectrum: { hz: number; power: number }[] = [];
  for (let hz = MIN_SCAN_HZ; hz <= MAX_SCAN_HZ; hz += COARSE_STEP) {
    let sum = 0;
    for (const f of sample) sum += goertzel(f, hz, sampleRate);
    spectrum.push({ hz, power: sample.length ? sum / sample.length : 0 });
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

// Like powerNear, but returns the actual best-matching bin (hz + power)
// rather than just the power — and takes an ABSOLUTE Hz tolerance instead of
// a relative one, since buzz harmonics need a constant window width (see
// BUZZ_TOL_FRACTION above).
function coarsePeakNear(
  spectrum: { hz: number; power: number }[],
  targetHz: number,
  tolHz: number
): { hz: number; power: number } | null {
  let best: { hz: number; power: number } | null = null;
  for (const bin of spectrum) {
    if (Math.abs(bin.hz - targetHz) <= tolHz) {
      if (!best || bin.power > best.power) best = bin;
    }
  }
  return best;
}

// The quietest reading in a window — the local "floor" between harmonics.
function coarseFloorNear(
  spectrum: { hz: number; power: number }[],
  targetHz: number,
  tolHz: number
): number {
  let min = Infinity;
  for (const bin of spectrum) {
    if (Math.abs(bin.hz - targetHz) <= tolHz) min = Math.min(min, bin.power);
  }
  return min === Infinity ? 0 : min;
}

// A LOCAL noise-floor estimate around a target frequency: the p-th percentile
// of the spectrum within ±halfWinHz. Local, not global, because the crow spans
// an enormous dynamic range — the fundamental (or a bright 3rd harmonic) can be
// hundreds of times louder than a real buzz line elsewhere, so a single global
// floor is meaningless. A rolling low percentile tracks the broadband floor
// (breath noise, plus the leakage skirt of any nearby loud tone) while ignoring
// the discrete peaks, so a buzz partial is judged against the noise *right
// where it sits*: faint partials in a quiet region still stand out, while the
// leakage ripples beside a loud tone are measured against that tone's own
// elevated skirt and correctly rejected.
function localNoiseFloor(
  spectrum: { hz: number; power: number }[],
  targetHz: number,
  halfWinHz: number,
  p: number
): number {
  const vals: number[] = [];
  for (const b of spectrum) if (Math.abs(b.hz - targetHz) <= halfWinHz) vals.push(b.power);
  if (vals.length === 0) return 0;
  vals.sort((a, b) => a - b);
  return vals[Math.min(vals.length - 1, Math.max(0, Math.floor(p * vals.length)))];
}

// The strongest single bin in the coarse spectrum — the most prominent band
// the recording actually contains.
function strongestBinHz(spectrum: { hz: number; power: number }[]): number {
  let best = spectrum[0];
  for (const bin of spectrum) {
    if (bin.power > best.power) best = bin;
  }
  return best.hz;
}

// A rich, buzzy crow has energy at many simultaneous partials of a single
// fundamental — a simple per-frame pitch detector can lock onto *any* of
// them (an octave error can go either direction: it might land on a
// harmonic ABOVE the true fundamental, or on a spurious sub-harmonic BELOW
// it). Candidate roots are derived from every anchor supplied — the
// autocorrelation median AND the most prominent spectral peak — so even when
// the time-domain detector locks somewhere unrelated, the brightest real
// band still gets a vote. Each anchor contributes itself plus its simple
// multiples and divisions (1x–8x in both directions); whichever candidate
// explains the most real, corroborated energy wins.
function estimateFundamental(anchors: number[], spectrum: { hz: number; power: number }[]): number {
  const maxPower = spectrum.reduce((m, b) => Math.max(m, b.power), 1e-20);

  // A candidate is a plausible fundamental if it EITHER carries strong energy
  // at its own frequency (a genuine monotone tone) OR clearly heads a harmonic
  // series (real energy at its octave, 2f). The second clause is essential for
  // oboe crows: the acoustic fundamental is often weak or nearly absent while
  // the upper partials dominate — the 3rd harmonic (a twelfth up, e.g. G7 over
  // a C6 root) can be the single loudest band. A pure own-power gate would
  // then disqualify the true C root and hand the crown to that loud childless
  // partial, folding the whole grid onto the wrong pitch class.
  //
  // Both clauses together still reject fabricated fundamentals: two unrelated
  // real tones (e.g. 634 and 1047) share a low common divisor (~209, since
  // 209x3≈634 and 209x5≈1047), but 209 has neither real own energy NOR real
  // energy at its octave (418) — so it fails both and is thrown out.
  function scoreOf(f: number): number | null {
    const ownPower = powerNear(spectrum, f, FUND_MATCH_TOL);
    const octaveHz = f * 2;
    const octavePower = octaveHz <= MAX_SCAN_HZ ? powerNear(spectrum, octaveHz, FUND_MATCH_TOL) : 0;
    const strongSelf = ownPower >= maxPower * 0.05;
    const headsSeries = octavePower >= maxPower * 0.03;
    if (!strongSelf && !headsSeries) return null;
    // Score is the total real energy the candidate's harmonic series explains,
    // so a candidate that heads a rich stack (the true root) beats a loud but
    // childless upper partial even when that partial is far louder in isolation.
    let score = ownPower;
    for (let k = 2; k <= 8; k++) {
      const target = f * k;
      if (target > MAX_SCAN_HZ) break;
      score += powerNear(spectrum, target, FUND_MATCH_TOL);
    }
    return score;
  }

  const candidates: { f: number; score: number }[] = [];
  const considered: number[] = [];
  function consider(f: number) {
    if (f < MIN_SCAN_HZ || f > MAX_SCAN_HZ) return;
    if (considered.some(c => Math.abs(c - f) / f < 0.02)) return; // near-duplicate across anchors
    considered.push(f);
    const score = scoreOf(f);
    if (score !== null) candidates.push({ f, score });
  }

  for (const anchor of anchors) {
    for (const d of FUNDAMENTAL_DIVISORS) {
      consider(anchor / d);
      consider(anchor * d);
    }
  }

  if (candidates.length === 0) return anchors[0];

  // Prefer whichever candidate is corroborated by the most real harmonic
  // energy; among near-ties, prefer the lowest frequency (avoids a
  // gratuitous octave jump when the evidence doesn't clearly favor one).
  const maxScore = Math.max(...candidates.map(c => c.score));
  const viable = candidates.filter(c => c.score >= maxScore * 0.9).sort((a, b) => a.f - b.f);
  return viable[0].f;
}

// The virtual fundamental f0: fold the verified root down (or up) by whole
// octaves until it lands in the C3 neighborhood. Every harmonic in the
// crow's series — the C's and the buzz between them — descends from this
// single reference, inheriting whatever flat/sharp offset the root itself
// carries (a reed that crows 75 cents sharp should have a *consistently*
// sharp harmonic series, not one snapped back to exact pitch).
function computeVirtualFundamental(rootHz: number): number {
  const k = Math.round(Math.log2(rootHz / C3_HZ));
  return rootHz / 2 ** k;
}

function emptyOctaves(): HarmonicBand[] {
  return OCTAVE_J_RANGE.map(j => ({ multiple: 2 ** j, expectedHz: -1, hz: -1, level: 0, present: false }));
}

function buzzNs(j: number): number[] {
  const lowN = 2 ** j, highN = 2 ** (j + 1);
  const ns: number[] = [];
  for (let n = lowN + 1; n < highN; n++) ns.push(n);
  return ns;
}

function emptyBuzzBands(): BuzzBand[] {
  const bands: BuzzBand[] = [];
  for (let j = MIN_BUZZ_J; j <= MAX_BUZZ_J; j++) {
    const ns = buzzNs(j);
    if (ns.length === 0) continue;
    bands.push({
      octaveIndex: j, lowHz: -1, highHz: -1,
      harmonics: ns.map(n => ({ multiple: n, expectedHz: -1, hz: -1, level: 0, present: false })),
      richness: 0
    });
  }
  return bands;
}

function absent(): RecordingAnalysis {
  return {
    fundamentalHz: -1, centsFromC: 0, pitchStability: 0, virtualFundamentalHz: -1,
    octaves: emptyOctaves(), buzzBands: emptyBuzzBands(),
    octaveCount: 0, missingLowerOctave: false, missingUpperOctave: false, harmonicCompleteness: 0
  };
}

export function analyzeRecording(audioBuffer: AudioBuffer): RecordingAnalysis {
  const data = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  let rms = 0;
  for (let i = 0; i < data.length; i++) rms += data[i] ** 2;
  rms = Math.sqrt(rms / data.length);
  if (rms < 0.005) return absent();

  // Slice into frames, keeping each frame's own RMS so we can isolate the
  // part of the recording where the reed is actually crowing. A real crow is
  // usually a short burst preceded/followed by silence, breath, or handling
  // noise; if we analyzed the whole clip we'd (a) fail the "present in half
  // the frames" gate on a crow that only sounds for a fraction of the take,
  // and (b) dilute the coarse spectrum with silent frames, washing out the
  // very partials we're trying to measure.
  const allFrames: { frame: Float32Array; rms: number }[] = [];
  for (let offset = 0; offset + FRAME_SIZE <= data.length; offset += HOP_SIZE) {
    const frame = data.slice(offset, offset + FRAME_SIZE);
    let e = 0;
    for (let i = 0; i < frame.length; i++) e += frame[i] ** 2;
    allFrames.push({ frame, rms: Math.sqrt(e / frame.length) });
  }

  if (allFrames.length === 0) return absent();

  // Keep only the "voiced" frames — those carrying a real fraction of the
  // loudest frame's energy. Everything downstream (pitch, spectrum, band
  // presence) runs on this active region alone, so the presence gates below
  // count against how long the crow *actually sounded*, not how long the
  // record button happened to be held.
  const peakRms = allFrames.reduce((m, f) => Math.max(m, f.rms), 0);
  const voicedThreshold = Math.max(peakRms * VOICED_RMS_FRACTION, 0.005);
  const frames = allFrames.filter(f => f.rms >= voicedThreshold).map(f => f.frame);

  if (frames.length === 0) return absent();

  const pitches: number[] = [];
  for (const frame of frames) {
    const hz = detectPitch(frame, sampleRate);
    if (hz > 0) pitches.push(hz);
  }

  if (pitches.length === 0) return absent();

  const rawMedianHz = median(pitches);
  const pitchStability = computeStability(pitches);

  // For the spectrum used to score fundamentals and detect buzz, cut down
  // further to the crow's loud, steady CORE — the frames well above the peak,
  // not the quiet attack, decay, or breath tails that survive the looser
  // voiced gate. Averaging that cleaner, stronger material (Welch's method in
  // coarseSpectrum) is a real denoise: it drops the broadband noise floor and
  // lets faint-but-genuine buzz partials clear the presence test. Fall back to
  // the full voiced set if the core is too small to average meaningfully.
  const coreThreshold = Math.max(peakRms * CROW_CORE_FRACTION, voicedThreshold);
  const coreFrames = allFrames.filter(f => f.rms >= coreThreshold).map(f => f.frame);
  const spectrumFrames = coreFrames.length >= 4 ? coreFrames : frames;

  // Correct the raw per-frame pitch estimate against the full harmonic series
  // before doing anything else. The most prominent spectral band is a second,
  // independent anchor so the estimate can never wander off to something the
  // autocorrelation detector hallucinated while the recording's brightest
  // band goes unexplained.
  const spectrum = coarseSpectrum(spectrumFrames, sampleRate);
  const dominantHz = strongestBinHz(spectrum);
  const fundamentalEstimate = estimateFundamental([rawMedianHz, dominantHz], spectrum);

  // Everything below is one harmonic series descending from a single virtual
  // fundamental f0 (~C3) — not small fixed multiples of whatever root got
  // detected. The octaves (the C's) are its powers-of-2 harmonics; the buzz
  // is everything else, naturally including the acoustically real detuned
  // partials (e.g. the flat natural 7th, 11th, 13th) that a fixed [3,5,6,7]
  // model could never represent once the root climbed above C6.
  const f0 = computeVirtualFundamental(fundamentalEstimate);

  // --- Octave bands (the C's): per-frame narrow search for precise Hz
  // readings, anchored to f0's fixed C5..C8 series (the sounding range of an
  // oboe crow) rather than a window relative to the raw root. ---
  const octaveTargets = OCTAVE_J_RANGE
    .map(j => ({ j, n: 2 ** j, hz: f0 * 2 ** j }))
    .filter(t => t.hz >= MIN_SCAN_HZ && t.hz <= MAX_SCAN_HZ);

  const octaveHits: Record<number, { hz: number; power: number }[]> = {};
  for (const t of octaveTargets) octaveHits[t.n] = [];

  for (const frame of frames) {
    for (const t of octaveTargets) {
      const peak = findPeakNear(frame, sampleRate, t.hz, t.hz * OCTAVE_TOL, OCTAVE_STEP);
      if (peak) octaveHits[t.n].push(peak);
    }
  }

  const octaveRawPower: Record<number, number> = {};
  const octaveRawHz: Record<number, number> = {};
  for (const t of octaveTargets) {
    const hits = octaveHits[t.n];
    octaveRawPower[t.n] = hits.length > 0 ? median(hits.map(h => h.power)) : 0;
    octaveRawHz[t.n] = hits.length > 0 ? median(hits.map(h => h.hz)) : -1;
  }

  // --- Buzz harmonics: cheap lookup against the already-computed coarse
  // spectrum (the PDF's amplitude threshold An > alpha), grouped per octave
  // span so each band's fill ratio (R_j) can be read off independently.
  //
  // A partial counts as present when it stands well above the LOCAL noise
  // floor right where it sits (see localNoiseFloor), not against the global
  // maximum. The fundamental (or a bright 3rd harmonic) dominates the whole
  // spectrum — a buzz partial at 10% of its amplitude is only 1% of its
  // *power* — so a fraction-of-max floor would reject partials that are plainly
  // there, and a strict prominence test would perversely punish the RICHEST
  // crows (whose buzz regions are so full of energy there are barely any gaps
  // to stick up out of). Judging each partial against its own neighbourhood's
  // noise handles the huge dynamic range; a mild prominence check and a tiny
  // absolute backstop only guard against leakage and pure numerical noise. ---
  const buzzTolHz = f0 * BUZZ_TOL_FRACTION;
  const gapHz = f0 * 0.5;             // distance to the between-harmonics troughs
  const gapTolHz = f0 * 0.1;          // narrow window at each trough
  const maxCoarsePower = spectrum.reduce((m, b) => Math.max(m, b.power), 1e-20);
  const absBackstop = maxCoarsePower * BUZZ_ABS_MIN;

  const buzzBands: BuzzBand[] = [];
  for (let j = MIN_BUZZ_J; j <= MAX_BUZZ_J; j++) {
    const ns = buzzNs(j);
    if (ns.length === 0) continue;
    const lowHz = f0 * 2 ** j, highHz = f0 * 2 ** (j + 1);

    const harmonics: HarmonicBand[] = ns.map(n => {
      const targetHz = f0 * n;
      if (targetHz < MIN_SCAN_HZ || targetHz > MAX_SCAN_HZ) {
        return { multiple: n, expectedHz: targetHz, hz: -1, level: 0, present: false };
      }
      const peak = coarsePeakNear(spectrum, targetHz, buzzTolHz);
      // Presence: clears the LOCAL noise floor (with an absolute backstop for
      // silent regions) AND is a genuine local maximum. The prominence floor is
      // the lower of the two troughs halfway to the neighbours; taking the
      // minimum avoids a neighbouring band's skirt (e.g. the loud fundamental
      // just below the first buzz partial) poisoning the estimate.
      const noiseFloor = localNoiseFloor(spectrum, targetHz, BUZZ_FLOOR_WIN_HZ, BUZZ_NOISE_PERCENTILE);
      const troughL = coarseFloorNear(spectrum, targetHz - gapHz, gapTolHz);
      const troughR = coarseFloorNear(spectrum, targetHz + gapHz, gapTolHz);
      const floor = Math.min(troughL, troughR);
      const aboveNoise = !!peak && peak.power >= Math.max(noiseFloor * BUZZ_SNR, absBackstop);
      const prominent = !!peak && peak.power >= floor * BUZZ_PROMINENCE;
      const present = aboveNoise && prominent;
      return {
        multiple: n,
        expectedHz: targetHz,
        hz: present ? peak!.hz : -1,
        level: present ? peak!.power : 0, // renormalized against totalPower below
        present
      };
    });

    const richness = harmonics.filter(h => h.present).length / harmonics.length;
    buzzBands.push({ octaveIndex: j, lowHz, highHz, harmonics, richness });
  }

  let totalPower = 1e-20;
  for (const t of octaveTargets) totalPower += octaveRawPower[t.n];
  for (const band of buzzBands) for (const h of band.harmonics) if (h.present) totalPower += h.level;

  const octaves: HarmonicBand[] = OCTAVE_J_RANGE.map(j => {
    const n = 2 ** j;
    const target = octaveTargets.find(t => t.n === n);
    if (!target) return { multiple: n, expectedHz: f0 * n, hz: -1, level: 0, present: false };
    const power = octaveRawPower[n] ?? 0;
    const level = power / totalPower;
    // A band is "present" if it was consistently found across frames and
    // carries at least a sliver of real energy — NOISE_FLOOR only exists to
    // reject spectral-leakage noise, not a genuine-but-quiet partial.
    const present = (octaveHits[n]?.length ?? 0) >= frames.length / 2 && level > NOISE_FLOOR;
    return {
      multiple: n,
      expectedHz: target.hz,
      hz: present ? octaveRawHz[n] : -1,
      level: present ? level : 0,
      present
    };
  });

  for (const band of buzzBands) {
    for (const h of band.harmonics) {
      if (h.present) h.level = h.level / totalPower;
    }
  }

  const presentOctaves = octaves.filter(o => o.present);
  const octaveCount = presentOctaves.length;

  // Describe the gap in the octave stack by DIRECTION, anchored on C6 being the
  // usual root of an oboe crow and C8 the top. A crow sitting high (C7/C8 with
  // no C6) is genuinely missing its lower octave — it tends sharp and stuffy.
  // A rooted crow that just doesn't reach C8 (e.g. C6+C7) is missing the UPPER
  // octave, which is a much milder thing — not the same diagnosis at all.
  const presentJs = presentOctaves.map(o => Math.round(Math.log2(o.multiple)));
  const lowestJ = presentJs.length ? Math.min(...presentJs) : -1;
  const highestJ = presentJs.length ? Math.max(...presentJs) : -1;
  const missingLowerOctave = octaveCount >= 2 && lowestJ > C6_J;
  const missingUpperOctave = octaveCount >= 2 && lowestJ <= C6_J && highestJ < C8_J;

  const lowestOctave = presentOctaves.reduce<HarmonicBand | null>(
    (lowest, o) => (!lowest || o.multiple < lowest.multiple ? o : lowest),
    null
  );
  const fundamentalHz = lowestOctave ? lowestOctave.hz : fundamentalEstimate;

  const totalBuzzHarmonics = buzzBands.reduce((s, b) => s + b.harmonics.length, 0);
  const presentBuzzHarmonics = buzzBands.reduce((s, b) => s + b.harmonics.filter(h => h.present).length, 0);
  const harmonicCompleteness = totalBuzzHarmonics > 0 ? presentBuzzHarmonics / totalBuzzHarmonics : 0;

  // A crow rooted on any octave of C counts as in tune — what matters is how
  // far it drifts from the *nearest* C, not whether it happens to be C6.
  const centsFromC = fundamentalHz > 0 ? nearestC(fundamentalHz).cents : 0;

  return {
    fundamentalHz, centsFromC, pitchStability, virtualFundamentalHz: f0,
    octaves, buzzBands, octaveCount, missingLowerOctave, missingUpperOctave, harmonicCompleteness
  };
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
      if (!analysis.missingLowerOctave) match = false;
    }
    if (c.missingUpperOctave) {
      if (!analysis.missingUpperOctave) match = false;
    }
    if (c.completenessBelow !== undefined) {
      if (analysis.harmonicCompleteness >= c.completenessBelow) match = false;
    }
    if (match) matched.push(symptom.id);
  }
  return matched;
}
