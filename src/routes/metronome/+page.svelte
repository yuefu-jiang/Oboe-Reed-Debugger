<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import {
    MIN_BPM, MAX_BPM, BEATS_OPTIONS, clampBpm,
    startMetronome, stopMetronome, setMetronomeBpm, setMetronomeBeatsPerMeasure
  } from '$lib/audio/metronome';

  let bpm = $state(120);
  let beatsPerMeasure = $state(4);
  let running = $state(false);
  let currentBeat = $state(0);

  function toggle() {
    if (running) {
      stopMetronome();
      running = false;
      currentBeat = 0;
    } else {
      startMetronome(bpm, beatsPerMeasure, (beat) => { currentBeat = beat; });
      running = true;
    }
  }

  function commitBpm() {
    bpm = clampBpm(bpm, 120);
    if (running) setMetronomeBpm(bpm);
  }

  function handleBeatsChange() {
    if (running) setMetronomeBeatsPerMeasure(beatsPerMeasure);
  }

  onDestroy(() => stopMetronome());

  // --- Breakout width, computed in JS with real pixel measurements ---
  // CSS `left: 50%` on a position:relative element resolves against its
  // *containing block* — here that's .metronome (max-width: 480px), not the
  // viewport — so a percentage-based breakout trick silently centers against
  // the wrong reference width when nested this deep inside a constrained
  // container. Measuring directly with getBoundingClientRect/innerWidth
  // sidesteps that ambiguity entirely.
  //
  // The row's left edge stays exactly where the rest of the page's content
  // starts (no horizontal shift) — only its available width extends rightward
  // toward the screen edge, so small/default-sized dots stay visually
  // anchored to the text and controls above them instead of floating
  // centered in the middle of a mostly-empty viewport.
  const RIGHT_MARGIN = 24;
  let wrapEl: HTMLDivElement | undefined;
  let wrapOffsetLeft = $state(0);
  let availableWidth = $state(0);

  function measureBreakout() {
    if (!wrapEl) return;
    wrapOffsetLeft = wrapEl.getBoundingClientRect().left;
    availableWidth = Math.max(0, window.innerWidth - wrapOffsetLeft - RIGHT_MARGIN);
  }

  onMount(() => {
    measureBreakout();
    window.addEventListener('resize', measureBreakout);
    return () => window.removeEventListener('resize', measureBreakout);
  });

  // --- Dot size — draggable up to whatever actually fits across the screen ---
  const MIN_DOT_SIZE = 24;
  const DOT_GAP_RATIO = 0.3; // gap scales with dot size so spacing stays proportional when huge
  const DEFAULT_DOT_SIZE = 80;
  const SAFETY_MARGIN = 0.96; // small buffer against sub-pixel measurement drift

  let dotSize = $state(DEFAULT_DOT_SIZE);
  let actualRowWidth = $state(0); // the dots row's own natural, unclamped rendered width at the current dotSize
  let handleWidth = $state(0);    // the resize handle's own rendered width — reserved out of the budget below
  const WRAP_GAP = 16;            // matches .beat-row-wrap's gap, between the dots row and the handle
  let dragging = $state(false);
  let dragStartX = 0;
  let dragStartSize = 0;

  // Space actually available for the dots row, once the handle sitting to
  // its right (and the gap before it) is accounted for.
  let dotsRowBudget = $derived(Math.max(0, availableWidth - handleWidth - WRAP_GAP));

  // Predicted ceiling, used to keep the drag gesture responsive in real time.
  // N dots of width W with (N-1) gaps of width W*DOT_GAP_RATIO between them
  // occupy a total of W * (N + (N-1)*DOT_GAP_RATIO) — solve for W.
  let predictedMaxDotSize = $derived(
    dotsRowBudget > 0 && beatsPerMeasure > 0
      ? Math.max(
          MIN_DOT_SIZE,
          (dotsRowBudget * SAFETY_MARGIN) / (beatsPerMeasure + (beatsPerMeasure - 1) * DOT_GAP_RATIO)
        )
      : DEFAULT_DOT_SIZE
  );

  function clampDotSize(v: number): number {
    return Math.min(predictedMaxDotSize, Math.max(MIN_DOT_SIZE, v));
  }

  // Ground truth safety net: measure the row's actual rendered width and
  // shrink proportionally if it doesn't fit, catching anything the
  // prediction above got wrong.
  $effect(() => {
    if (dotsRowBudget > 0 && actualRowWidth > dotsRowBudget * SAFETY_MARGIN) {
      const shrunk = dotSize * (dotsRowBudget * SAFETY_MARGIN) / actualRowWidth;
      dotSize = Math.max(MIN_DOT_SIZE, shrunk);
    }
  });

  function startDrag(e: PointerEvent) {
    dragging = true;
    dragStartX = e.clientX;
    dragStartSize = dotSize;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onDrag(e: PointerEvent) {
    if (!dragging) return;
    dotSize = clampDotSize(dragStartSize + (e.clientX - dragStartX));
  }

  function endDrag() {
    dragging = false;
  }

  function onHandleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') { dotSize = clampDotSize(dotSize - 8); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { dotSize = clampDotSize(dotSize + 8); e.preventDefault(); }
    else if (e.key === 'Home') { dotSize = MIN_DOT_SIZE; e.preventDefault(); }
    else if (e.key === 'End') { dotSize = predictedMaxDotSize; e.preventDefault(); }
  }
