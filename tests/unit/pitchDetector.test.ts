import { describe, it, expect } from 'vitest';
import { detectPitch, frequencyToNote } from '$lib/audio/pitchDetector';

function makeSineWave(freq: number, sampleRate: number, length: number): Float32Array {
  const buf = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    buf[i] = Math.sin(2 * Math.PI * freq * i / sampleRate);
  }
  return buf;
}

describe('detectPitch', () => {
  it('detects 440 Hz sine wave', () => {
    const buf = makeSineWave(440, 44100, 4096);
    const result = detectPitch(buf, 44100);
    expect(result).toBeGreaterThan(435);
    expect(result).toBeLessThan(445);
  });

  it('returns -1 for silence', () => {
    const buf = new Float32Array(4096);
    expect(detectPitch(buf, 44100)).toBe(-1);
  });

  it('detects C5 (~523 Hz)', () => {
    const buf = makeSineWave(523.25, 44100, 4096);
    const result = detectPitch(buf, 44100);
    expect(result).toBeGreaterThan(518);
    expect(result).toBeLessThan(528);
  });
});

describe('frequencyToNote', () => {
  it('maps 440 Hz to A4 with 0 cents', () => {
    const result = frequencyToNote(440);
    expect(result.note).toBe('A4');
    expect(result.cents).toBe(0);
  });

  it('maps 523.25 Hz to C5', () => {
    const result = frequencyToNote(523.25);
    expect(result.note).toBe('C5');
  });

  it('maps 450 Hz to A4 sharp (~39 cents sharp)', () => {
    const result = frequencyToNote(450);
    expect(result.note).toBe('A4');
    expect(result.cents).toBeGreaterThan(35);
    expect(result.cents).toBeLessThan(42);
  });
});
