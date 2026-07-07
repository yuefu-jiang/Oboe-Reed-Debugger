<script lang="ts">
  import type { PitchInfo } from '$lib/stores/audioStore';

  let { pitch = null }: { pitch?: PitchInfo } = $props();

  let offset = $derived(pitch ? Math.max(-50, Math.min(50, pitch.cents)) : 0);
  let inTune = $derived(pitch !== null && Math.abs(pitch.cents) <= 5);
</script>

<div class="display">
  {#if pitch}
    <div class="note" class:in-tune={inTune}>{pitch.note}</div>
    <div class="cents-bar">
      <div class="center-mark"></div>
      <div class="needle" style="left: calc(50% + {offset}%)"></div>
    </div>
    <div class="cents-label">{pitch.cents > 0 ? '+' : ''}{pitch.cents}¢</div>
  {:else}
    <div class="note muted">—</div>
    <div class="cents-bar"><div class="center-mark"></div></div>
    <div class="cents-label muted">—</div>
  {/if}
</div>

<style>
  .display { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
  .note { font-size: 4rem; font-weight: bold; color: #eee; }
  .note.in-tune { color: #2a9d8f; }
  .note.muted { color: #444; }
  .cents-bar { position: relative; width: 200px; height: 12px; background: #222; border-radius: 6px; }
  .center-mark { position: absolute; left: 50%; top: 0; width: 2px; height: 100%; background: #555; transform: translateX(-50%); }
  .needle { position: absolute; top: 0; width: 4px; height: 100%; background: #e9c46a; border-radius: 2px; transform: translateX(-50%); transition: left 0.05s; }
  .cents-label { font-size: 1rem; color: #aaa; }
  .cents-label.muted { color: #444; }
</style>
