<script lang="ts">
  import { onMount } from 'svelte';
  import { drawColumn, MIN_FREQ, MAX_FREQ, freqToY } from '$lib/audio/spectrogramEngine';

  let { fftData = new Float32Array(0), mode = 'live', width = 600, height = 256, sampleRate = 44100 }: {
    fftData?: Float32Array;
    mode?: 'live' | 'static';
    width?: number;
    height?: number;
    sampleRate?: number;
  } = $props();

  let canvas: HTMLCanvasElement;
  let ctx = $state<CanvasRenderingContext2D | null>(null);

  const LABEL_W = 42;
  const TICKS = [200, 300, 500, 700, 1000, 1500, 2000, 3000, 4000, 5000];
  const REF_LINES = [
    { hz: 1047, label: 'C6', color: 'rgb(42,157,143)' },
    { hz: 2093, label: 'C7', color: 'rgb(233,196,106)' },
  ];

  function ty(hz: number) {
    return freqToY(hz, MIN_FREQ, MAX_FREQ, height);
  }

  // Redraws the left label strip — safe to call every frame
  function drawLabels(c: CanvasRenderingContext2D) {
    c.fillStyle = '#111';
    c.fillRect(0, 0, LABEL_W, height);
    c.font = '10px sans-serif';
    c.textAlign = 'right';
    for (const hz of TICKS) {
      const y = ty(hz);
      c.fillStyle = '#555';
      c.fillRect(LABEL_W - 4, y, 4, 1);
      c.fillStyle = '#777';
      c.fillText(hz >= 1000 ? `${hz / 1000}k` : `${hz}`, LABEL_W - 6, y + 4);
    }
    // Ref line labels sit in the label strip so they never scroll or accumulate
    for (const { hz, label, color } of REF_LINES) {
      const y = ty(hz);
      c.fillStyle = color;
      c.globalAlpha = 0.8;
      c.fillText(label, LABEL_W - 6, y + 4);
      c.globalAlpha = 1;
      // tick mark in ref color
      c.fillStyle = color;
      c.fillRect(LABEL_W - 6, y, 6, 1);
    }
  }

  // Draws the full ref lines across the spectrogram — only for init and static render
  function drawRefLinesFull(c: CanvasRenderingContext2D) {
    c.save();
    c.globalAlpha = 0.25;
    c.setLineDash([4, 3]);
    c.lineWidth = 1;
    for (const { hz, color } of REF_LINES) {
      const y = ty(hz);
      c.strokeStyle = color;
      c.beginPath();
      c.moveTo(LABEL_W, y);
      c.lineTo(width, y);
      c.stroke();
    }
    c.restore();
  }

  // Draws just the newest rightmost pixel of each ref line — for the live scroll loop
  function drawRefLinePixel(c: CanvasRenderingContext2D, x: number) {
    c.save();
    c.globalAlpha = 0.25;
    for (const { hz, color } of REF_LINES) {
      const y = ty(hz);
      c.fillStyle = color;
      c.fillRect(x, y, 1, 1);
    }
    c.restore();
  }

  onMount(() => {
    ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(LABEL_W, 0, width - LABEL_W, height);
    drawLabels(ctx);
    drawRefLinesFull(ctx);
  });

  $effect(() => {
    if (mode === 'live' && ctx && fftData.length > 0) {
      // Scroll only the spectrogram area one pixel left
      ctx.drawImage(canvas, LABEL_W, 0, width - LABEL_W, height, LABEL_W - 1, 0, width - LABEL_W, height);
      // Draw new spectrogram column at right edge
      drawColumn(ctx, fftData, sampleRate, width - 1, height);
      // Extend ref lines by one pixel — scroll carries the rest
      drawRefLinePixel(ctx, width - 1);
      // Redraw label strip (never scrolls, always clean)
      drawLabels(ctx);
    }
  });

  export function snapshot(): string | null {
    return canvas ? canvas.toDataURL() : null;
  }
</script>

<canvas bind:this={canvas} {width} {height} style="display:block;border-radius:4px;"></canvas>
