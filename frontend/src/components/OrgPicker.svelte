<script>
  import OrgLogo from './OrgLogo.svelte';

  // Organization of an occasion + who is invited ("Tous" = every member of the organization).
  let { orgs, organizationId = $bindable(null), allMembers = $bindable(false) } = $props();

  const selected = $derived(orgs.find((o) => o.id === organizationId) ?? null);
</script>

<div class="space-y-3 rounded-xl bg-slate-50 p-3">
  <div>
    <label class="label" for="op-org">Organisation</label>
    <div class="flex items-center gap-3">
      <select
        id="op-org"
        class="input"
        value={organizationId ?? ''}
        onchange={(e) => (organizationId = e.currentTarget.value ? Number(e.currentTarget.value) : null)}
      >
        <option value="">Aucune (occasion personnelle)</option>
        {#each orgs as o (o.id)}
          <option value={o.id} disabled={!o.canCreate && o.id !== organizationId}>
            {o.name}{o.canCreate ? '' : ' (non autorisé)'}
          </option>
        {/each}
      </select>
      {#if selected}<OrgLogo org={selected} size="h-8" />{/if}
    </div>
    {#if orgs.length && orgs.every((o) => !o.canCreate)}
      <p class="mt-1 text-xs text-slate-500">Vous n'êtes autorisé à créer des occasions dans aucune de vos organisations.</p>
    {/if}
  </div>

  {#if selected}
    <fieldset>
      <legend class="label">Invités</legend>
      <div class="space-y-1.5">
        <label class="flex items-start gap-2 text-sm text-slate-700">
          <input type="radio" class="mt-1 accent-indigo-600" name="op-guests" value={true} bind:group={allMembers} />
          <span>
            <span class="font-medium">Tous les membres de l'organisation</span>
            <span class="block text-xs text-slate-500">L'occasion apparaît automatiquement chez tous les membres, y compris les futurs.</span>
          </span>
        </label>
        <label class="flex items-start gap-2 text-sm text-slate-700">
          <input type="radio" class="mt-1 accent-indigo-600" name="op-guests" value={false} bind:group={allMembers} />
          <span>
            <span class="font-medium">Seulement les personnes qui ont le lien</span>
          </span>
        </label>
      </div>
    </fieldset>
  {/if}
</div>
