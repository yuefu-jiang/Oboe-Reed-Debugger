<script lang="ts">
  let { level = 0 }: { level?: number } = $props();
</script>

<div class="meter-wrap" title="Input level">
  <div class="bar" style="width: {Math.round(level * 100)}%"></div>
</div>

<style>
  .meter-wrap { width: 100%; height: 8px; background: #222; border-radius: 4px; overflow: hidden; }
  .bar { height: 100%; background: linear-gradient(to right, #2a9d8f, #e9c46a, #e76f51); transition: width 0.05s; }
</style>
