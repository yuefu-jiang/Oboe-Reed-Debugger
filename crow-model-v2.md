# Oboe Reed Crow — Corrected Model (v2)

Replaces the model in `crow.pdf` (v1). Model only — no code has been changed.

## 0. Why v1 had to go

v1 treats every component of a crow as a harmonic $f_n = n f_0$ of a *virtual* fundamental fixed at $f_0 \approx$ C3 (130.8 Hz), and scores richness by how many non-power-of-2 harmonics ("buzz") are present.

1. **Physics.** $f_n = n f_0$ describes a signal that *repeats* at $f_0$. Choosing C3 by rule doesn't make the reed repeat at 130.8 Hz. A crow that is periodic with its lowest component at C5 can only have energy at multiples of C5 — at most 1 of the 7 slots in v1's C6–C7 band, 0 of 7 if it's rooted at C6. v1's "rich buzz, $R_j \to 1$" is unreachable by harmonics.
2. **Literature.** Measured crows are described as multiphonics whose upper partials "don't fit into the integer calculated harmonic series" (§5).
3. **Measurement.** On a real crow (§4), v1's C3 grid explains **43%** of peak power; a randomly detuned grid of the same density explains **44%**. It has no explanatory power — its fits come entirely from grid density.

The core error: treating *any energy between the C's* as harmonic structure. That energy is real, but it comes from a second, independent oscillation, from the combination tones the two produce, and from noise.

## 1. Physical picture

- The reed is a **self-sustained oscillator with at least two vibrating regions**: the **tip**, which produces the *high crow* at $f_H$, and the **heart**, which produces the *low crow* at $f_L$ (Binkley: "Tip = High C crow, Heart = Low C crow").
- The resonator it drives — the reed cavity plus staple, a short cone — is **acoustically weak**. In the played instrument the long bore pins the reed to one frequency; in a crow nothing does, so tip and heart can oscillate **independently** (Millard; GVSU).
- Air forced through the narrow channel adds **broadband turbulence noise**.

So a crow is not a fixed spectrum. It is one of a few **regimes**, and which one you get depends on blowing pressure and on the reed's balance.

## 2. Signal model

$$x(t) = \sum_{k} a_k \cos(2\pi f_k t + \varphi_k) + n(t)$$

The regime determines the set of partial frequencies $\{f_k\}$:

