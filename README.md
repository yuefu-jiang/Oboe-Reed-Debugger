# Oboe Tool Kit

Deployed at: https://oboe-tool-kit.yuefu.fyi/

A client-side practice kit for oboists: a tuner, a metronome, a scale trainer with notation and fingering charts, and a reed analyzer that diagnoses American-scrape reeds from their **crow** — the raw sound a reed makes blown alone, without the instrument. All audio processing happens in the browser; no audio is ever uploaded anywhere.

## What it does

Five views, in tab order, tied together by a shared audio pipeline:

- **Tuner** — real-time pitch readout (note + cents) and a live scrolling, log-frequency spectrogram (Merlin-style), 200Hz–5kHz.
- **Metronome** — free-entry tempo (20–300 BPM) and a beats-per-measure dropdown, for practicing reed response and articulation against a steady click.
- **Scale Practice** (the landing page) — pick a key (or Chromatic, which has no key and greys the mode out), a scale (major / natural, harmonic or melodic minor), a range (one or two octaves from the tonic, the oboe's full range, or any custom span from a low note to a high one — the run then covers every scale note in between, so it can start and end off the tonic), a tempo and a note length (one note per click, or hold each note for 2, 4 or 8 beats for long tones), then play along: the whole scale is drawn as treble-clef notation with the current note highlighted (click any note to park the highlight there and start from it), an inline oboe fingering chart lights up the keys for that note (with arrows to flip to an alternate fingering where one exists, and a pin to make that choice stick), and a compact tuner shows whether you actually landed on it.
- **Reed Analysis** — record a crow, see a static spectrogram of it (hover to read off frequency at any point), and get a structured breakdown: which octaves of C are present, which non-octave harmonics are present, overall crow quality, and pitch stability — plus matched entries from the symptom guide.
- **Guide** — the full symptom database, browsable by category (crow / response / pitch / tone / endurance).

The reed analyzer works from the standard reed-adjustment premise that a well-made reed crows as a stack of octaves of "C" plus a natural ladder of non-octave harmonics that give it a buzzy, reedy character. It records that crow, figures out which C's and which harmonics are actually present, and cross-references the pattern against a symptom database to suggest likely causes and fixes — region-by-region (tip / heart / back / spine / rails / blend). A revised model of the crow, which reworks that premise, is in `crow-model-v2.md`; the analyzer doesn't use it yet.

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
- **`src/lib/music/scales.ts`** — scale construction with correct *spelling* (see Algorithms below), the per-mode tonic tables, and the range-fitting helpers that decide which key starts on which octave.
- **`src/lib/music/fingerings.ts`** — oboe fingerings for B♭3–A6, taken from the IDRS standard fingerings and Yamaha's published chart, expressed as lists of `id` attributes in `fingering-chart.svg`.
- **`src/lib/music/notation.ts`** — pure staff geometry (diatonic position → y, ledger lines, stem direction, line wrapping) for the notation renderer.
- **`src/lib/components/ScaleStaff.svelte`** — draws the scale as treble-clef SVG notation, wrapping onto multiple systems to fit its container.
- **`src/lib/components/FingeringChart.svelte`** — inlines `fingering-chart.svg` and toggles a fill class on the keys a fingering names.
- **`src/lib/audio/metronome.ts`** — a self-contained click engine, unrelated to the recording pipeline above; uses the standard Web Audio "lookahead" scheduling pattern (see Algorithms below) for drift-free timing.

No backend, no database, no auth, no persistence. Deployed as a static site via `@sveltejs/adapter-static`.

## Algorithms

**Autocorrelation pitch detection** (`pitchDetector.ts`) — the standard "find the first strong repeat" approach: computes the autocorrelation of a time-domain buffer, skips the initial descent, finds the first valley, then the peak after it, and refines to sub-sample accuracy with parabolic interpolation. Used for the live Tuner and as the per-frame estimate feeding into the Reed Analysis view's processing.

**Goertzel algorithm** (`recordingAnalyzer.ts`) — rather than running a full FFT, the recording analysis computes signal power at specific target frequencies directly via the Goertzel algorithm. This is what makes the "narrow, targeted search near a known-good frequency" strategy below cheap enough to run many times per recording.

**Harmonic-series fundamental estimation** — a rich, buzzy crow has many simultaneous partials, which can make a simple pitch detector lock onto *any* of them (not necessarily the true root, and the error can go either direction — a harmonic above or a sub-harmonic below). `estimateFundamental` corrects for this: it derives candidate roots from two independent anchors — the autocorrelation median *and* the most prominent spectral peak, so the brightest band always gets a vote — plus each anchor's simple multiples and divisions (1×–8× in both directions), requires each candidate to have genuine energy *at its own frequency* (not just at a few of its harmonics — otherwise two unrelated real tones can share a spurious low common divisor), and picks whichever candidate is corroborated by the most real, matched harmonic energy.

**Virtual fundamental harmonic series** — a healthy crow isn't small fixed multiples of whichever C the pitch detector happens to land on; it's one continuous harmonic series descending from a single, usually inaudible virtual fundamental f0 near C3 (130.8Hz). Once the verified root is found, it's folded down (or up) by whole octaves — `f0 = root / 2^round(log2(root / C3))` — preserving whatever flat/sharp offset the root itself carries, so a reed that crows 75¢ sharp gets a *consistently* sharp series, not one snapped back to exact pitch. Every harmonic `n·f0` for integer n is then classified into one of two sets: the **octaves** ("the C's") are the powers-of-2 harmonics, and the **buzz** is everything else, grouped by the octave span it falls in (the C6→C7 span holds 7 possible partials, C7→C8 holds 15 — density doubles each octave up). This naturally includes the acoustically real, detuned natural partials (a flat 7th, 11th, 13th harmonic, etc.) that a fixed small-multiple model could never represent once the root climbed above C6. Although the series runs C3–C8 in principle, an American-scrape oboe crow only ever sounds in **C5–C8** (C6 is the usual root), so those are the only octaves scanned and displayed.

The estimator is deliberately tolerant of a *weak or absent fundamental*, which is characteristic of a bright oboe crow — the 3rd harmonic (a twelfth up, e.g. G7 over a C6 root) is often the single loudest band. A candidate root is accepted if it is *either* strong in its own right *or* clearly heads a series (real energy at its octave), so the true C root wins on total explained energy even when a loud childless upper partial towers over it — without which the whole grid can fold onto the wrong pitch class.

**Octave/harmonic band detection** — octave bands are found with a narrow per-frame search around each target, tolerance scaled to *that band's own* frequency (a fixed percentage keeps the effective cents-tolerance constant, and octaves are always a full doubling apart so it can't cross-contaminate a neighbor). Buzz harmonics are checked more cheaply against a single coarse spectrum already computed for fundamental estimation, with a tolerance that's a fixed *fraction of f0 itself* rather than of each target — since adjacent integer harmonics are always exactly f0 apart in Hz no matter how high the harmonic number climbs, a target-relative tolerance would eventually grow wide enough to swallow its neighbor (and a wide-ish window is needed anyway, so real reed inharmonicity — which accumulates as `n·δ` — doesn't push the high partials out of range). The spectrum those buzz calls are made against is first *denoised* two ways: the analysis is restricted to the crow's loud, steady **core** (the frames well above the peak, not the quiet attack/decay or breath tails), and that core is averaged frame-by-frame (Welch's method) so incoherent broadband noise averages down while the steady harmonic peaks stay put. A buzz partial then counts as present when it stands well above the **local** noise floor right where it sits — a low percentile of a sliding ±250 Hz window, which tracks the breath-noise floor and the leakage skirt of any nearby loud tone but ignores the discrete peaks. Judging locally is what makes the huge dynamic range tractable: the fundamental (or a bright 3rd harmonic) can be hundreds of times louder than a real buzz line elsewhere, so a single global floor is meaningless, whereas a faint partial in a quiet region still stands out against *its own* neighbourhood. A tiny absolute backstop (a fraction of peak power) guards silent regions, and a mild local-prominence check rejects the smooth leakage skirt of a loud tone — deliberately *not* a strict prominence test, which would perversely penalize the richest crows, whose buzz regions are so full of energy there are barely any gaps for a partial to stick up out of.

