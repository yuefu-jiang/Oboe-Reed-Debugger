<script lang="ts">
  import { experienceStore, type ExperienceLevel } from '$lib/stores/experienceStore';
  const levels: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced'];
</script>

<div class="toggle">
  {#each levels as level}
    <button
      class:active={$experienceStore === level}
      onclick={() => experienceStore.set(level)}
    >
      {level}
    </button>
  {/each}
</div>

<style>
  .toggle { display: flex; gap: 0.5rem; }
  button { padding: 0.25rem 0.75rem; border: 1px solid #555; border-radius: 4px; background: transparent; color: #aaa; cursor: pointer; text-transform: capitalize; }
  button.active { background: #333; color: white; border-color: white; }
</style>
