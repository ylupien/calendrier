<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { navigate, link } from '../lib/router.svelte.js';
  import { session, askProfile } from '../lib/session.svelte.js';
  import { fmtShort, fmtMedium } from '../lib/dates.js';
  import OrgLogo from '../components/OrgLogo.svelte';
  import OrganizationEditor from '../components/OrganizationEditor.svelte';
  import CreateOccasion from '../components/CreateOccasion.svelte';

  let orgs = $state([]);
  let occasions = $state([]);
  let loading = $state(true);
  let error = $state('');
  let editingOrg = $state(undefined); // undefined = closed, null = new organization, id = edit
  let creatingFor = $state(null); // organization id for "＋ Occasion"

  async function load() {
    try {
      [orgs, occasions] = await Promise.all([api.organizations(), api.occasions()]);
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  onMount(load);

  function newOrganization() {
    if (!session.me?.name) askProfile({ then: () => (editingOrg = null) });
    else editingOrg = null;
  }

  /** Current and upcoming occasions of an organization (archived ones are counted only). */
  const occasionsOf = (orgId) => occasions.filter((o) => o.organization?.id === orgId);
  const range = (o) => (o.startDate === o.endDate ? fmtMedium(o.startDate) : `${fmtShort(o.startDate)} → ${fmtMedium(o.endDate)}`);
</script>

<div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
  <div>
    <h1 class="text-2xl font-bold text-slate-900">Mes organisations</h1>
    <p class="mt-1 text-slate-500">Les organisations dont vous êtes responsable ou membre.</p>
  </div>
  <button class="btn-primary" onclick={newOrganization}>＋ Nouvelle organisation</button>
</div>

{#if loading}
  <p class="py-12 text-center text-slate-400">Chargement…</p>
{:else if error}
  <p class="py-12 text-center text-rose-600">{error}</p>
{:else if orgs.length === 0}
  <div class="card flex flex-col items-center gap-3 px-6 py-16 text-center">
    <div class="text-4xl">🏢</div>
    <h2 class="text-lg font-semibold">Aucune organisation pour l'instant</h2>
    <p class="max-w-md text-slate-500">
      Créez une organisation pour regrouper vos occasions sous un même logo, ou ouvrez le lien d'une occasion
      d'une organisation : vous en deviendrez membre automatiquement.
    </p>
    <button class="btn-primary mt-2" onclick={newOrganization}>Créer une organisation</button>
  </div>
{:else}
  <div class="grid gap-5 lg:grid-cols-2">
    {#each orgs as o (o.id)}
      {@const list = occasionsOf(o.id)}
      {@const active = list.filter((x) => !x.archived)}
      <article class="card flex flex-col">
        <div class="flex items-start gap-4 border-b border-slate-100 p-5">
          <OrgLogo org={o} size="h-12" />
          <div class="min-w-0 flex-1">
            <h2 class="truncate text-lg font-semibold text-slate-900">{o.name}</h2>
            <div class="mt-1 flex flex-wrap gap-1.5 text-xs">
              <span class="rounded-full px-2 py-0.5 font-medium {o.isAdmin ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'}">
                {o.isOwner ? 'Responsable' : o.isAdmin ? 'Administrateur' : 'Membre'}
              </span>
              <span class="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{o.mode === 'free' ? 'Mode libre' : 'Mode autorisé'}</span>
              <span class="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{o.memberCount} membre{o.memberCount > 1 ? 's' : ''}</span>
              <span class="rounded-full px-2 py-0.5 {o.canCreate ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}">
                {o.canCreate ? 'Vous pouvez créer des occasions' : 'Création non autorisée'}
              </span>
            </div>
          </div>
        </div>

        <div class="flex-1 p-5">
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Occasions en cours et à venir ({active.length})
          </h3>
          {#if active.length}
            <ul class="space-y-1">
              {#each active as occ (occ.id)}
                <li>
                  <a href="/o/{occ.slug}" onclick={link} class="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                    <span class="truncate font-medium text-slate-800">{occ.title}</span>
                    <span class="shrink-0 text-xs text-slate-500">{range(occ)}</span>
                  </a>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="text-sm text-slate-400">Aucune occasion en cours ou à venir.</p>
          {/if}
          {#if list.length > active.length}
            <p class="mt-2 text-xs text-slate-400">+ {list.length - active.length} archivée(s)</p>
          {/if}
        </div>

        <div class="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          {#if o.isAdmin}
            <button class="btn-ghost" onclick={() => (editingOrg = o.id)}>⚙️ Gérer</button>
          {/if}
          {#if o.canCreate}
            <button class="btn-outline" onclick={() => (creatingFor = o.id)}>＋ Occasion</button>
          {/if}
        </div>
      </article>
    {/each}
  </div>
{/if}

{#if editingOrg !== undefined}
  <OrganizationEditor orgId={editingOrg} onclose={() => (editingOrg = undefined)} onchanged={load} />
{/if}

{#if creatingFor}
  <CreateOccasion
    {orgs}
    initialOrganizationId={creatingFor}
    onclose={() => (creatingFor = null)}
    oncreated={(o) => navigate(`/o/${o.slug}`)}
  />
{/if}
