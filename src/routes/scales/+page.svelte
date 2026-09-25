<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import {
    KEYED_SCALE_TYPES, buildScale, buildChromaticRange, keySignature, lowestTonic, maxOctaves, pitchName, tonicLabel, tonicsFor, toMidi,
    type ScaleTypeId
  } from '$lib/music/scales';
  import {
    FINGERING_MIN_MIDI, FINGERING_MAX_MIDI, fingeringsFor, keyLabels, cycleIndex, chooseFingering
  } from '$lib/music/fingerings';
  import { loadPins, savePins, type Pins } from '$lib/music/fingeringPins';
  import {
    MIN_BPM, MAX_BPM, clampBpm,
    startMetronome, stopMetronome, setMetronomeBpm
  } from '$lib/audio/metronome';
  import { NOTE_LENGTHS, accentEvery, totalBeats, noteIndexAt, beatWithinNote } from '$lib/music/practice';
  import { startListening, stopListening, pitchStore, levelStore } from '$lib/stores/audioStore';
  import ScaleStaff from '$lib/components/ScaleStaff.svelte';
  import FingeringChart from '$lib/components/FingeringChart.svelte';
  import MiniTuner from '$lib/components/MiniTuner.svelte';

  // The key selector doubles as the chromatic switch: a chromatic scale has no
  // tonic and no key signature, so "no key" is a choice of key, not a mode.
  const CHROMATIC = 'chromatic';
  let keyChoice = $state<number | typeof CHROMATIC>(0);
  let typeId = $state<ScaleTypeId>('major');

  let isChromatic = $derived(keyChoice === CHROMATIC);
  // Anchored on C, which spells cleanly ascending and covers C4-C6 over two
  // octaves — the whole practical range — without needing a key.
  let tonicPc = $derived(isChromatic ? 0 : (keyChoice as number));
  let activeType = $derived<ScaleTypeId>(isChromatic ? 'chromatic' : typeId);
  // Whole octaves, or — chromatic only — every note the instrument has.
  const FULL = 'full';
  let octaves = $state<number | typeof FULL>(1);
  let bpm = $state(80);
  let beatsPerNote = $state(1);
  let running = $state(false);
  let noteIndex = $state(0);
  let beatInNote = $state(0);
  let micOn = $state(false);

  // Beats since the run started, owned here rather than read back off the
  // metronome: the engine's own counter resets each measure, and a measure is
  // one held note in 4/4 but the whole scale at one note per click.
  let beatsElapsed = 0;

  // Both tonic tables are indexed by pitch class, so switching between major
  // and minor keeps the key and only changes how it's spelled (D♭ major
  // becomes C♯ minor rather than an unreadable D♭ minor). Keyed off the mode
  // rather than the active type, so the key list doesn't re-spell itself while
  // chromatic is selected.
  let tonics = $derived(tonicsFor(typeId));
  let keyLabel = $derived(isChromatic ? 'Chromatic' : tonicLabel(tonics[tonicPc]));
  let signature = $derived(keySignature(tonics[tonicPc], activeType));
  let tonic = $derived(lowestTonic(tonics[tonicPc], FINGERING_MIN_MIDI));
  let availableOctaves = $derived(
    maxOctaves(tonics[tonicPc], FINGERING_MIN_MIDI, FINGERING_MAX_MIDI)
  );
  let fullRange = $derived(isChromatic && octaves === FULL);
  let effectiveOctaves = $derived(Math.min(octaves === FULL ? 2 : octaves, availableOctaves));

  let run = $derived(
    fullRange
      ? buildChromaticRange(FINGERING_MIN_MIDI, FINGERING_MAX_MIDI)
      : buildScale(tonic, activeType, effectiveOctaves)
  );
  // A click already queued against the previous scale's measure length can
  // land one beat past the end of a freshly shortened run, so every read of
  // the position goes through the clamped index.
  let position = $derived(Math.min(noteIndex, run.notes.length - 1));
  let currentPitch = $derived(run.notes[position]);
  let currentMidi = $derived(toMidi(currentPitch));
  // Alternate fingerings. A pin is remembered per note and comes back every
  // time that note does; `peek` is a choice made on the spot for the note on
  // screen right now, and is dropped as soon as the run moves to another note —
  // which is what "not pinned" means.
  let pins = $state<Pins>({});
  let peek = $state<number | null>(null);
  onMount(() => { pins = loadPins(); });

  let options = $derived(fingeringsFor(currentMidi));
  let pinnedIndex = $derived(options.findIndex((f) => f.name === pins[currentMidi]));
  let choice = $derived(chooseFingering(options.length, pinnedIndex, peek));
  let currentKeys = $derived(options[choice]?.keys ?? []);
  let currentLabels = $derived(keyLabels(currentKeys));
  let isPinned = $derived(pinnedIndex !== -1 && pinnedIndex === choice);

  function stepFingering(step: number) {
    peek = cycleIndex(choice, options.length, step);
  }

  function togglePin() {
    const next = { ...pins };
    if (isPinned) {
      delete next[currentMidi];
      // Keep showing what was pinned rather than snapping back to the default
      // under the reader's eyes; it lapses when the run moves on.
      peek = choice;
    } else {
      next[currentMidi] = options[choice].name;
      peek = null;
    }
    pins = next;
    savePins(next);
  }
  let direction = $derived(position === run.turnaround ? 'top' : position < run.turnaround ? 'up' : 'down');

  function startPlayback() {
    // Captured up front so the click callback never reads reactive state: the
    // engine is restarted whenever any of these change anyway.
    const noteCount = run.notes.length;
    const perNote = beatsPerNote;
    const total = totalBeats(noteCount, perNote);
    const accent = accentEvery(noteCount, perNote);

    // Playback picks up at whichever note is highlighted — the one clicked on
    // the staff, or wherever the last stop left it. Handing the engine the
    // matching beat of the measure keeps the accent where it would have fallen
    // had the run played from the top, so starting from the middle doesn't
    // move the downbeat onto an off-beat.
    beatsElapsed = (position * perNote) % total;
    startMetronome(bpm, accent, () => {
      const next = noteIndexAt(beatsElapsed, perNote);
      if (next !== noteIndex) { noteIndex = next; peek = null; }
      beatInNote = beatWithinNote(beatsElapsed, perNote);
      beatsElapsed = (beatsElapsed + 1) % total;
    }, beatsElapsed % accent);
    running = true;
  }

  function stopPlayback() {
    stopMetronome();
    running = false;
    beatInNote = 0;
  }

  function toggle() {
    if (running) stopPlayback();
    else startPlayback();
  }

  // Changing the scale changes the measure length, so the click engine has to
  // be re-seeded rather than nudged — and the old position no longer refers to
  // the same note, so it goes back to the tonic.
  function onScaleChange() {
    // Full range only means something for chromatic; leaving chromatic takes
    // the widest keyed setting instead of silently dropping to one octave.
    if (octaves === FULL && !isChromatic) octaves = 2;
    noteIndex = 0;
    peek = null;
    if (running) { stopPlayback(); startPlayback(); }
  }

  // The note length also changes the measure, but the scale itself is
  // unchanged, so the position on the staff is still meaningful and is kept.
  function onTimingChange() {
    if (running) { stopPlayback(); startPlayback(); }
  }

  // Picking a note off the staff stops the run and parks the highlight there,
  // ready for Start to pick it up.
  function selectNote(index: number) {
    if (running) stopPlayback();
    noteIndex = index;
    peek = null;
    beatInNote = 0;
  }

  function commitBpm() {
    bpm = clampBpm(bpm, 80);
    if (running) setMetronomeBpm(bpm);
  }

  async function toggleMic() {
    if (micOn) { stopListening(); micOn = false; }
    else { await startListening(); micOn = true; }
  }

  onDestroy(() => { stopMetronome(); stopListening(); });
