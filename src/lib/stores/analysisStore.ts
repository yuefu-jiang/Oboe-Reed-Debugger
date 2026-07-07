import { writable } from 'svelte/store';
import type { RecordingAnalysis } from '$lib/audio/recordingAnalyzer';

export const analysisStore = writable<RecordingAnalysis | null>(null);
export const matchedSymptomsStore = writable<string[]>([]);
export const spectrogramSnapshotStore = writable<string | null>(null);
