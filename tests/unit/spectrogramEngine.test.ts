import { describe, it, expect } from 'vitest';
import { freqToY, yToFreq, dbToColor } from '$lib/audio/spectrogramEngine';

describe('freqToY', () => {
  it('maps minFreq to bottom (height)', () => {
    expect(freqToY(200, 200, 3000, 256)).toBe(256);
  });

  it('maps maxFreq to top (0)', () => {
    expect(freqToY(3000, 200, 3000, 256)).toBe(0);
  });

  it('maps midpoint correctly (log scale)', () => {
    const mid = Math.sqrt(200 * 3000);
    const y = freqToY(mid, 200, 3000, 256);
    expect(y).toBeGreaterThan(100);
    expect(y).toBeLessThan(160);
  });
});

describe('yToFreq', () => {
  it('is the inverse of freqToY', () => {
    for (const freq of [200, 523, 1047, 2093, 3000]) {
      const y = freqToY(freq, 200, 3000, 256);
      const back = yToFreq(y, 200, 3000, 256);
      expect(Math.abs(back - freq) / freq).toBeLessThan(0.02);
    }
  });

  it('maps bottom (height) to minFreq', () => {
    expect(yToFreq(256, 200, 3000, 256)).toBeCloseTo(200, 0);
  });

  it('maps top (0) to maxFreq', () => {
    expect(yToFreq(0, 200, 3000, 256)).toBeCloseTo(3000, 0);
  });
});

describe('dbToColor', () => {
  it('returns dark color for silence (-100 dB)', () => {
    const [r, g, b] = dbToColor(-100);
    expect(r + g + b).toBeLessThan(50);
  });

  it('returns bright color for loud signal (0 dB)', () => {
    const [r, g, b] = dbToColor(0);
    expect(r + g + b).toBeGreaterThan(400);
  });

  it('returns values in 0-255 range', () => {
    const vals = dbToColor(-50);
    for (const v of vals) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
    }
  });
});
