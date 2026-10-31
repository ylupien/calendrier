<script>
  let { onclose = null, size = 'max-w-md', children } = $props();

  function onkeydown(e) {
    if (e.key === 'Escape' && onclose) onclose();
  }
</script>

<svelte:window {onkeydown} />

<div class="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
  <button
    class="absolute inset-0 cursor-default bg-slate-900/40 backdrop-blur-sm"
    aria-label="Fermer"
    tabindex="-1"
    onclick={() => onclose?.()}
  ></button>
  <div class="relative max-h-[92vh] w-full {size} overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
    {@render children()}
  </div>
</div>