| Regime | Condition | Partials $\{f_k\}$ | Heard as |
|---|---|---|---|
| **R0** silent | below oscillation threshold | — | air |
| **R1** single | only the tip oscillates | $\{n f_H\}$ | clear high crow ("High C peeps / clear") |
| **R2** multiphonic | tip and heart both oscillate, **not locked** | $\{\lvert m f_H + n f_L\rvert : m,n \in \mathbb{Z}\}$ — no common period | "dirty", "rattle", "strange vibrations" |
| **R3** locked octave | $f_H = 2 f_L$ exactly and stable | $\{n f_L\}$ — $f_H$ becomes harmonic 2 | "stable double C octave" |
| **R3′** other lock | $f_H / f_L = p/q$ exactly, $p/q \ne 2$ | $\{n f_0\}$, $f_0 = f_H/p = f_L/q$ | pitched but not an octave |
| **R4** noise | $n(t)$ dominates, no stable $f_k$ | broadband | "no pitch center", "chaotic" |
| cack | jump to a different mode frequency | new $\{n f'\}$ | sudden unrelated pitch (Millard) |

**Locking.** With $\rho = f_H / f_L$, the reed is locked to $p{:}q$ when both

$$\left|1200 \log_2\!\left(\rho \cdot \tfrac{q}{p}\right)\right| < \varepsilon \quad\text{and}\quad \rho \text{ stays constant over time.}$$

The second condition matters more: two locked oscillators drift *together* and keep an exact ratio; two unlocked ones drift *apart*. $\varepsilon$ must be calibrated on known-good reeds (§6); ~10¢ is a starting guess.

**The signature of R2** is the combination lattice. The first-order products $f_H - f_L$ and $f_H + f_L$ follow the two oscillations as they move. No harmonic series can produce a partial that moves this way, which makes it the cleanest test for the regime.

**Blowing pressure.** A Full Spectrum Crow sweeps pressure from low to high. The model predicts, and Binkley's handout describes, the good-reed sequence:

$$\text{R0} \;\to\; \text{R1 (tip, } f_H \approx \text{C6)} \;\to\; \text{R2 (low C emerging, dirty)} \;\to\; \text{R3 (locks: } f_L \approx \text{C5, octave)}$$

Failure modes are regimes that never resolve: R1 persisting (no low crow), R2 persisting (never locks), or R4.

## 3. What to measure

These replace v1's buzz fill ratio $R_j$. All are per analysis frame (~0.1–0.2 s) and then summarized over the crow.

| # | Quantity | Definition | Reading |
|---|---|---|---|
| 1 | **Tip pitch** | $f_H$; $c_H = 1200\log_2(f_H / \text{C6})$ | crow in tune / flat / sharp |
| 2 | **Low crow presence** | level of $f_L$ relative to $f_H$, dB | tip-dominated if absent |
| 3 | **Octave detuning** | $\delta = 1200\log_2\!\big(f_H / 2f_L\big)$ | 0 = octave; plus its spread over time |
| 4 | **Lock stability** | std of $\rho$ over frames | small = locked, large = independent |
| 5 | **Periodicity** $P$ | tonal power on the comb of the best common period, **minus the same score for a detuned comb of equal density** | high = R1/R3; low = R2/R4 |
| 6 | **Intermodulation** $I$ | tonal power on lattice points $m f_H + n f_L$ with $m,n \neq 0$ that are *not* on the comb | the R2 signature |
| 7 | **Tonal share** $T$ | power in narrow peaks / total power | $1-T$ is the noise share |
| 8 | **Brightness** | slope of harmonic amplitudes vs $\log n$ (only once periodic) | replaces v1's "richness" |
| 9 | **Time to lock** | time (or level) from R1 onset to R3 | how readily the low crow locks |

Measure 5 is chance-corrected on purpose. Any harmonic comb explains more peaks the lower its fundamental — at ~100 Hz it matches almost anything. Scoring against a detuned comb of the same density is what exposes v1's grid, and it has to be built in rather than bolted on.

**Classification sketch** (thresholds to calibrate):

- R1: $f_L$ absent, $P$ high on the $f_H$ comb
- R3: $f_L$ present, $|\delta|$ small, $\rho$ stable, $P$ high on the $f_L$ comb, $I$ low
- R2: $f_L$ present, $\rho$ drifting, $I$ substantial, difference tone present
- R4: $T$ low, no stable $f_H$

## 4. Evidence from a real crow

**Recording:** Freesound #323042, "Oboe reed.mp3" by *piermic* (CC0) — a handmade oboe reed crowed in five bursts, 10.1 s, analysed from the 128 kb/s preview. It was the only public oboe crow recording found (Freesound, Wikimedia Commons and the Internet Archive were searched).

**Method:** 8192-point frames (0.19 s) every 0.1 s; peaks ≥15 dB above a running-median floor, clusters merged within 20 Hz; each model scored as the share of peak power within ±15¢ of its predicted frequencies, against a detuned-grid chance level.

| Burst | Time (s) | Regime | $f_H$ (Hz) | $f_L$ (Hz) | $\rho = f_H/f_L$ | Noise share |
|---|---|---|---|---|---|---|
| 1 | 1.7–3.2 | **R1** (weak R2 at onset) | 982–988 | 600–625, weak | 1.58–1.65 | 0.04 |
| 2 | 4.0–5.0 | **R2** | 958–980 | 580–603 | 1.60–1.68 | 0.19 |
| 3 | 5.7–6.6 | **R2** | 958–985 | 581–599 | 1.62–1.66 | 0.16 |
| 4 | 7.1–7.5 | **R2** | 966–970 | 563–581 | 1.66–1.72 | 0.23 |
| 5 | 7.9–8.9 | **R2** | 967–975 | 558–597 | 1.63–1.74 | 0.18 |

Findings:

- **v1's C3 grid has no explanatory power:** it explains 0.43 of peak power on average, against 0.44 by chance.
- **R1 is real and clean.** In burst 1 once settled (2.36–2.96 s), the harmonics of $f_H = 984.5$ Hz carry **95–97%** of peak power, against ~0% by chance. That's a periodic high crow at B5 −6¢ — **about a semitone flat of C6**.
- **R2 is real, and its partials move as two independent oscillations predict.** The ratio $\rho$ wanders between 1.58 and 1.74 instead of holding a fixed value, and a peak at the difference tone $f_H - f_L$ is present in **29 of 37** frames with a second oscillation, **following it from 361 to 414 Hz**. The remaining frames are off by ~2 FFT bins, which is at the resolution limit. A few frames sit near 5:3 ($\rho \approx 1.667$), but the ratio doesn't stay there, so it isn't a lock.
- **Noise tracks the regime:** ~4% of power in the periodic burst, 16–23% in the multiphonic ones.
- **Read as a reed diagnosis:** the tip crows flat, and the low crow sits about a major sixth below it (~D5) instead of an octave (C5), and never locks. That's Binkley's dirty, unresolved crow — one no clean octave comes out of.

## 5. Sources

- L. Binkley, *Understanding the Crow & Oboe Reed Adjustment* (Central Michigan University, 2016/2019) — `2019_understanding_crow_and_reed_adjustment.pdf` in this repo. Regime sequence with air flow; tip = high crow, heart = low crow; dirty vs stable crows; diagnostic situations. Read in full.
- C. Millard, "Corvids and Cacks", *Brains and Membranes*, ch. 16 — [Council of Canadian Bassoonists](https://councilofcanadianbassoonists.ca/project/brains-and-membranes-by-christopher-millard-chapter-16-corvids-and-cacks/). Measured bassoon crows: peeping is exactly harmonic (370/740/1110/1480 Hz); the crow is a multiphonic with non-integer partials; cacks jump to an unrelated frequency; the reed's weak resonance can't control it. Bassoon, not oboe, but the same double-reed mechanism. Read in full.
- *A Study of Oboe Reeds*, ScholarWorks@GVSU — [link](https://scholarworks.gvsu.edu/cgi/viewcontent.cgi?article=1119&context=sss). Anechoic crow recordings; upper partials inharmonic and variable between repeats, attributed to the weak bore resonance of the reed volume. **Only search-result excerpts could be read**; the page itself is access-blocked.
- A. Almeida, C. Vergez, R. Caussé, "Quasistatic nonlinear characteristics of double-reed instruments", *JASA* 121(1), 2007 — [arXiv:physics/0607011](https://arxiv.org/abs/physics/0607011). The staple acts as a conical diffuser in the reed's flow system. Background; abstract only.
- "Oboe normal mode adjustment via reed and staple proportioning", *JASA* 73(5) — [link](https://pubs.aip.org/asa/jasa/article-abstract/73/5/1794/669269/Oboe-normal-mode-adjustment-via-reed-and-staple). The reed-plus-staple assembly must match the volume and lowest-mode frequency of the oboe cone's missing apex. Background; search excerpt only.
- N. Pfiester, *Sound Production Analysis of the Oboe* (NSF REU, UIUC, 2008) — [PDF](https://courses.physics.illinois.edu/phys406/sp2017/NSF_REU_Reports/2008_reu/Nicole_Pfiester_Oboe_Analysis/Sound_Production_Analysis_of_a_Double_Reed_Instrument.pdf). A conical bore has harmonic resonances $f_n = nc/2L$; played-oboe spectra. Background. Read in full.
- Freesound #323042, "Oboe reed.mp3" by piermic, CC0 — [link](https://freesound.org/people/piermic/sounds/323042/). The measured crow in §4.

## 6. What's still open

1. **No known-good crow has been measured.** The key prediction — that a good reed at full air locks at exactly 2:1, with $f_L \approx$ C5, stable $\rho$, high periodicity and low noise — is untested. Recording a few reeds you'd call good and bad, in the app's Reed Analysis view, would settle it and calibrate $\varepsilon$ and the thresholds.
2. **One recording, lossy and uncalibrated.** An mp3 preview of one reed in an ordinary room. The regime findings are robust (they rest on frequency relationships, which the codec and room don't move); absolute levels and the noise share are less so.
3. **Air flow isn't measured.** The regime sequence is a function of blowing pressure. Without a sensor, overall level is the practical stand-in.
4. **R3′ locks** (5:3 and the like) are possible in principle. This recording only came near one briefly. Whether real reeds sit in such locks needs more recordings.
5. **Which octaves.** C6 over C5 is the reading of "octave C crow" used here. Some players describe crows spanning three octaves of C; if a C7 tip component is common, the model handles it as harmonic 2 of $f_H$ — to be confirmed on recordings.
