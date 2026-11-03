<script>
  import { logoView } from '../lib/logoDisplay.svelte.js';
  import { withLive } from '../lib/orgLive.svelte.js';

  // Organization logo, on the background of its setting (theme, always light or always dark).
  // Without a logo, shows the organization's initials.
  let { org: given, size = 'h-10', maxWidth = 'max-w-48' } = $props();
  // Latest name and logo (changed by someone else while the page is open).
  const org = $derived(withLive(given));
  const view = $derived(
    org?.logoUrl ? logoView({ url: org.logoUrl, darkUrl: org.logoDarkUrl, background: org.logoBackground }) : null,
  );
  const initials = $derived(
    (org?.name ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join(''),
  );
</script>

{#if org?.logoUrl}
  <span class="inline-flex shrink-0 items-center rounded-md {view.plateClass ? `${view.plateClass} px-2 py-1` : ''}">
    <img src={view.src} alt={org.name} class="{size} w-auto {maxWidth} object-contain" />
  </span>
{:else if org}
  <span class="inline-flex {size} aspect-square shrink-0 items-center justify-center rounded-md bg-slate-200 text-xs font-bold text-slate-600" title={org.name}>
    {initials}
  </span>
{/if}
