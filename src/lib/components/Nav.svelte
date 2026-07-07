<script lang="ts">
  import { page } from '$app/stores';
</script>

<nav>
  <a href="/tuner" class:active={$page.url.pathname === '/tuner'}>Tuner</a>
  <a href="/recorder" class:active={$page.url.pathname === '/recorder'}>Recorder</a>
  <a href="/guide" class:active={$page.url.pathname === '/guide'}>Guide</a>
</nav>

<style>
  nav { display: flex; gap: 1rem; padding: 0.75rem 0; }
  a { text-decoration: none; color: #aaa; font-size: 1rem; }
  a.active { color: white; border-bottom: 2px solid white; }
</style>
