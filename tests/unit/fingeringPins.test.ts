import { describe, it, expect, beforeEach } from 'vitest';
import { parsePins, loadPins, savePins } from '$lib/music/fingeringPins';

describe('parsePins', () => {
  it('reads back valid pins', () => {
    const pins = { 65: 'Forked F', 77: 'Left F key' };
    expect(parsePins(JSON.stringify(pins))).toEqual(pins);
  });

  it('starts empty with nothing stored', () => {
    expect(parsePins(null)).toEqual({});
    expect(parsePins('')).toEqual({});
  });

  it('shrugs off corrupt storage instead of throwing', () => {
    expect(parsePins('{not json')).toEqual({});
    expect(parsePins('[1,2]')).toEqual({});
    expect(parsePins('"text"')).toEqual({});
    expect(parsePins('null')).toEqual({});
  });

  it('drops pins that no longer point at a real alternate', () => {
    expect(parsePins(JSON.stringify({
      65: 'Forked F',       // kept
      65.5: 'Forked F',     // not a note
      66: 'Forked F',       // F#4 has no such fingering
      77: 'Sideways F',     // no fingering by that name
      63: 1,                // old index-style pin
      200: 'Standard'       // off the chart
    }))).toEqual({ 65: 'Forked F' });
  });
});

describe('loadPins / savePins', () => {
  it('ignores pins saved in the old index-based format', () => {
    localStorage.clear();
    localStorage.setItem('obt.fingeringPins.v1', JSON.stringify({ 65: 1 }));
    expect(loadPins()).toEqual({});
  });

  beforeEach(() => localStorage.clear());

  it('round-trips through storage', () => {
    savePins({ 65: 'Forked F', 63: 'Left E\u266D key' });
    expect(loadPins()).toEqual({ 65: 'Forked F', 63: 'Left E\u266D key' });
  });

  it('forgets an unpinned note', () => {
    savePins({ 65: 'Forked F', 63: 'Left E\u266D key' });
    savePins({ 63: 'Left E\u266D key' });
    expect(loadPins()).toEqual({ 63: 'Left E\u266D key' });
  });
});
