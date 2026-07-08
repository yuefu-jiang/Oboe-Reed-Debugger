import { describe, it, expect } from 'vitest';
import { secondsPerBeat, nextBeatIndex, clampBpm, MIN_BPM, MAX_BPM, BEATS_OPTIONS } from '$lib/audio/metronome';

describe('secondsPerBeat', () => {
  it('converts 60 BPM to exactly 1 second per beat', () => {
    expect(secondsPerBeat(60)).toBe(1);
  });

  it('converts 120 BPM to 0.5 seconds per beat', () => {
    expect(secondsPerBeat(120)).toBe(0.5);
  });

  it('converts 40 BPM correctly', () => {
    expect(secondsPerBeat(40)).toBeCloseTo(1.5, 10);
  });
});

describe('nextBeatIndex', () => {
  it('advances within a measure', () => {
    expect(nextBeatIndex(0, 4)).toBe(1);
    expect(nextBeatIndex(1, 4)).toBe(2);
    expect(nextBeatIndex(2, 4)).toBe(3);
  });

  it('wraps back to 0 after the last beat', () => {
    expect(nextBeatIndex(3, 4)).toBe(0);
  });

  it('handles a 1-beat measure (every beat is beat 0)', () => {
    expect(nextBeatIndex(0, 1)).toBe(0);
  });
});

describe('clampBpm', () => {
  it('passes through a value already in range', () => {
    expect(clampBpm(120, 120)).toBe(120);
  });

  it('rounds a fractional value to the nearest whole number', () => {
    expect(clampBpm(120.6, 120)).toBe(121);
  });

  it('clamps below MIN_BPM up to MIN_BPM', () => {
    expect(clampBpm(1, 120)).toBe(MIN_BPM);
    expect(clampBpm(0, 120)).toBe(MIN_BPM);
    expect(clampBpm(-50, 120)).toBe(MIN_BPM);
  });

  it('clamps above MAX_BPM down to MAX_BPM', () => {
    expect(clampBpm(10000, 120)).toBe(MAX_BPM);
  });

  it('falls back for non-finite input (e.g. an emptied field)', () => {
    expect(clampBpm(NaN, 120)).toBe(120);
    expect(clampBpm(Infinity, 90)).toBe(90);
  });
});

describe('BEATS_OPTIONS', () => {
  it('includes common time signatures', () => {
    expect(BEATS_OPTIONS).toContain(2);
    expect(BEATS_OPTIONS).toContain(3);
    expect(BEATS_OPTIONS).toContain(4);
  });
});