</script>

<!-- The fingering chart is a tall portrait drawing, so it runs alongside the
     controls rather than under them: stacking the two would push the staff and
     tuner below the fold on a laptop screen. -->
<div class="layout">
  <div class="main">
    <p class="hint">Pick a key, tempo and note length, then play along — the staff advances on the click. Click any note to start from there.</p>

    <div class="controls">
      <label>
        <span class="label">Key</span>
        <select bind:value={keyChoice} onchange={onScaleChange}>
          {#each tonics as t, pc (pc)}
            <option value={pc}>{tonicLabel(t)}</option>
          {/each}
          <option value={CHROMATIC}>Chromatic</option>
        </select>
      </label>

      <label class:dimmed={isChromatic}>
        <span class="label">Scale</span>
        <select bind:value={typeId} onchange={onScaleChange} disabled={isChromatic}
          title={isChromatic ? 'A chromatic scale has no key or mode' : undefined}>
          {#each KEYED_SCALE_TYPES as s (s.id)}
            <option value={s.id}>{s.label}</option>
          {/each}
        </select>
      </label>

      <label>
        <span class="label">Octaves</span>
        <select bind:value={octaves} onchange={onScaleChange}>
          <option value={1}>1</option>
          <option value={2} disabled={availableOctaves < 2}>2</option>
          {#if isChromatic}
            <option value={FULL}>Full range</option>
          {/if}
        </select>
      </label>

      <label>
        <span class="label">Note length</span>
        <select bind:value={beatsPerNote} onchange={onTimingChange}>
          {#each NOTE_LENGTHS as n (n.beats)}
            <option value={n.beats}>{n.label}</option>
          {/each}
        </select>
      </label>

      <label>
        <span class="label">Tempo</span>
        <input type="number" min={MIN_BPM} max={MAX_BPM} step="1" bind:value={bpm} onchange={commitBpm} />
      </label>

      <button class="toggle" onclick={toggle}>{running ? '■ Stop' : '▶ Start'}</button>

      <button class="mic" class:on={micOn} onclick={toggleMic}
        title="Audio is analyzed in your browser and never uploaded">
        {micOn ? 'Mic on' : 'Start Mic'}
      </button>
    </div>

    {#if octaves === 2 && availableOctaves < 2 && !isChromatic}
      <p class="warn">Two octaves of {keyLabel} would run past the oboe's range — playing one octave.</p>
    {/if}

    <div class="now">
      <span class="now-note">{pitchName(currentPitch)}</span>
      <span>note {position + 1} of {run.notes.length}</span>
      <span class="dir">{direction === 'up' ? '↗ ascending' : direction === 'down' ? '↘ descending' : '▲ top'}</span>
      {#if beatsPerNote > 1}
        <span class="beats" aria-label="beat {beatInNote + 1} of {beatsPerNote}">
          {#each Array(beatsPerNote) as _, i (i)}
            <span class="beat-dot" class:on={running && i === beatInNote} class:downbeat={i === 0}></span>
          {/each}
        </span>
      {/if}
    </div>

    <ScaleStaff notes={run.notes} current={position} onselect={selectNote} follow={running} keySignature={signature} />

    <div class="tuner-row">
      <MiniTuner pitch={$pitchStore} level={$levelStore} targetMidi={currentMidi} running={micOn} />
      {#if !micOn}
        <p class="mic-note">Mic audio is analyzed in your browser and never uploaded.</p>
      {/if}
    </div>
  </div>

  <aside class="fingering">
    <FingeringChart keys={currentKeys} />

    {#if options.length > 1}
      <div class="alt" role="group" aria-label="Alternate fingerings for {pitchName(currentPitch)}">
        <div class="alt-row">
          <button class="arrow" onclick={() => stepFingering(-1)} aria-label="Previous fingering">&#x2039;</button>
          <span class="alt-name" aria-live="polite">
            {options[choice].name}
            <span class="alt-count">{choice + 1}/{options.length} · {options[choice].sources.join(', ')}</span>
          </span>
          <button class="arrow" onclick={() => stepFingering(1)} aria-label="Next fingering">&#x203A;</button>
        </div>
        <button class="pin" class:on={isPinned} aria-pressed={isPinned} onclick={togglePin}
          title={isPinned
            ? `Unpin — ${pitchName(currentPitch)} goes back to the typical fingering next time`
            : `Always use this fingering for ${pitchName(currentPitch)}`}>
          <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
            <path fill="currentColor" d="M9.5 1.5l5 5-1.4 1.4-.9-.9-2.6 2.6.3 3.3-1.4 1.4-2.7-2.7-3.5 3.5-1.3-1.3 3.5-3.5-2.7-2.7 1.4-1.4 3.3.3 2.6-2.6-.9-.9z" />
          </svg>
          {isPinned ? 'Pinned' : 'Pin'}
        </button>
      </div>
    {/if}
    <p class="keys">
      {#if currentLabels.length === 0}
        all keys open
      {:else}
        {currentLabels.join(' · ')}
      {/if}
    </p>
  </aside>
</div>

<style>
  /* The chart is 114.78 x 302.64 in its own viewBox — 0.379 wide per unit of
     height. Sizing its column by that ratio against the remaining viewport
     height keeps the whole instrument on screen, and the 160px cap stops it
     from crowding the staff on a tall display. */
  .layout {
    --chart-height: calc(100vh - 10rem);
    --chart-width: min(160px, calc(var(--chart-height) * 0.379));
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--chart-width);
    gap: 1.25rem;
    align-items: start;
  }

  .main { display: flex; flex-direction: column; gap: 0.9rem; min-width: 0; }
  .hint { color: #888; font-size: 0.9rem; }

  .beats { display: inline-flex; gap: 0.3rem; align-items: center; }
  .beat-dot { width: 8px; height: 8px; border-radius: 50%; background: #333; border: 1px solid #444; }
  .beat-dot.downbeat { border-color: #6ba8a1; }
  .beat-dot.on { background: #2a9d8f; border-color: #2a9d8f; }
  .beat-dot.downbeat.on { background: #e9c46a; border-color: #e9c46a; }
  .warn { color: #e9c46a; font-size: 0.8rem; }

  /* Two rows rather than one long one: it keeps the control block narrow
     enough to sit beside the chart, and the columns self-size to the widest
     control in each. Row one is what to play, row two is how and when. */
  .controls {
    display: grid;
    grid-template-columns: repeat(4, auto);
    justify-content: start;
    align-items: end;
    gap: 0.6rem 1rem;
  }
  label { display: flex; flex-direction: column; gap: 0.25rem; }
  .label { color: #888; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .dimmed .label { color: #555; }
  select:disabled {
    color: #555; background: #141414; border-color: #2c2c2c; cursor: not-allowed;
    /* Safari otherwise fades the whole control to near-invisible. */
    opacity: 1; -webkit-text-fill-color: #555;
  }
  select, input[type="number"] {
    padding: 0.4rem 0.5rem; font-size: 0.95rem; background: #1a1a1a; color: #eee;
    border: 1px solid #444; border-radius: 4px; width: 100%;
  }
  .toggle, .mic {
    padding: 0.45rem 1rem; font-size: 0.95rem; cursor: pointer; white-space: nowrap;
    background: #264653; border: none; color: #eee; border-radius: 4px;
  }
  .mic { background: #2f2f2f; }
  .mic.on { background: #2a9d8f; }

  .now { display: flex; align-items: baseline; gap: 0.9rem; flex-wrap: wrap; color: #777; font-size: 0.8rem; }
  .now-note { font-size: 1.9rem; font-weight: bold; color: #2a9d8f; line-height: 1; }
  .dir { color: #999; }

  .tuner-row { display: flex; flex-direction: column; gap: 0.4rem; }
  .mic-note { color: #666; font-size: 0.75rem; }

  .fingering { position: sticky; top: 1rem; display: flex; flex-direction: column; gap: 0.4rem; --chart-max-height: var(--chart-height); }
  .keys { color: #777; font-size: 0.7rem; line-height: 1.5; }

  .alt { display: flex; flex-direction: column; gap: 0.35rem; }
  .alt-row { display: flex; align-items: center; gap: 0.25rem; }
  .arrow {
    flex: 0 0 auto; width: 1.7rem; height: 1.7rem; border-radius: 4px; cursor: pointer;
    background: #1f1f1f; border: 1px solid #3a3a3a; color: #ccc; font-size: 1.1rem; line-height: 1;
  }
  .arrow:hover { background: #2a2a2a; color: #fff; }
  .alt-name {
    flex: 1; min-width: 0; text-align: center; font-size: 0.75rem; color: #ddd;
    display: flex; flex-direction: column; line-height: 1.25;
  }
  .alt-count { font-size: 0.65rem; color: #777; font-variant-numeric: tabular-nums; }
  .pin {
    display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem;
    padding: 0.3rem 0.5rem; font-size: 0.72rem; cursor: pointer; border-radius: 4px;
    background: transparent; border: 1px solid #3a3a3a; color: #999;
  }
  .pin:hover { color: #ddd; border-color: #555; }
  .pin.on { background: #1f3a37; border-color: #2a9d8f; color: #7fd1c6; }

  @media (max-width: 720px) {
    .layout { grid-template-columns: 1fr; }
    .fingering { position: static; width: var(--chart-width); }
  }
</style>