</script>

<div class="metronome">
  <p class="hint">Set a tempo and beat pattern to practice reed response and articulation against a steady click.</p>

  <div class="controls">
    <label>
      <span class="label">Tempo (BPM)</span>
      <input type="number" min={MIN_BPM} max={MAX_BPM} step="1"
        bind:value={bpm} onchange={commitBpm} />
    </label>

    <label>
      <span class="label">Beats per measure</span>
      <select bind:value={beatsPerMeasure} onchange={handleBeatsChange}>
        {#each BEATS_OPTIONS as n (n)}
          <option value={n}>{n}</option>
        {/each}
      </select>
    </label>

    <button class="toggle" onclick={toggle}>{running ? '■ Stop' : '▶ Start'}</button>
  </div>

  <div class="beat-row-wrap" bind:this={wrapEl}
    style={availableWidth > 0 ? `width:${availableWidth}px;` : ''}
  >
    <div class="beat-row" bind:clientWidth={actualRowWidth} style="gap:{dotSize * DOT_GAP_RATIO}px;">
      {#each Array(beatsPerMeasure) as _, i (i)}
        <div class="beat-dot" class:accent={i === 0} class:active={running && currentBeat === i}
          style="width:{dotSize}px;height:{dotSize}px;"></div>
      {/each}
    </div>

    <div class="resize-handle" class:dragging bind:clientWidth={handleWidth}
      role="slider" tabindex="0" aria-label="Resize beat indicators"
      aria-valuemin={MIN_DOT_SIZE} aria-valuemax={Math.round(predictedMaxDotSize)} aria-valuenow={Math.round(dotSize)}
      onpointerdown={startDrag} onpointermove={onDrag} onpointerup={endDrag} onpointercancel={endDrag}
      onkeydown={onHandleKeydown}
    >
      <span class="grip"></span>
      <span class="grip-label">resize</span>
    </div>
  </div>
</div>

<style>
  .metronome { display: flex; flex-direction: column; gap: 1.5rem; max-width: 480px; }
  .hint { color: #888; font-size: 0.9rem; }
  .controls { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 1rem; }
  label { display: flex; flex-direction: column; gap: 0.3rem; }
  .label { color: #888; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; }
  select, input[type="number"] {
    padding: 0.5rem 0.6rem; font-size: 1rem; background: #1a1a1a; color: #eee;
    border: 1px solid #444; border-radius: 4px;
  }
  input[type="number"] { width: 5rem; }
  .toggle {
    padding: 0.5rem 1.5rem; font-size: 1rem; cursor: pointer; white-space: nowrap;
    background: #264653; border: none; color: #eee; border-radius: 4px;
  }

  /* Width is set via inline style, computed in JS from real pixel
     measurements (see measureBreakout) — CSS percentage-based breakout tricks
     resolve against the wrong reference width this deep inside a
     max-width-constrained ancestor chain. The wrap's left edge is never
     shifted, so it stays flush with the rest of the page's content; only its
     available width extends toward the screen edge for dragging room. The
     handle sits inline to the right of the dots, vertically centered against
     them regardless of how large they get. */
  .beat-row-wrap {
    display: flex; flex-direction: row; align-items: center; flex-wrap: wrap;
    gap: 1rem; padding: 1rem 0;
  }

  .beat-row { display: flex; align-items: center; flex-wrap: nowrap; width: max-content; }
  .beat-dot {
    box-sizing: border-box; border-radius: 50%; background: #333; border: 2px solid #444; flex-shrink: 0;
    transition: background 0.05s, border-color 0.05s, transform 0.05s;
  }
  .beat-dot.accent { border-color: #6ba8a1; }
  .beat-dot.active { background: #2a9d8f; border-color: #2a9d8f; transform: scale(1.15); }
  .beat-dot.accent.active { background: #e9c46a; border-color: #e9c46a; }

  .resize-handle {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.4rem;
    padding: 0.75rem 0.6rem; cursor: ew-resize; touch-action: none; border-radius: 4px; flex-shrink: 0;
  }
  .resize-handle:hover, .resize-handle:focus-visible, .resize-handle.dragging { background: #1a1a1a; }
  .grip { width: 4px; height: 36px; border-radius: 2px; background: #555; }
  .resize-handle:hover .grip, .resize-handle:focus-visible .grip, .resize-handle.dragging .grip { background: #888; }
  .grip-label { font-size: 0.7rem; color: #555; user-select: none; }
</style>
