import { browser } from '$app/environment';

export const MIN_BPM = 20;
export const MAX_BPM = 300;

export const BEATS_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 12];

const LOOKAHEAD_MS = 25;        // how often the scheduler wakes up to queue more clicks
const SCHEDULE_AHEAD_SEC = 0.1; // how far into the future clicks get queued each wake-up
const CLICK_DURATION_SEC = 0.05;

export function secondsPerBeat(bpm: number): number {
  return 60 / bpm;
}

export function nextBeatIndex(current: number, beatsPerMeasure: number): number {
  return (current + 1) % beatsPerMeasure;
}

// Clamps free-typed BPM input to a sane, whole-number range. Falls back to
// `fallback` for non-finite input (e.g. an emptied number field), rather than
// letting NaN/Infinity reach the scheduler and produce a broken interval.
export function clampBpm(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.round(Math.min(MAX_BPM, Math.max(MIN_BPM, value)));
}

// Precise click scheduling per the standard Web Audio "lookahead" pattern:
// the JS timer (setTimeout) only decides *when to queue*, never *when to
// play* — actual playback times are scheduled against the AudioContext's own
// clock, which doesn't drift the way setInterval/setTimeout does on its own.
class Metronome {
  private ctx: AudioContext | null = null;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private nextNoteTime = 0;
  private currentBeat = 0;
  private bpm = 120;
  private beatsPerMeasure = 4;
  private onBeat: ((beat: number) => void) | null = null;
  running = false;

  start(bpm: number, beatsPerMeasure: number, onBeat: (beat: number) => void): void {
    if (!browser || this.running) return;
    this.ctx = new AudioContext();
    this.bpm = bpm;
    this.beatsPerMeasure = beatsPerMeasure;
    this.onBeat = onBeat;
    this.currentBeat = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.running = true;
    this.scheduler();
  }

  stop(): void {
    this.running = false;
    if (this.timerId !== null) clearTimeout(this.timerId);
    this.timerId = null;
    this.ctx?.close();
    this.ctx = null;
  }

  setBpm(bpm: number): void {
    this.bpm = bpm;
  }

  setBeatsPerMeasure(n: number): void {
    this.beatsPerMeasure = n;
    if (this.currentBeat >= n) this.currentBeat = 0;
  }

  private scheduler = (): void => {
    if (!this.running || !this.ctx) return;
    while (this.nextNoteTime < this.ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      const beat = this.currentBeat;
      const time = this.nextNoteTime;
      this.playClick(beat, time);

      // Fire the visual callback close to the real playback moment. A little
      // setTimeout jitter here is fine — human eyes are far less sensitive to
      // a few ms of drift than ears are for the actual click.
      const delay = Math.max(0, (time - this.ctx.currentTime) * 1000);
      setTimeout(() => { if (this.running) this.onBeat?.(beat); }, delay);

      this.nextNoteTime += secondsPerBeat(this.bpm);
      this.currentBeat = nextBeatIndex(this.currentBeat, this.beatsPerMeasure);
    }
    this.timerId = setTimeout(this.scheduler, LOOKAHEAD_MS);
  };

  private playClick(beatIndex: number, time: number): void {
    if (!this.ctx) return;
    const accent = beatIndex === 0;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.frequency.value = accent ? 1000 : 800;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(accent ? 0.9 : 0.5, time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + CLICK_DURATION_SEC);
    osc.start(time);
    osc.stop(time + CLICK_DURATION_SEC);
  }
}

const metronome = new Metronome();

export function startMetronome(bpm: number, beatsPerMeasure: number, onBeat: (beat: number) => void): void {
  metronome.start(bpm, beatsPerMeasure, onBeat);
}

export function stopMetronome(): void {
  metronome.stop();
}

export function setMetronomeBpm(bpm: number): void {
  metronome.setBpm(bpm);
}

export function setMetronomeBeatsPerMeasure(n: number): void {
  metronome.setBeatsPerMeasure(n);
}

export function isMetronomeRunning(): boolean {
  return metronome.running;
}
