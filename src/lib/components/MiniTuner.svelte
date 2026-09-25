<script lang="ts">
  import type { PitchInfo } from '$lib/stores/audioStore';

  let {
    pitch = null,
    level = 0,
    targetMidi = null,
    running = false
  }: { pitch?: PitchInfo; level?: number; targetMidi?: number | null; running?: boolean } = $props();

  // Compared by MIDI number rather than by name: the detector spells
  // everything with sharps, so a B♭ target would never string-match.
  let heardMidi = $derived(pitch ? Math.round(12 * Math.log2(pitch.frequency / 440)) + 69 : null);
  let onTarget = $derived(targetMidi !== null && heardMidi !== null && heardMidi === targetMidi);
  let inTune = $derived(onTarget && pitch !== null && Math.abs(pitch.cents) <= 10);
  let offset = $derived(pitch ? Math.max(-50, Math.min(50, pitch.cents)) : 0);
</script>

<div class="mini-tuner" class:idle={!running}>
  <div class="note" class:in-tune={inTune} class:off-target={pitch !== null && targetMidi !== null && !onTarget}>
    {pitch ? pitch.note : '—'}
  </div>

  <div class="gauge">
    <div class="cents-bar">
      <div class="zone"></div>
      <div class="center-mark"></div>
      {#if pitch}
        <div class="needle" class:in-tune={inTune} style="left: calc(50% + {offset}%)"></div>
      {/if}
    </div>
    <div class="meta">
      <span class="cents">{pitch ? `${pitch.cents > 0 ? '+' : ''}${pitch.cents}¢` : '—'}</span>
      <span class="level"><span class="level-bar" style="width:{Math.round(level * 100)}%"></span></span>
    </div>
  </div>
</div>

<style>
  .mini-tuner {
    display: flex; align-items: center; gap: 0.9rem;
    padding: 0.6rem 0.8rem; background: #191919; border: 1px solid #2c2c2c; border-radius: 8px;
  }
  .mini-tuner.idle { opacity: 0.55; }
  .note { font-size: 1.6rem; font-weight: bold; color: #ddd; min-width: 3.2rem; font-variant-numeric: tabular-nums; }
  .note.in-tune { color: #2a9d8f; }
  .note.off-target { color: #e76f51; }
  .gauge { flex: 1; display: flex; flex-direction: column; gap: 0.35rem; min-width: 0; }
  .cents-bar { position: relative; height: 10px; background: #222; border-radius: 5px; overflow: hidden; }
  /* ±10¢ acceptance window, matching the in-tune threshold above. */
  .zone { position: absolute; left: 40%; width: 20%; top: 0; height: 100%; background: #1f3a37; }
  .center-mark { position: absolute; left: 50%; top: 0; width: 2px; height: 100%; background: #555; transform: translateX(-50%); }
  .needle { position: absolute; top: 0; width: 3px; height: 100%; background: #e9c46a; transform: translateX(-50%); transition: left 0.05s; }
  .needle.in-tune { background: #2a9d8f; }
  .meta { display: flex; align-items: center; gap: 0.6rem; }
  .cents { font-size: 0.75rem; color: #888; min-width: 3rem; font-variant-numeric: tabular-nums; }
  .level { flex: 1; height: 4px; background: #222; border-radius: 2px; overflow: hidden; }
  .level-bar { display: block; height: 100%; background: linear-gradient(to right, #2a9d8f, #e9c46a, #e76f51); transition: width 0.05s; }
</style>
