<script lang="ts">
  import type { Symptom } from '$lib/data/symptoms';
  import type { ExperienceLevel } from '$lib/stores/experienceStore';

  let { symptom, level = 'intermediate', highlighted = false }: {
    symptom: Symptom;
    level?: ExperienceLevel;
    highlighted?: boolean;
  } = $props();

  let expanded = $state(false);

  const categoryLabel: Record<string, string> = {
    crow: 'Crow', response: 'Response', pitch: 'Pitch', tone: 'Tone', endurance: 'Endurance'
  };
</script>

<div class="card" class:highlighted role="button" tabindex="0"
  onclick={() => expanded = !expanded}
  onkeydown={e => e.key === 'Enter' && (expanded = !expanded)}
>
  <div class="header">
    <span class="category">{categoryLabel[symptom.category]}</span>
    <span class="symptom-label">{symptom.symptom}</span>
    <span class="toggle">{expanded ? '▲' : '▼'}</span>
  </div>

  {#if expanded}
    <div class="body">
      <p class="description">{symptom.description[level]}</p>

      <h4>Likely Causes</h4>
      <ul>
        {#each symptom.likelyCauses as cause}
          <li><strong>{cause.region}</strong>: {cause.issue}</li>
        {/each}
      </ul>

      {#if level !== 'beginner'}
        <h4>Audio Signatures</h4>
        <ul>
          {#each symptom.audioSignatures as sig}
            <li><strong>{sig.indicator}</strong> — {sig.details}</li>
          {/each}
        </ul>
      {/if}

      <h4>Suggested Fixes</h4>
      <ul>
        {#each symptom.suggestedFixes.filter(f => f.level === level || (level === 'advanced' && f.level === 'intermediate')) as fix}
          <li>{fix.action}</li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .card { background: #1a1a1a; border: 1px solid #333; border-radius: 6px; margin-bottom: 0.5rem; cursor: pointer; }
  .card.highlighted { border-color: #2a9d8f; }
  .header { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; }
  .category { background: #264653; color: #aaa; font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; }
  .symptom-label { flex: 1; font-size: 0.95rem; }
  .toggle { color: #555; font-size: 0.8rem; }
  .body { padding: 0 1rem 1rem; border-top: 1px solid #2a2a2a; }
  .description { margin: 0.75rem 0; color: #bbb; font-size: 0.9rem; line-height: 1.5; }
  h4 { color: #888; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; margin: 0.75rem 0 0.3rem; }
  ul { padding-left: 1.2rem; }
  li { color: #ccc; font-size: 0.9rem; line-height: 1.6; }
</style>
