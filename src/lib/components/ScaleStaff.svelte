<script lang="ts">
  import type { Pitch } from '$lib/music/scales';
  import { pitchName, pitchNameNoOctave, toDiatonic } from '$lib/music/scales';
  import {
    LINE_GAP, STAFF_TOP, SYSTEM_HEIGHT, SIDE_PADDING, LEDGER_HALF_WIDTH, NAME_ROW_Y, CLEF_WIDTH, KEYSIG_STEP,
    yForDiatonic, yForPitch, ledgerLines, stemUp, noteX, noteSpacingFor, systemWidth, notesPerSystem, intoSystems,
    clefTransform, keySignaturePitches, headerWidth, glyphTransform, ACCIDENTAL_GAP
  } from '$lib/music/notation';
  import { CLEF_PATH } from '$lib/music/clefPath';
  import { accidentalGlyph } from '$lib/music/accidentalGlyphs';

  let {
    notes = [],
    current = -1,
    showNames = true,
    onselect,
    follow = false,
    keySignature = 0
  }: {
    notes?: Pitch[];
    current?: number;
    showNames?: boolean;
    /** Called with the index of a note the reader picks off the staff. */
    onselect?: (index: number) => void;
    /** Keep the current note on screen as it moves — for runs long enough to wrap off the page. */
    follow?: boolean;
    /** Sharps (positive) or flats (negative), repeated at the head of every line. */
    keySignature?: number;
  } = $props();

  let signature = $derived(keySignaturePitches(keySignature));
  let header = $derived(headerWidth(keySignature));

  let wrap: HTMLDivElement | undefined = $state();

  // Only scrolls when the note has actually left the viewport ('nearest'), so a
  // staff that fits on screen never moves.
  $effect(() => {
    if (!follow || !wrap || current < 0) return;
    const el = wrap.querySelector('[aria-current="true"]');
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

  function pick(index: number) {
    onselect?.(index);
  }

  function onKeydown(event: KeyboardEvent, index: number) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      pick(index);
    }
  }

  let containerWidth = $state(0);

  // Each note carries its own index in the full scale so the highlight still
  // resolves after the run has been chopped into systems.
  let laidOut = $derived(
    notes.map((pitch, index) => {
      const y = yForDiatonic(toDiatonic(pitch));
      return { pitch, index, y, ledgers: ledgerLines(y), up: stemUp(y) };
    })
  );

  let perSystem = $derived(notesPerSystem(containerWidth, Math.max(1, notes.length), header));
  let systems = $derived(intoSystems(laidOut, perSystem));
</script>

<div class="staff-wrap" bind:clientWidth={containerWidth} bind:this={wrap}>
  {#each systems as system, s (s)}
    {@const spacing = noteSpacingFor(containerWidth, system.length, header)}
    {@const width = systemWidth(containerWidth, system.length, spacing, header)}
    <svg
      class="system"
      viewBox="0 0 {width} {SYSTEM_HEIGHT}"
      width={width}
      height={SYSTEM_HEIGHT}
      role="img"
      aria-label={s === 0 ? `Scale: ${notes.map(pitchName).join(', ')}` : ''}
    >
      {#each [0, 1, 2, 3, 4] as i (i)}
        <line
          class="staff-line"
          x1={SIDE_PADDING} x2={width - SIDE_PADDING}
          y1={STAFF_TOP + i * LINE_GAP} y2={STAFF_TOP + i * LINE_GAP}
        />
      {/each}

      <path class="clef" d={CLEF_PATH} transform={clefTransform()} />

      {#each signature as acc, k (k)}
        <path class="keysig" d={accidentalGlyph(acc.alter)?.d}
          transform={glyphTransform(SIDE_PADDING + CLEF_WIDTH + k * KEYSIG_STEP, yForPitch(acc))} />
      {/each}

      {#each system as n, i (n.index)}
        {@const x = noteX(i, spacing, header)}
        {@const glyph = accidentalGlyph(n.pitch.alter)}
        <!-- The whole vertical strip is the hit target, not the notehead:
             a 6x5 ellipse is far too small to click reliably, and the strip
             makes "which note did I hit" obvious from the hover highlight. -->
        <g
          class="note" class:active={n.index === current}
          role="button" tabindex="0"
          aria-label="Play from {pitchName(n.pitch)}, note {n.index + 1}"
          aria-current={n.index === current ? 'true' : undefined}
          onclick={() => pick(n.index)}
          onkeydown={(e) => onKeydown(e, n.index)}
        >
          <rect class="hit" x={x - spacing / 2} y="2" width={spacing} height={SYSTEM_HEIGHT - 4} rx="3" />
          {#each n.ledgers as ly, li (li)}
            <line class="ledger" x1={x - LEDGER_HALF_WIDTH} x2={x + LEDGER_HALF_WIDTH} y1={ly} y2={ly} />
          {/each}

          {#if n.index === current}
            <circle class="halo" cx={x} cy={n.y} r="13" />
          {/if}

          {#if glyph}
            <path class="accidental" d={glyph.d}
              transform={glyphTransform(x - ACCIDENTAL_GAP - glyph.width * LINE_GAP, n.y)} />
          {/if}

          <line
            class="stem"
            x1={n.up ? x + 5.6 : x - 5.6} x2={n.up ? x + 5.6 : x - 5.6}
            y1={n.y} y2={n.up ? n.y - 30 : n.y + 30}
          />
          <ellipse class="head" cx={x} cy={n.y} rx="6.2" ry="4.6" transform="rotate(-20 {x} {n.y})" />

          {#if showNames}
            <text class="note-name" x={x} y={NAME_ROW_Y} text-anchor="middle">{pitchNameNoOctave(n.pitch)}</text>
          {/if}
        </g>
      {/each}
    </svg>
  {/each}
</div>

<style>
  .staff-wrap { display: flex; flex-direction: column; gap: 0.25rem; width: 100%; overflow-x: auto; }
  .system { display: block; width: 100%; max-width: 100%; height: auto; }
  .staff-line, .ledger { stroke: #6a6a6a; stroke-width: 1; }
  .clef { fill: #ccc; }
  .keysig { fill: #ccc; }
  .head { fill: #ddd; }
  .stem { stroke: #ddd; stroke-width: 1.6; }
  .accidental { fill: #ddd; }
  .note-name { font-size: 10px; fill: #666; font-family: sans-serif; }
  .halo { fill: #2a9d8f; opacity: 0.22; }

  .note { cursor: pointer; outline: none; scroll-margin-top: 6rem; scroll-margin-bottom: 1rem; }
  .hit { fill: #fff; fill-opacity: 0; pointer-events: all; transition: fill-opacity 0.1s; }
  .note:hover .hit { fill-opacity: 0.05; }
  .note:focus-visible .hit { fill: #2a9d8f; fill-opacity: 0.16; stroke: #2a9d8f; stroke-width: 1; }
  .note.active .head { fill: #2a9d8f; }
  .note.active .stem { stroke: #2a9d8f; }
  .note.active .accidental { fill: #2a9d8f; }
  .note.active .note-name { fill: #2a9d8f; font-weight: bold; }
</style>
