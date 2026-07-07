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
  let qualityStatus = $derived<Status>(analysis
    ? (analysis.octaveCount === 0 ? 'bad'
      : analysis.octaveCount === 1 ? 'bad'
      : analysis.octaveCount >= 3 ? 'good'
      : 'warn')
    : 'bad');

  let qualityLabel = $derived(analysis
    ? (analysis.octaveCount === 0 ? 'No clear crow detected'
      : analysis.octaveCount === 1 ? 'Monotone crow — only one octave of C'
      : analysis.octaveCount >= 3 ? 'Excellent — three-octave crow'
      : !analysis.hasLowerOctave ? 'Missing lower octave'
      : 'Partial crow — two octaves present')
    : '');

  let qualityHint = $derived(analysis
    ? (analysis.octaveCount === 0 ? 'Reed may be too dry, closed, or not vibrating freely'
      : analysis.octaveCount === 1 ? 'Heart may be over-scraped, or the cane may be warped'
      : analysis.octaveCount >= 3 ? 'Multiple stacked octaves of C — balanced, healthy crow'
      : !analysis.hasLowerOctave ? 'Likely to play sharp with a stuffy tone — try opening the back/blend'
      : 'Getting there — check which octave is weakest below')
    : '');

  function noteName(hz: number): string {
    return hz > 0 ? frequencyToNote(hz).note : '—';
  }

  let stabilityPct = $derived(analysis ? Math.round(analysis.pitchStability * 100) : 0);
  let stabilityStatus = $derived<Status>(stabilityPct >= 75 ? 'good' : stabilityPct >= 50 ? 'warn' : 'bad');
  let stabilityHint = $derived(
    stabilityPct >= 75 ? 'Steady pitch — balanced scrape'
    : stabilityPct >= 50 ? 'Some wavering — check for asymmetry'
    : 'Unstable — likely uneven blades or rails'
  );

  // Harmonic completeness — the dimmer, non-octave partials (3rd/5th/6th/7th)
  // that fill in a genuinely buzzy crow, distinct from whether the C pitches
  // themselves are correct.
  let completenessPct = $derived(analysis ? Math.round(analysis.harmonicCompleteness * 100) : 0);
  let completenessStatus = $derived<Status>(completenessPct >= 50 ? 'good' : completenessPct >= 25 ? 'warn' : 'bad');
  let completenessLabel = $derived(
    completenessPct >= 50 ? 'Full, buzzy crow'
    : completenessPct >= 25 ? 'Somewhat thin'
    : 'Thin — mostly clean C\'s, little buzz'
  );
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
        <span class="badge" style="background:{colors[completenessStatus]}">{labels[completenessStatus]}</span>
      </div>
      <div class="octave-row">
        {#each analysis.harmonics as band (band.multiple)}
          <div class="octave-chip" class:present={band.present}>
            <div class="chip-bar dim" style="height:{band.present ? Math.max(8, Math.round(band.level * 100)) : 4}%"></div>
            <span class="chip-note">{noteName(band.present ? band.hz : band.expectedHz)}</span>
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
  .bar-wrap { height: 8px; background: #333; border-radius: 4px; overflow: hidden; margin: 0.15rem 0; }
  .bar { height: 100%; border-radius: 4px; transition: width 0.4s; }

  .octave-row { display: flex; gap: 0.5rem; align-items: flex-end; height: 56px; margin: 0.25rem 0; }
  .octave-chip {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
    gap: 0.3rem; height: 100%; opacity: 0.35;
  }
  .octave-chip.present { opacity: 1; }
  .chip-bar { width: 60%; min-height: 4px; border-radius: 3px 3px 0 0; background: #444; }
  .octave-chip.present .chip-bar.bright { background: #2a9d8f; }
  .octave-chip.present .chip-bar.dim { background: #6ba8a1; }
  .chip-note { font-size: 0.75rem; color: #aaa; }
  .octave-chip.present .chip-note { color: #eee; font-weight: 600; }
</style>
