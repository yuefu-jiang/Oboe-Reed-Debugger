<script lang="ts">
  import type { RecordingAnalysis } from '$lib/audio/recordingAnalyzer';
  import { frequencyToNote } from '$lib/audio/pitchDetector';

  let { analysis = null }: { analysis?: RecordingAnalysis | null } = $props();

  type Status = 'good' | 'warn' | 'bad';
  const colors: Record<Status, string> = { good: '#2a9d8f', warn: '#e9c46a', bad: '#e76f51' };
  const labels: Record<Status, string> = { good: 'Good', warn: 'Fair', bad: 'Check' };

  function noteStr(hz: number) {
    if (hz < 0) return '—';
    const n = frequencyToNote(hz);
    return `${n.note}  ${Math.round(hz)} Hz`;
  }

  function centsLabel(cents: number): string {
    if (Math.abs(cents) <= 30) return 'in tune';
    return cents > 0 ? `+${cents}¢ sharp` : `${cents}¢ flat`;
  }

  // A crow rooted on any octave of C counts as in tune — what matters is how
  // far it drifts from the *nearest* C, not whether it's specifically C6.
  function pitchStatus(hz: number, cents: number): Status {
    if (hz < 0) return 'bad';
    const c = Math.abs(cents);
    return c <= 30 ? 'good' : c <= 100 ? 'warn' : 'bad';
  }

  function pitchHint(hz: number, cents: number): string {
    if (hz < 0) return 'No clear crow pitch detected — reed may be too dry, closed, or not vibrating freely';
    if (Math.abs(cents) <= 30) return 'Crow rooted right on a C';
    if (cents > 100) return 'Crow too sharp — tip or heart may be too thick, or tip opening too narrow';
    if (cents < -100) return 'Crow too flat — reed may be too soft or too open';
    return cents > 0 ? 'Crow slightly sharp of the nearest C' : 'Crow slightly flat of the nearest C';
  }

  let pitchStat = $derived<Status>(analysis ? pitchStatus(analysis.fundamentalHz, analysis.centsFromC) : 'bad');
  let hint = $derived(analysis ? pitchHint(analysis.fundamentalHz, analysis.centsFromC) : '');
  let centsStr = $derived(analysis && analysis.fundamentalHz > 0
    ? centsLabel(analysis.centsFromC) : '');

  // Crow quality verdict — per common reed-adjustment guidance, a healthy crow
  // stacks three octaves of C; missing the lower one tends toward sharp/stuffy,
  // and a single octave (monotone) usually means an over-scraped heart or bent cane.
  //
  // A three-band octave stack alone is NOT proof of a full crow: any pitched
  // tone carries ordinary harmonics at 2x and 4x, which register as octave
  // bands (they are octaves — of a single vibrating mode). What separates a
  // genuine crow from a reed merely speaking one note is (a) the stack being
  // rooted on an actual C and (b) the dense non-octave buzz between the bands.
  // So "Excellent" additionally requires both.
  const ROOTED_ON_C_CENTS = 50;
  // harmonicCompleteness is now measured against the FULL harmonic series
  // (26 non-octave partials spanning C3..C8), not a fixed 4-partial set — see
  // recordingAnalyzer.ts. A genuinely rich crow only lights up roughly a
  // quarter to a third of that (the reference recording this was tuned
  // against scored ~0.31), so the old 0.5 threshold is recalibrated down.
  const FULL_BUZZ_COMPLETENESS = 0.25;

  let rootedOnC = $derived(analysis !== null
    && analysis.fundamentalHz > 0
    && Math.abs(analysis.centsFromC) <= ROOTED_ON_C_CENTS);
  let hasFullBuzz = $derived(analysis !== null
    && analysis.harmonicCompleteness >= FULL_BUZZ_COMPLETENESS);

  // A full stack of three octaves of C, rooted in tune, is already a good crow —
  // the buzz richness only distinguishes "excellent" from "good," it does NOT
  // knock a genuine three-octave crow down to "Fair." (An off-C stack still
  // does, since that's the "reed just speaking one note with harmonics" case.)
  let qualityStatus = $derived<Status>(analysis
    ? (analysis.octaveCount === 0 ? 'bad'
      : analysis.octaveCount === 1 ? 'bad'
      : analysis.octaveCount >= 3 ? (rootedOnC ? 'good' : 'warn')
      : 'warn')
    : 'bad');

  let qualityLabel = $derived(analysis
    ? (analysis.octaveCount === 0 ? 'No clear crow detected'
      : analysis.octaveCount === 1 ? 'Monotone crow — only one octave of C'
      : analysis.octaveCount >= 3
        ? (!rootedOnC ? 'Octave stack present — but not rooted on a C'
          : hasFullBuzz ? 'Excellent — full, buzzy crow'
          : 'Good — three-octave crow')
      : analysis.missingLowerOctave ? 'Crow sits high — missing its lower octave'
      : 'Two-octave crow — missing the top octave')
    : '');

  let qualityHint = $derived(analysis
    ? (analysis.octaveCount === 0 ? 'Reed may be too dry, closed, or not vibrating freely'
      : analysis.octaveCount === 1 ? 'Heart may be over-scraped, or the cane may be warped'
      : analysis.octaveCount >= 3
        ? (!rootedOnC
            ? `The whole stack sits ${analysis.centsFromC > 0 ? 'sharp' : 'flat'} of C — see crow pitch below`
          : hasFullBuzz
            ? 'Three stacked octaves of C with dense buzz between — a rich, healthy crow'
          : 'Three stacked octaves of C, rooted in tune — a good crow; more buzz between the C\'s would make it richer still')
      : analysis.missingLowerOctave ? 'Likely to play sharp with a stuffy tone — try opening the back/blend'
      : 'A solid two-octave crow — the top octave (C8) isn\'t sounding yet; often fine as-is')
    : '');

  function noteName(hz: number): string {
    return hz > 0 ? frequencyToNote(hz).note : '—';
  }

  // Pitch-stability readout — hidden for now: a crow is inherently unstable, so
  // the bar isn't meaningful here. The backing computation stays live (the
  // `pitchStability` field and `computeStability` in recordingAnalyzer), so
  // this display logic is ready to reuse for sustained-note analysis, where
  // stability IS diagnostic. To restore, un-comment this block and the matching
  // template block below.
  // let stabilityPct = $derived(analysis ? Math.round(analysis.pitchStability * 100) : 0);
  // let stabilityStatus = $derived<Status>(stabilityPct >= 75 ? 'good' : stabilityPct >= 50 ? 'warn' : 'bad');
  // let stabilityHint = $derived(
  //   stabilityPct >= 75 ? 'Steady pitch — balanced scrape'
  //   : stabilityPct >= 50 ? 'Some wavering — check for asymmetry'
  //   : 'Unstable — likely uneven blades or rails'
  // );

  // Harmonic completeness — the dimmer, non-octave partials that fill in a
  // genuinely buzzy crow between the C's, distinct from whether the C
  // pitches themselves are correct. Measured against the FULL harmonic
  // series now (up to 26 possible partials across C3..C8), so the bar for
  // "full" is much lower in percentage terms than a fixed 4-partial model —
  // see the FULL_BUZZ_COMPLETENESS comment above.
  let completenessPct = $derived(analysis ? Math.round(analysis.harmonicCompleteness * 100) : 0);
  let completenessStatus = $derived<Status>(completenessPct >= 25 ? 'good' : completenessPct >= 12 ? 'warn' : 'bad');
  let completenessLabel = $derived(
    completenessPct >= 25 ? 'Full, buzzy crow'
    : completenessPct >= 12 ? 'Somewhat thin'
    : 'Thin — mostly clean C\'s, little buzz'
  );

  function segmentTitle(h: RecordingAnalysis['buzzBands'][number]['harmonics'][number]): string {
    const hz = h.present ? h.hz : h.expectedHz;
    const note = hz > 0 ? frequencyToNote(hz).note : '';
    const label = note ? `${note} · ${Math.round(hz)} Hz` : `~${Math.round(hz)} Hz`;
    return h.present ? `${label} · present` : `${label} · not detected`;
  }

  // Inline hover readout for the buzz segments — replaces the status badge in
  // the section header while a segment is hovered, so the note under the
  // cursor is legible without waiting on a native tooltip.
  let hoveredBuzz = $state<string | null>(null);
