import { get } from 'svelte/store';
import { describe, it, expect, vi } from 'vitest';

// Mock $app/environment so browser = true
vi.mock('$app/environment', () => ({ browser: true }));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    clear: () => { store = {}; }
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

describe('experienceStore', () => {
  it('defaults to beginner', async () => {
    const { experienceStore } = await import('$lib/stores/experienceStore');
    expect(get(experienceStore)).toBe('beginner');
  });

  it('persists to localStorage on change', async () => {
    const { experienceStore } = await import('$lib/stores/experienceStore');
    experienceStore.set('advanced');
    expect(localStorage.getItem('obt-experience')).toBe('advanced');
  });
});
