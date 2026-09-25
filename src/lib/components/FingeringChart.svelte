<script lang="ts">
  // The chart is inlined (rather than dropped in an <img>) so the individual
  // key shapes stay reachable from script — every key in fingering-chart.svg
  // carries a semantic id, which is what lets a fingering be expressed as a
  // list of ids instead of a second set of hand-placed coordinates.
  import rawChart from '../../../fingering-chart.svg?raw';
  import { inlineSvg, applyFingering } from './fingeringChartDom';

  let { keys = [] }: { keys?: string[] } = $props();

  const chartSvg = inlineSvg(rawChart);

  let host: HTMLDivElement | undefined = $state();

  $effect(() => {
    if (host) applyFingering(host, keys);
  });
</script>

<div class="chart" bind:this={host}>
  {@html chartSvg}
</div>
<p class="legend">
  <svg viewBox="0 0 20 23" width="13" height="15" aria-hidden="true">
    <path d="M 9.6,18 A 8,8 0 1 1 14.3,15.6 L 13.2,21 Z M 5,10 A 3,3 0 1 1 11,10 A 3,3 0 1 1 5,10 Z"
      fill="#2a9d8f" fill-rule="evenodd" stroke="#888" stroke-width="1" stroke-linejoin="round" />
  </svg>
  colored ring on LH1 = half-hole
</p>

<style>
  /* The artwork is drawn for paper — light fills, dark outlines — so it gets
     its own light card rather than being recolored wholesale. */
  .chart {
    background: #fbfbfb;
    max-height: var(--chart-max-height, none);
    border: 1px solid #333;
    border-radius: 8px;
    padding: 0.5rem;
    display: flex;
    justify-content: center;
  }

  /* Overrides the mm width/height baked in by Inkscape so the drawing scales
     to whatever column it lands in; the viewBox keeps the aspect ratio. */
  .chart :global(svg) {
    width: 100%;
    height: auto;
    max-height: 100%;
    display: block;
  }

  /* Inkscape writes fills as inline style attributes, which outrank a plain
     selector — hence !important. Only the fill changes; the outlines stay dark
     so an unpressed key next to a pressed one is still readable. */
  .chart :global(.key-active) {
    fill: #2a9d8f !important;
    fill-opacity: 1 !important;
  }
  .chart :global(line.key-active) {
    stroke: #2a9d8f !important;
  }

  .legend {
    display: flex; align-items: center; gap: 0.35rem;
    margin-top: 0.35rem; font-size: 0.68rem; color: #777;
  }
</style>
