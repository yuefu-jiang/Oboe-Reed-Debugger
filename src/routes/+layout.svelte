<script lang="ts">
  import Nav from '$lib/components/Nav.svelte';
  import LevelToggle from '$lib/components/LevelToggle.svelte';
  import '../app.css';

  let { children } = $props();
</script>

<div class="app">
  <div class="top-bar">
    <header class="inner">
      <span class="brand">Reed Debugger</span>
      <LevelToggle />
    </header>
  </div>
  <div class="nav-bar">
    <div class="inner">
      <Nav />
    </div>
  </div>
  <main class="inner">
    {@render children()}
  </main>
</div>

<style>
  .app { min-height: 100vh; }
  .inner { max-width: 900px; margin: 0 auto; padding-left: 1.5rem; padding-right: 1.5rem; }
  .top-bar { border-bottom: 1px solid #222; }
  header { display: flex; justify-content: space-between; align-items: center; padding-top: 0.75rem; padding-bottom: 0.75rem; }
  .brand { font-weight: bold; font-size: 1.1rem; }
  .nav-bar { border-bottom: 1px solid #333; }
  main { padding-top: 2rem; padding-bottom: 2rem; }
</style>
