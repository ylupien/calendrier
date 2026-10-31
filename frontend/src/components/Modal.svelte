<script module>
  // Open dialogs, innermost last: only the top one reacts to Escape.
  const stack = [];
</script>

<script>
  import { onMount } from 'svelte';
  import { lockScroll } from '../lib/scrollLock.js';

  let { onclose = null, size = 'max-w-md', children } = $props();
  const id = Symbol('modal');

  // While the dialog is open, the page behind it does not scroll.
  onMount(() => {
    stack.push(id);
    const unlock = lockScroll();
    return () => {
      stack.splice(stack.indexOf(id), 1);
      unlock();
    };
  });

  function onkeydown(e) {
    if (e.key === 'Escape' && onclose && stack.at(-1) === id) {
      e.stopPropagation();
      onclose();
    }
  }
</script>

<svelte:window {onkeydown} />

<div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true">
  <button
    class="absolute inset-0 cursor-default touch-none bg-black/40 backdrop-blur-sm"
    aria-label="Fermer"
    tabindex="-1"
    onclick={() => onclose?.()}
  ></button>
  <div class="relative max-h-[calc(100dvh-1.5rem)] w-full {size} overflow-y-auto overscroll-contain rounded-2xl bg-surface shadow-2xl sm:max-h-[92vh]">
    {@render children()}
  </div>
</div>
