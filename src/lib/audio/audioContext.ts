import { browser } from '$app/environment';

let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let source: MediaStreamAudioSourceNode | null = null;
let stream: MediaStream | null = null;
let rafId: number | null = null;

export type AudioTickCallback = (
  timeDomain: Float32Array,
  frequency: Float32Array,
  sampleRate: number
) => void;

export async function startAudio(onTick: AudioTickCallback): Promise<void> {
  if (!browser) return;
  stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  ctx = new AudioContext();
  analyser = ctx.createAnalyser();
  // Frequency resolution trades off against time resolution (uncertainty
  // principle) — 16384 gave ~2.7Hz/bin but each FFT smears ~371ms of audio,
  // making the live strip visibly lag. 8192 is a better balance: ~5.4Hz/bin
  // (still 2x sharper than the original 4096) over a ~186ms window.
  analyser.fftSize = 8192;
  analyser.smoothingTimeConstant = 0.15; // less inter-frame averaging, so the strip responds faster
  source = ctx.createMediaStreamSource(stream);
  source.connect(analyser);

  const timeDomain = new Float32Array(analyser.fftSize);
  const frequency = new Float32Array(analyser.frequencyBinCount);

  let lastTick = 0;
  function tick(now: number) {
    rafId = requestAnimationFrame(tick);
    if (now - lastTick < 33) return;
    lastTick = now;
    analyser!.getFloatTimeDomainData(timeDomain);
    analyser!.getFloatFrequencyData(frequency);
    onTick(timeDomain, frequency, ctx!.sampleRate);
  }
  rafId = requestAnimationFrame(tick);
}

export function stopAudio(): void {
  if (rafId !== null) cancelAnimationFrame(rafId);
  source?.disconnect();
  stream?.getTracks().forEach(t => t.stop());
  ctx?.close();
  ctx = null; analyser = null; source = null; stream = null; rafId = null;
}

export function getAnalyser(): AnalyserNode | null { return analyser; }
export function getSampleRate(): number { return ctx?.sampleRate ?? 44100; }