</script>

{#if analysis}
  <div class="result">

    <div class="metric">
      <div class="metric-header">
        <span class="label">Crow quality</span>
        <span class="badge" style="background:{colors[qualityStatus]}">{labels[qualityStatus]}</span>
      </div>
      <div class="metric-value">{qualityLabel}</div>
      <div class="hint">{qualityHint}</div>
    </div>

    <div class="metric">
      <div class="metric-header">
        <span class="label">Crow octaves (the C's)</span>
      </div>
      <div class="octave-row">
        {#each analysis.octaves as band (band.multiple)}
          <div class="octave-chip" class:present={band.present}>
            <div class="chip-bar bright" style="height:{band.present ? Math.max(8, Math.round(band.level * 100)) : 4}%"></div>
            <span class="chip-note">{noteName(band.present ? band.hz : band.expectedHz)}</span>
          </div>
        {/each}
      </div>
    </div>

    <div class="metric">
      <div class="metric-header">
        <span class="label">Crow harmonics (the buzz in between)</span>
        {#if hoveredBuzz}
          <span class="buzz-readout">{hoveredBuzz}</span>
        {:else}
          <span class="badge" style="background:{colors[completenessStatus]}">{labels[completenessStatus]}</span>
        {/if}
      </div>
      <div class="buzz-bands">
        {#each analysis.buzzBands as band (band.octaveIndex)}
          <div class="buzz-band">
            <div class="buzz-band-header">
              <span class="buzz-band-label">{noteName(band.lowHz)} → {noteName(band.highHz)}</span>
              <span class="buzz-band-frac">{band.harmonics.filter((h) => h.present).length}/{band.harmonics.length}</span>
            </div>
            <div class="buzz-band-bar">
              {#each band.harmonics as h (h.multiple)}
                <div
                  class="buzz-seg"
                  class:present={h.present}
                  style="opacity:{h.present ? Math.max(0.35, h.level * 6) : 1}"
                  role="img"
                  aria-label={segmentTitle(h)}
                  title={segmentTitle(h)}
                  onpointerenter={() => (hoveredBuzz = segmentTitle(h))}
                  onpointerleave={() => (hoveredBuzz = null)}
                ></div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
      <div class="hint">{completenessLabel}</div>
    </div>

    <div class="metric">
      <div class="metric-header">
        <span class="label">Crow pitch (lowest C)</span>
        <span class="badge" style="background:{colors[pitchStat]}">{labels[pitchStat]}</span>
      </div>
      <div class="metric-value">
        {noteStr(analysis.fundamentalHz)}
        {#if centsStr}<span class="cents">{centsStr}</span>{/if}
      </div>
      <div class="hint">{hint}</div>
    </div>

    <!-- Pitch stability — hidden for now (a crow is always unstable). Restore
         by un-commenting; the backing computation is still live. See script.
    <div class="metric">
      <div class="metric-header">
        <span class="label">Pitch stability</span>
        <span class="badge" style="background:{colors[stabilityStatus]}">{labels[stabilityStatus]}</span>
      </div>
      <div class="bar-wrap">
        <div class="bar" style="width:{stabilityPct}%;background:{colors[stabilityStatus]}"></div>
      </div>
      <div class="hint">{stabilityHint}</div>
    </div>
    -->

  </div>
{/if}

<style>
  .result { display: flex; flex-direction: column; gap: 1.25rem; background: #1a1a1a; padding: 1.1rem 1.25rem; border-radius: 6px; }
  .metric { display: flex; flex-direction: column; gap: 0.3rem; }
  .metric-header { display: flex; align-items: center; gap: 0.6rem; }
  .label { color: #888; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .badge { font-size: 0.75rem; font-weight: 600; padding: 0.1rem 0.5rem; border-radius: 99px; color: #111; }
  .metric-value { color: #eee; font-size: 1rem; }
  .cents { color: #e9c46a; font-size: 0.85rem; margin-left: 0.5rem; }
  .hint { color: #888; font-size: 0.82rem; }
  /* Used by the hidden pitch-stability block — kept for when it's restored.
  .bar-wrap { height: 8px; background: #333; border-radius: 4px; overflow: hidden; margin: 0.15rem 0; }
  .bar { height: 100%; border-radius: 4px; transition: width 0.4s; }
  */

  .octave-row { display: flex; gap: 0.5rem; align-items: flex-end; height: 56px; margin: 0.25rem 0; }
  .octave-chip {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
    gap: 0.3rem; height: 100%; opacity: 0.35;
  }
  .octave-chip.present { opacity: 1; }
  .chip-bar { width: 60%; min-height: 4px; border-radius: 3px 3px 0 0; background: #444; }
  .octave-chip.present .chip-bar.bright { background: #2a9d8f; }
  .chip-note { font-size: 0.75rem; color: #aaa; }
  .octave-chip.present .chip-note { color: #eee; font-weight: 600; }

  .buzz-bands { display: flex; flex-direction: column; gap: 0.55rem; margin: 0.35rem 0 0.1rem; }
  .buzz-band { display: flex; flex-direction: column; gap: 0.25rem; }
  .buzz-band-header { display: flex; justify-content: space-between; align-items: baseline; }
  .buzz-band-label { font-size: 0.78rem; color: #aaa; }
  .buzz-band-frac { font-size: 0.75rem; color: #666; font-variant-numeric: tabular-nums; }
  .buzz-band-bar { display: flex; gap: 2px; height: 16px; }
  .buzz-seg { flex: 1; min-width: 3px; border-radius: 2px; background: #333; cursor: default; transition: outline-color 0.1s; outline: 1px solid transparent; }
  .buzz-seg.present { background: #6ba8a1; }
  .buzz-seg:hover { outline-color: #eee; }
  .buzz-readout { font-size: 0.78rem; color: #eee; font-variant-numeric: tabular-nums; }
</style>