**Richness per octave span** — each buzz band reports a fill ratio (present partials ÷ total partials in that span), so "how buzzy is the C6→C7 register" and "how buzzy is C7→C8" can be read independently. The aggregate `harmonicCompleteness` used for the overall verdict is present-buzz-partials ÷ total-buzz-partials across all spans (up to 26, C3 through C8) — a genuinely rich crow only lights up roughly a quarter to a third of that in practice, since the densest span (15 partials between C7 and C8) is never going to be fully lit even on a great reed.

**Crow quality classification** — from the octave/buzz presence pattern: a single present octave reads as a monotone crow (heart over-scraped or bent cane). A gap in the octave stack is classified by *direction*: a crow sitting high (C7/C8 with no C6 root) is missing its **lower** octave — the sharp, stuffy, back-too-thin case — whereas a rooted crow that just doesn't reach C8 (e.g. C6+C7) is missing the **upper** octave, a much milder "solid two-octave crow" that's often fine as-is. Three or more stacked octaves is *necessary but not sufficient* for a healthy crow — any pitched tone carries ordinary harmonics at 2× and 4×, which register as octave bands, so "excellent" additionally requires the stack to be rooted near an actual C (within 50¢) and to carry real non-octave buzz. Pitch is judged in tune against the *nearest* C in any octave, not a fixed target — a crow rooted on C5 is just as "in tune" as one rooted on C6.

**Log-scale spectrogram rendering** — frequency-to-pixel mapping is logarithmic (matching musical pitch perception, and how the reference Merlin tuner draws its spectrogram), so octave intervals occupy equal vertical space regardless of absolute frequency.

