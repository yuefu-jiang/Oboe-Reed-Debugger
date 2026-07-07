export const MIN_FREQ = 200;
export const MAX_FREQ = 5000;

export function freqToY(freq: number, minFreq: number, maxFreq: number, height: number): number {
  const logMin = Math.log(minFreq);
  const logMax = Math.log(maxFreq);
  const logF = Math.log(Math.max(minFreq, Math.min(maxFreq, freq)));
  return Math.round(height - ((logF - logMin) / (logMax - logMin)) * height);
}

// Inverse of freqToY — the frequency a given pixel row represents
export function yToFreq(y: number, minFreq: number, maxFreq: number, height: number): number {
  const logMin = Math.log(minFreq);
  const logMax = Math.log(maxFreq);
  const logF = logMin + ((height - y) / height) * (logMax - logMin);
  return Math.exp(logF);
}

export function dbToColor(db: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, (db + 100) / 100));
  if (t < 0.25) {
    const s = t / 0.25;
    return [0, 0, Math.round(s * 180)];
  } else if (t < 0.5) {
    const s = (t - 0.25) / 0.25;
    return [0, Math.round(s * 200), 180];
  } else if (t < 0.75) {
    const s = (t - 0.5) / 0.25;
    return [Math.round(s * 255), 200, Math.round(180 * (1 - s))];
  } else {
    const s = (t - 0.75) / 0.25;
    return [255, Math.round(200 + s * 55), Math.round(s * 255)];
  }
}

export function drawColumn(
  ctx: CanvasRenderingContext2D,
  fftData: Float32Array,
  sampleRate: number,
  x: number,
  height: number
): void {
  const binCount = fftData.length;
  const nyquist = sampleRate / 2;

  for (let y = 0; y < height; y++) {
    const freq = yToFreq(y, MIN_FREQ, MAX_FREQ, height);
    const bin = Math.round((freq / nyquist) * binCount);
    const db = fftData[Math.min(bin, binCount - 1)];
    const [r, g, b] = dbToColor(db);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x, y, 1, 1);
  }
}
