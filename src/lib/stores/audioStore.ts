import { writable, derived } from 'svelte/store';
import { startAudio, stopAudio } from '$lib/audio/audioContext';
import { detectPitch, frequencyToNote } from '$lib/audio/pitchDetector';

export type PitchInfo = { note: string; cents: number; frequency: number } | null;

const _pitch = writable<PitchInfo>(null);
const _fft = writable<Float32Array>(new Float32Array(0));
const _level = writable<number>(0);
const _sampleRate = writable<number>(44100);

export const pitchStore = derived(_pitch, p => p);
export const fftStore = derived(_fft, f => f);
export const levelStore = derived(_level, l => l);
export const sampleRateStore = derived(_sampleRate, s => s);

let running = false;

export async function startListening(): Promise<void> {
  if (running) return;
  running = true;
  await startAudio((timeDomain, frequency, sampleRate) => {
    let rms = 0;
    for (let i = 0; i < timeDomain.length; i++) rms += timeDomain[i] ** 2;
    _level.set(Math.min(1, Math.sqrt(rms / timeDomain.length) * 10));

    const hz = detectPitch(timeDomain, sampleRate);
    _pitch.set(hz > 0 ? frequencyToNote(hz) : null);

    _fft.set(frequency.slice());
    _sampleRate.set(sampleRate);
  });
}

export function stopListening(): void {
  running = false;
  stopAudio();
  _pitch.set(null);
  _level.set(0);
}