**Metronome lookahead scheduling** — a naive `setInterval` click loop drifts, because JS timer callbacks aren't guaranteed to fire exactly on schedule. Instead, a `setTimeout` loop wakes up every 25ms just to *queue* upcoming clicks, but each click's actual play time is scheduled against the `AudioContext`'s own sample-accurate clock (`osc.start(time)`), which doesn't drift. The visual beat indicator is synced separately via a `setTimeout` computed from that same scheduled time — fine for a UI dot, since eyes are far less sensitive to a few ms of jitter than ears are for the click itself.

**Scale spelling** (`scales.ts`) — a scale isn't a set of pitch classes, it's one letter per degree. Rather than storing note names, each degree takes the *i*-th letter above the tonic's letter and derives its accidental from the gap between that letter's natural pitch and the pitch the interval pattern asks for. That's what makes E♭ major come out as E♭ F G A♭ B♭ C D rather than the enharmonically identical but unreadable D♯ F G G♯ A♯ C D, and what lets G♯ harmonic minor produce its F𝄪 instead of a G natural. Staff position then follows from the letter alone, since accidentals never move a note off its line.

**Fingerings as chart ids** (`fingerings.ts`) — every key in `fingering-chart.svg` carries a semantic `id` (`b`, `f-sharp`, `octave-1`, `left-g-sharp`, …), so a fingering is stored as the list of ids to fill in. Keys with a hole in them are drawn the way they're built: LH1 is a plate with a small vent, so a half-hole (`b-half`) colors the plate ring and tab and leaves the vent open, and RH3 is a ring key with a large hole. LH1 also carries the small tab on its lower rim that the finger rolls toward. Each hole is a separate `<key>-vent` outline drawn above its key and never filled, so the hole's edge stays visible whether the key is open, half-holed or pressed. The artwork *is* the data model: there's no second table of coordinates to drift out of sync with the drawing, and unit tests assert that every id a fingering references actually exists in the SVG, that no two notes share a key pattern, and that each note and its octave sit on the same holes apart from the octave keys. The table is built from the International Double Reed Society's standard oboe fingerings (idrs.org/resources/fingerings), with Yamaha's published chart filling in F♯6 and a few alternates. The IDRS diagrams are drawn from the same artwork `fingering-chart.svg` was traced from, so they were read by measuring which key shapes are filled rather than by eye, and every IDRS standard diagram matches a fingering in the table. The default for each note is the fingering both sources agree on, otherwise IDRS's first; the rest (left E♭, left F and forked F, right G♯, three D6s, the pinky combinations for E♭6–F6) are switchable alternates, each tagged with its source. A pinned alternate is remembered per note, by name, in `localStorage` (`fingeringPins.ts`); an unpinned switch lasts only until the run moves to another note.

**Chromatic as a key, not a mode** — a chromatic scale has no tonic and no key signature, so it's offered as a thirteenth entry in the *key* selector rather than alongside major and minor; picking it disables the mode selector. Its one- and two-octave runs are anchored on C, which spells cleanly ascending. **Full range** — available for every scale, not only chromatic — runs every scale note the oboe has, B♭3 to A6 and back (71 notes for chromatic), with the staff scrolling to keep the current note on screen; **Custom** does the same between any two notes.

**Key signatures and the clef** (`scales.ts`, `notation.ts`) — keyed scales get their key signature at the head of every staff line, counted round the circle of fifths from the tonic's spelling (a minor key sits three steps flatwards of the major on the same tonic, and harmonic and melodic minor take the natural minor's signature). The accidentals on the notes themselves are kept as well, as a reminder for newer players. The treble clef is a public-domain outline from Wikimedia Commons drawn as a path, positioned so its spiral sits on the G line, and sharps and flats are drawn paths too (`accidentalGlyphs.ts`), sized in staff spaces. The `𝄞`, `♯` and `♭` characters they replaced come out at a different size and height in every font.

**Chromatic spelling** (`scales.ts`) — a chromatic scale has no letter-per-degree rule to fall back on, so it uses the convention players read instead: sharps on the way up, flats on the way down. Two pitch-class-indexed tables cover it, and because neither ever spells a note across an octave boundary (no B♯ or C♭), the octave comes straight from the MIDI number.

**Starting mid-run** — playback picks up at whichever note is highlighted, so clicking a note on the staff and pressing Start begins there. The beat counter is seeded to `note x beatsPerNote`, and `initialBeat` seeds the metronome's measure counter to match, so the accent lands exactly where it would have had the run played from the top — starting from the middle never drags the downbeat onto an off-beat.

**Laying a scale over the click** (`practice.ts`) — the click engine only knows beats and measure length, so `practice.ts` maps "beat N since start" to "note N of the scale, beat M of that note". The measure length it hands the metronome is really a choice about where the accent falls: holding each note for several beats, the useful accent is the downbeat that starts each note, so the measure *is* the note; at one note per click every beat already starts a note, so accenting all of them says nothing and the measure becomes the whole run, putting the accent on the tonic each time around.

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
