<script lang="ts">
  import { goto } from '$app/navigation';
  import RecordButton from '$lib/components/RecordButton.svelte';
  import AnalysisResult from '$lib/components/AnalysisResult.svelte';
  import Spectrogram from '$lib/components/Spectrogram.svelte';
  import { analyzeRecording, matchSymptoms } from '$lib/audio/recordingAnalyzer';
  import { analysisStore, matchedSymptomsStore, spectrogramSnapshotStore } from '$lib/stores/analysisStore';
  import { startListening, stopListening, fftStore, sampleRateStore } from '$lib/stores/audioStore';
  import { yToFreq, MIN_FREQ, MAX_FREQ } from '$lib/audio/spectrogramEngine';
  import { frequencyToNote } from '$lib/audio/pitchDetector';

  let recording = $state(false);
  let spectrogram = $state<Spectrogram | undefined>(undefined);
  let hoverFreq = $state<number | null>(null);
  let hoverPos = $state({ x: 0, y: 0 });

  function handleImageHover(e: MouseEvent) {
    const img = e.currentTarget as HTMLImageElement;
    const rect = img.getBoundingClientRect();
    const yInImage = e.clientY - rect.top;
    // The image is drawn from a canvas at a fixed pixel height (naturalHeight);
    // the log-scale math is defined against that native height, not whatever
    // size the <img> happens to be scaled to on screen.
    const pixelY = yInImage * (img.naturalHeight / rect.height);
    hoverFreq = yToFreq(pixelY, MIN_FREQ, MAX_FREQ, img.naturalHeight);
    hoverPos = { x: e.clientX - rect.left, y: yInImage };
  }

  function clearHover() {
    hoverFreq = null;
  }

  function handleStart() {
    analysisStore.set(null);
    matchedSymptomsStore.set([]);
    spectrogramSnapshotStore.set(null);
    recording = true;
    startListening();
  }

  function handleStop() {
    recording = false;
    if (spectrogram) spectrogramSnapshotStore.set(spectrogram.snapshot());
  }

  async function handleRecorded(buf: AudioBuffer) {
    stopListening();
    const analysis = analyzeRecording(buf);
    analysisStore.set(analysis);
    matchedSymptomsStore.set(matchSymptoms(analysis));
  }
</script>

<div class="recorder">
  <p class="mic-note">Microphone access required. No audio leaves your device.</p>
  <p class="hint">Crow your reed or play a sustained note, then stop recording to see analysis.</p>
  <RecordButton onrecorded={handleRecorded} onstart={handleStart} onstop={handleStop} />

  {#if recording}
    <Spectrogram bind:this={spectrogram} mode="live" fftData={$fftStore} width={600} height={256} sampleRate={$sampleRateStore} />
  {:else if $spectrogramSnapshotStore}
    <div class="snapshot-wrap">
      <img src={$spectrogramSnapshotStore} alt="Spectrogram"
        onmousemove={handleImageHover} onmouseleave={clearHover}
        style="display:block;border-radius:4px;max-width:100%;cursor:crosshair;" />
      {#if hoverFreq !== null}
        <div class="hover-tooltip" style="left:{hoverPos.x}px;top:{hoverPos.y}px;">
          {frequencyToNote(hoverFreq).note} — {Math.round(hoverFreq)} Hz
        </div>
        <div class="hover-line" style="top:{hoverPos.y}px;"></div>
      {/if}
    </div>
  {/if}

  {#if $analysisStore}
    <AnalysisResult analysis={$analysisStore} />
    <button class="diagnose" onclick={() => goto('/guide')}>
      What might be wrong? →
    </button>
  {/if}
</div>

<style>
  .recorder { display: flex; flex-direction: column; gap: 1.5rem; max-width: 680px; }
  .mic-note { color: #666; font-size: 0.85rem; }
  .hint { color: #888; font-size: 0.9rem; }
  .diagnose { padding: 0.6rem 1.2rem; background: #264653; border: none; color: #eee; border-radius: 4px; cursor: pointer; font-size: 1rem; width: fit-content; }

  .snapshot-wrap { position: relative; display: inline-block; max-width: 100%; }
  .hover-line {
    position: absolute; left: 0; right: 0; height: 1px; background: rgba(233, 196, 106, 0.6);
    pointer-events: none; transform: translateY(-0.5px);
  }
  .hover-tooltip {
    position: absolute; transform: translate(0.75rem, -50%); pointer-events: none;
    background: #111; border: 1px solid #444; color: #eee; font-size: 0.8rem;
    padding: 0.2rem 0.5rem; border-radius: 4px; white-space: nowrap;
  }
</style>
