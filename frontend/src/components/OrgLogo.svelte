<script>
  // Organization logo; white logos can be shown on a dark background (logoDarkBg).
  // Without a logo, shows the organization's initials.
  let { org, size = 'h-10' } = $props();
  const initials = $derived(
    (org?.name ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join(''),
  );
</script>

{#if org?.logoUrl}
  <span class="inline-flex shrink-0 items-center rounded-md {org.logoDarkBg ? 'bg-slate-900 px-2 py-1' : ''}">
    <img src={org.logoUrl} alt={org.name} class="{size} w-auto max-w-48 object-contain" />
  </span>
{:else if org}
  <span class="inline-flex {size} aspect-square shrink-0 items-center justify-center rounded-md bg-slate-200 text-xs font-bold text-slate-600" title={org.name}>
    {initials}
  </span>
{/if}
