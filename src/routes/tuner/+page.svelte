<script lang="ts">
  import { onDestroy } from 'svelte';
  import { startListening, stopListening, fftStore, pitchStore, levelStore, sampleRateStore } from '$lib/stores/audioStore';
  import Spectrogram from '$lib/components/Spectrogram.svelte';
  import PitchDisplay from '$lib/components/PitchDisplay.svelte';
  import InputMeter from '$lib/components/InputMeter.svelte';

  let started = $state(false);

  async function toggle() {
    if (started) { stopListening(); started = false; }
    else { await startListening(); started = true; }
  }

  onDestroy(() => stopListening());
</script>

<div class="tuner">
  {#if !started}
    <p class="mic-note">This app uses your microphone to analyze reed sounds. No audio is sent anywhere — all processing happens in your browser.</p>
  {/if}
  <div class="top-bar">
    <button onclick={toggle}>{started ? 'Stop' : 'Start Mic'}</button>
    <InputMeter level={$levelStore} />
  </div>
  <PitchDisplay pitch={$pitchStore} />
  <Spectrogram fftData={$fftStore} mode="live" width={600} height={256} sampleRate={$sampleRateStore} />
</div>

<style>
  .tuner { display: flex; flex-direction: column; gap: 1.5rem; max-width: 640px; }
  .mic-note { color: #666; font-size: 0.85rem; max-width: 480px; line-height: 1.5; }
  .top-bar { display: flex; align-items: center; gap: 1rem; }
  .top-bar button { padding: 0.5rem 1.5rem; font-size: 1rem; cursor: pointer; white-space: nowrap; }
  .top-bar :global(.meter-wrap) { flex: 1; }
</style>
