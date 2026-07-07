<script lang="ts">
  let { onrecorded, onstart, onstop }: {
    onrecorded?: (buf: AudioBuffer) => void;
    onstart?: () => void;
    onstop?: () => void;
  } = $props();

  let recording = $state(false);
  let mediaRecorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];

  export async function start() {
    chunks = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => chunks.push(e.data);
    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const arrayBuffer = await blob.arrayBuffer();
      const ctx = new AudioContext();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      ctx.close();
      onrecorded?.(audioBuffer);
    };
    mediaRecorder.start();
    recording = true;
    onstart?.();
  }

  export function stop() {
    mediaRecorder?.stop();
    recording = false;
    onstop?.();
  }

  function toggle() {
    if (recording) stop(); else start();
  }
</script>

<button class:recording onclick={toggle}>
  {recording ? '■ Stop Recording' : '● Record'}
</button>

<style>
  button { padding: 0.75rem 2rem; font-size: 1.1rem; cursor: pointer; border-radius: 6px; border: 2px solid #555; background: #1a1a1a; color: #eee; }
  button.recording { border-color: #e76f51; color: #e76f51; animation: pulse 1s infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
</style>
