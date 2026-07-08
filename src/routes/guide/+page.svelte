<script lang="ts">
  import { symptoms } from '$lib/data/symptoms';
  import SymptomCard from '$lib/components/SymptomCard.svelte';
  import { matchedSymptomsStore } from '$lib/stores/analysisStore';

  type Category = 'all' | 'crow' | 'response' | 'pitch' | 'tone' | 'endurance';
  let activeCategory = $state<Category>('all');

  const categories: { key: Category; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'crow', label: 'Crow' },
    { key: 'response', label: 'Response' },
    { key: 'pitch', label: 'Pitch' },
    { key: 'tone', label: 'Tone' },
    { key: 'endurance', label: 'Endurance' }
  ];

  let base = $derived(activeCategory === 'all'
    ? symptoms
    : symptoms.filter(s => s.category === activeCategory));

  let sorted = $derived($matchedSymptomsStore.length > 0
    ? [...base].sort((a, b) => {
        const aMatch = $matchedSymptomsStore.includes(a.id) ? -1 : 0;
        const bMatch = $matchedSymptomsStore.includes(b.id) ? -1 : 0;
        return aMatch - bMatch;
      })
    : base);
</script>

<div class="guide">
  {#if $matchedSymptomsStore.length > 0}
    <div class="banner">
      Audio analysis suggests {$matchedSymptomsStore.length} possible issue{$matchedSymptomsStore.length > 1 ? 's' : ''} — highlighted below.
    </div>
  {/if}

  <div class="filters">
    {#each categories as cat}
      <button class:active={activeCategory === cat.key} onclick={() => activeCategory = cat.key}>
        {cat.label}
      </button>
    {/each}
  </div>

  <div class="list">
    {#each sorted as symptom (symptom.id)}
      <SymptomCard
        {symptom}
        highlighted={$matchedSymptomsStore.includes(symptom.id)}
      />
    {/each}
  </div>
</div>

<style>
  .guide { max-width: 680px; }
  .banner { background: #1a3340; border: 1px solid #2a9d8f; border-radius: 6px; padding: 0.6rem 1rem; margin-bottom: 1rem; color: #7eccc4; font-size: 0.9rem; }
  .filters { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
  .filters button { padding: 0.3rem 0.8rem; border: 1px solid #444; border-radius: 4px; background: transparent; color: #aaa; cursor: pointer; font-size: 0.9rem; }
  .filters button.active { background: #264653; color: #eee; border-color: #2a9d8f; }
</style>
