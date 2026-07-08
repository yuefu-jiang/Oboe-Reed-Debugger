# Oboe Reed Debugger

Deployed at: https://d22cp4mfgru8r5.cloudfront.net

A client-side web app that helps oboe players diagnose problems with American-scrape reeds by analyzing the reed's **crow** — the raw sound it makes blown alone, without the instrument. All audio processing happens in the browser; no audio is ever uploaded anywhere.

## What it does

A well-made reed crows as a stack of octaves of "C" (per standard reed-adjustment practice) plus a natural ladder of non-octave harmonics that give it a buzzy, reedy character. This app records that crow, figures out which C's and which harmonics are actually present, and cross-references the pattern against a symptom database to suggest likely causes and fixes — region-by-region (tip / heart / back / spine / rails / blend).

Four views, tied together by a shared audio pipeline:

- **Tuner** — real-time pitch readout (note + cents) and a live scrolling, log-frequency spectrogram (Merlin-style), 200Hz–5kHz.
- **Reed Analysis** — record a crow, see a static spectrogram of it (hover to read off frequency at any point), and get a structured breakdown: which octaves of C are present, which non-octave harmonics are present, overall crow quality, and pitch stability — plus matched entries from the symptom guide.
- **Metronome** — free-entry tempo (20–300 BPM) and a beats-per-measure dropdown, for practicing reed response and articulation against a steady click.
- **Guide** — the full symptom database, browsable by category (crow / response / pitch / tone / endurance).

## Architecture

```
Mic ──▶ getUserMedia ──▶ AudioContext ──▶ AnalyserNode (fftSize 8192)
                                              │
                              ┌───────────────┴───────────────┐
                              ▼                                ▼
                   audioStore.ts (Svelte stores)      MediaRecorder (Reed Analysis view)
                   pitch / fft / level / sampleRate                │
                              │                                    ▼
                              ▼                          decodeAudioData → AudioBuffer
                   Tuner: PitchDisplay, InputMeter,                 │
                   live Spectrogram (Canvas 2D)                    ▼
                                                          recordingAnalyzer.ts
                                                          (harmonic-series analysis)
                                                                    │
                                                                    ▼
                                              matchSymptoms() ──▶ symptoms.ts database
                                                                    │
                                                                    ▼
                                              AnalysisResult.svelte + Guide highlights
```

- **`src/lib/audio/audioContext.ts`** — owns the `AudioContext`/`AnalyserNode`, ticks on `requestAnimationFrame` (throttled ~30fps), hands time-domain + frequency-domain data and the real device sample rate up to the store.
- **`src/lib/stores/audioStore.ts`** — Svelte stores (`pitchStore`, `fftStore`, `levelStore`, `sampleRateStore`) that the Tuner/Reed Analysis views subscribe to.
- **`src/lib/audio/pitchDetector.ts`** — autocorrelation pitch detection (`detectPitch`) and note-naming (`frequencyToNote`, `nearestC`).
- **`src/lib/audio/spectrogramEngine.ts`** — log-scale frequency↔pixel mapping (`freqToY`/`yToFreq`) and dB→color mapping for the Canvas 2D spectrogram.
- **`src/lib/components/Spectrogram.svelte`** — renders the live/static spectrogram; scrolls by blitting the canvas one pixel left per frame.
- **`src/lib/audio/recordingAnalyzer.ts`** — the core diagnostic engine (see Algorithms below); turns a recorded `AudioBuffer` into octave/harmonic presence data, pitch stability, and a verified fundamental.
- **`src/lib/data/symptoms.ts`** — the symptom database; each entry has a description, likely causes by reed region, audio signatures, suggested fixes, and optional `matchConditions` used to auto-highlight it from a recording's analysis.
- **`src/lib/audio/metronome.ts`** — a self-contained click engine, unrelated to the recording pipeline above; uses the standard Web Audio "lookahead" scheduling pattern (see Algorithms below) for drift-free timing.

