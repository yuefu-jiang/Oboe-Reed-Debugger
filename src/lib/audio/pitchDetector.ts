const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function detectPitch(buffer: Float32Array, sampleRate: number): number {
  let rms = 0;
  for (let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / buffer.length);
  if (rms < 0.01) return -1;

  const SIZE = buffer.length;
  const corr = new Float32Array(SIZE);
  for (let lag = 0; lag < SIZE; lag++) {
    let sum = 0;
    for (let i = 0; i < SIZE - lag; i++) sum += buffer[i] * buffer[i + lag];
    corr[lag] = sum;
  }

  let i = 1;
  while (i < SIZE && corr[i] > corr[i - 1]) i++;
  while (i < SIZE && corr[i] < corr[i - 1]) i++;

  let maxVal = -Infinity;
  let maxI = i;
  for (let j = i; j < SIZE; j++) {
    if (corr[j] > maxVal) { maxVal = corr[j]; maxI = j; }
  }

  if (maxVal < 0.5 * corr[0]) return -1;

  const x0 = maxI > 0 ? corr[maxI - 1] : corr[maxI];
  const x2 = maxI < SIZE - 1 ? corr[maxI + 1] : corr[maxI];
  const shift = (x2 - x0) / (2 * (2 * corr[maxI] - x2 - x0));

  return sampleRate / (maxI + shift);
}

export function frequencyToNote(freq: number): { note: string; cents: number; frequency: number } {
  const semitones = 12 * Math.log2(freq / 440);
  const rounded = Math.round(semitones);
  const cents = Math.round((semitones - rounded) * 100);
  const midiNote = rounded + 69;
  const octave = Math.floor(midiNote / 12) - 1;
  const name = NOTE_NAMES[((midiNote % 12) + 12) % 12];
  return { note: `${name}${octave}`, cents, frequency: freq };
}

const C4 = 261.6255653005986; // MIDI 60

// The nearest "C" in any octave, and how far off (in cents) the given
// frequency is from it — a crow rooted on any octave of C counts as in tune,
// not just C6 specifically.
export function nearestC(freq: number): { hz: number; cents: number } {
  const semitonesFromC4 = 12 * Math.log2(freq / C4);
  const nearestCSemitone = Math.round(semitonesFromC4 / 12) * 12;
  const cents = Math.round((semitonesFromC4 - nearestCSemitone) * 100);
  const hz = C4 * 2 ** (nearestCSemitone / 12);
  return { hz, cents };
}
