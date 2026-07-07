import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

const stored = browser ? (localStorage.getItem('obt-experience') as ExperienceLevel) : null;

export const experienceStore = writable<ExperienceLevel>(stored ?? 'beginner');

if (browser) {
  experienceStore.subscribe(val => localStorage.setItem('obt-experience', val));
}