No backend, no database, no auth, no persistence. Deployed as a static site via `@sveltejs/adapter-static`.

## Algorithms

**Autocorrelation pitch detection** (`pitchDetector.ts`) — the standard "find the first strong repeat" approach: computes the autocorrelation of a time-domain buffer, skips the initial descent, finds the first valley, then the peak after it, and refines to sub-sample accuracy with parabolic interpolation. Used for the live Tuner and as the per-frame estimate feeding into the Reed Analysis view's processing.

**Goertzel algorithm** (`recordingAnalyzer.ts`) — rather than running a full FFT, the recording analysis computes signal power at specific target frequencies directly via the Goertzel algorithm. This is what makes the "narrow, targeted search near a known-good frequency" strategy below cheap enough to run many times per recording.

**Harmonic-series fundamental estimation** — a rich, buzzy crow has many simultaneous partials, which can make a simple pitch detector lock onto *any* of them (not necessarily the true root, and the error can go either direction — a harmonic above or a sub-harmonic below). `estimateFundamental` corrects for this: it tests the raw per-frame pitch estimate along with simple multiples and divisions of it (1×–8× in both directions) against the observed spectrum, requires each candidate to have genuine energy *at its own frequency* (not just at a few of its harmonics — otherwise two unrelated real tones can share a spurious low common divisor), and picks whichever candidate is corroborated by the most real, matched harmonic energy.

**Octave/harmonic band detection** — once the fundamental is verified, the analyzer scans narrow windows around the C-family octaves (0.5×, 1×, 2×, 4×, 8× the fundamental — "the C's") and the natural non-octave partials (3×, 5×, 6×, 7× — the buzzy filler in between, landing near a fifth, a third, another fifth, and a flat seventh above the root). Each band's search tolerance scales with *that band's own* target frequency (not a fixed Hz value), which keeps the effective cents-tolerance constant across all multiples — wide enough to tolerate real reed inharmonicity, tight enough that a band can't cross-contaminate its neighbor or get fooled by an unrelated resonance.

**Crow quality classification** — from the octave/harmonic presence pattern: a single present octave reads as a monotone crow (heart over-scraped or bent cane); upper C's with nothing below the root reads as a missing lower octave (tends toward sharp, stuffy tone); three or more stacked octaves reads as a healthy, balanced crow. Pitch is judged in tune against the *nearest* C in any octave, not a fixed target — a crow rooted on C5 is just as "in tune" as one rooted on C6.

**Log-scale spectrogram rendering** — frequency-to-pixel mapping is logarithmic (matching musical pitch perception, and how the reference Merlin tuner draws its spectrogram), so octave intervals occupy equal vertical space regardless of absolute frequency.

**Metronome lookahead scheduling** — a naive `setInterval` click loop drifts, because JS timer callbacks aren't guaranteed to fire exactly on schedule. Instead, a `setTimeout` loop wakes up every 25ms just to *queue* upcoming clicks, but each click's actual play time is scheduled against the `AudioContext`'s own sample-accurate clock (`osc.start(time)`), which doesn't drift. The visual beat indicator is synced separately via a `setTimeout` computed from that same scheduled time — fine for a UI dot, since eyes are far less sensitive to a few ms of jitter than ears are for the click itself.

## Tech stack

SvelteKit 2 (Svelte 5) with `@sveltejs/adapter-static` · Web Audio API (`getUserMedia`, `AudioContext`, `AnalyserNode`, `MediaRecorder`) · Canvas 2D · Vitest (unit tests) · Playwright (e2e)

## Developing

```sh
npm install
npm run dev          # start dev server
npm run dev -- --open
```

## Testing & type-checking

```sh
npm test             # vitest unit tests
npm run check         # svelte-check
```

## Building

```sh
npm run build
npm run preview       # preview the production build locally
```

Output is a static site (`@sveltejs/adapter-static`) — deployable to any static host (Vercel, Netlify, GitHub Pages, etc.).
