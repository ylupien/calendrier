<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { navigate, link } from '../lib/router.svelte.js';
  import { fmtOccasionDays, todayStr } from '../lib/dates.js';
  import CreateOccasion from '../components/CreateOccasion.svelte';
  import CopyLink from '../components/CopyLink.svelte';
  import OrgLogo from '../components/OrgLogo.svelte';

  const FILTER_KEY = 'occasions.orgFilter';

  let occasions = $state([]);
  let loading = $state(true);
  let error = $state('');
  let creating = $state(false);
  let orgs = $state([]); // for the organization picker of a new occasion
  let tab = $state('active'); // 'active' | 'managed' | 'archived'
  // 'all' | 'none' (personal occasions) | organization id (as string); remembered per browser
  let orgFilter = $state(readFilter());

  function readFilter() {
    try {
      return localStorage.getItem(FILTER_KEY) || 'all';
    } catch {
      return 'all';
    }
  }

  $effect(() => {
    try {
      localStorage.setItem(FILTER_KEY, orgFilter);
    } catch {
      // storage unavailable: the filter just isn't remembered
    }
  });

  async function load() {
    try {
      [occasions, orgs] = await Promise.all([api.occasions(), api.organizations()]);
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  onMount(load);

  /** Organizations available in the filter: mine, plus any found on my occasions. */
  const filterOrgs = $derived.by(() => {
    const map = new Map(orgs.map((o) => [o.id, o.name]));
    for (const o of occasions) if (o.organization) map.set(o.organization.id, o.organization.name);
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  });

  // Forget a filter pointing to an organization that no longer exists.
  $effect(() => {
    if (!loading && orgFilter !== 'all' && orgFilter !== 'none' && !filterOrgs.some((o) => String(o.id) === orgFilter)) {
      orgFilter = 'all';
    }
  });

  const filtered = $derived(
    occasions.filter((o) =>
      orgFilter === 'all' ? true : orgFilter === 'none' ? !o.organization : String(o.organization?.id) === orgFilter,
    ),
  );

  const today = todayStr();
  // Current: its first day has come; upcoming: it has not started yet.
  const current = $derived(filtered.filter((o) => !o.archived && o.firstDay <= today));
  const upcoming = $derived(filtered.filter((o) => !o.archived && o.firstDay > today));
  const archived = $derived(filtered.filter((o) => o.archived).sort((a, b) => (b.lastDay ?? '').localeCompare(a.lastDay ?? '')));
  // Managed: created by me, or in an organization I own / administer.
  const managedActive = $derived(filtered.filter((o) => o.canManage && !o.archived));
  const managedArchived = $derived(archived.filter((o) => o.canManage));

  const range = fmtOccasionDays;

  async function archive(e, o) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Archiver « ${o.title} » ? Plus personne ne pourra modifier ses disponibilités.`)) return;
    try {
      const updated = await api.archiveOccasion(o.slug, true);
      occasions = occasions.map((x) => (x.id === o.id ? { ...x, ...updated } : x));
    } catch (err) {
      alert(err.message);
    }
  }

  async function unarchive(e, o) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const updated = await api.archiveOccasion(o.slug, false);
      occasions = occasions.map((x) => (x.id === o.id ? { ...x, ...updated } : x));
    } catch (err) {
      alert(err.message);
    }
  }
</script>

{#snippet crown(o)}
  <!-- Occasions I manage: created by me, or in an organization I own / administer -->
  <span class="ml-auto shrink-0 text-base leading-none"
    title={o.isCreator ? 'Vous avez créé cette occasion' : "Vous administrez l'organisation de cette occasion"}
    aria-label={o.isCreator ? 'Créée par vous' : 'Organisation administrée par vous'}>👑</span>
{/snippet}

{#snippet occasionCard(o)}
  <a
    href="/o/{o.slug}"
    onclick={link}
    class="card group flex flex-col gap-3 p-5 transition hover:-translate-y-0.5 hover:shadow-md {o.archived ? 'opacity-80' : ''}"
  >
    {#if o.organization}
      <div class="flex items-center gap-2 text-xs text-slate-500">
        <OrgLogo org={o.organization} size="h-6" />
        <span class="truncate">{o.organization.name}</span>
        {#if o.allMembers}<span class="shrink-0 rounded-full bg-slate-100 px-2 py-0.5">Tous les membres</span>{/if}
        {#if o.canManage}{@render crown(o)}{/if}
      </div>
    {/if}
    <div class="flex items-start justify-between gap-3">
      <h3 class="font-semibold text-slate-900 group-hover:text-indigo-600">{o.title}</h3>
      <div class="flex shrink-0 gap-1">
        {#if o.archived}
          <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Archivée</span>
        {:else if o.editClosed}
          <span class="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Édition fermée</span>
        {/if}
        {#if o.canManage && !o.organization}{@render crown(o)}{/if}
      </div>
    </div>
    {#if o.description}<p class="line-clamp-2 text-sm text-slate-500">{o.description}</p>{/if}
    <div class="mt-auto flex items-center justify-between text-sm text-slate-500">
      <span>📅 {range(o)}</span>
      <span>👥 {o.guestCount}</span>
    </div>
    {#if !o.archived || (o.isCreator && o.archivedManually)}
      <div class="-mx-2 -mb-2 flex items-center justify-between border-t border-slate-100 pt-1">
        {#if !o.archived}<CopyLink slug={o.slug} compact />{:else}<span></span>{/if}
        {#if o.isCreator && !o.archived}
          <button class="btn-ghost px-2 py-1 text-xs" onclick={(e) => archive(e, o)}>🗄️ Archiver</button>
        {:else if o.isCreator && o.archivedManually}
          <button class="btn-ghost px-2 py-1 text-xs" onclick={(e) => unarchive(e, o)}>↩️ Désarchiver</button>
        {/if}
      </div>
    {/if}
  </a>
{/snippet}

{#snippet grid(list)}
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {#each list as o (o.id)}{@render occasionCard(o)}{/each}
  </div>
{/snippet}

<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
  <div>
    <h1 class="text-2xl font-bold text-slate-900">Mes occasions</h1>
    <p class="mt-1 text-slate-500">Créez une occasion, partagez le lien et voyez les disponibilités de chacun en temps réel.</p>
  </div>
  <button class="btn-primary" onclick={() => (creating = true)}>＋ Nouvelle occasion</button>
</div>

{#if loading}
  <p class="py-12 text-center text-slate-400">Chargement…</p>
{:else if error}
  <p class="py-12 text-center text-rose-600">{error}</p>
{:else if occasions.length === 0}
  <div class="card flex flex-col items-center gap-3 px-6 py-16 text-center">
    <div class="text-4xl">🗓️</div>
    <h2 class="text-lg font-semibold">Aucune occasion pour l'instant</h2>
    <p class="max-w-md text-slate-500">Créez votre première occasion, ou ouvrez un lien qu'on vous a partagé : vous y serez associé automatiquement.</p>
    <button class="btn-primary mt-2" onclick={() => (creating = true)}>Créer une occasion</button>
  </div>
{:else}
  <div class="mb-6 flex flex-col-reverse gap-3 border-b border-slate-200 sm:flex-row sm:items-end sm:justify-between">
    <div class="-mb-px flex gap-1 overflow-x-auto">
      {#each [
        { id: 'active', label: 'En cours et à venir', n: current.length + upcoming.length },
        { id: 'managed', label: 'Que je gère', n: managedActive.length },
        { id: 'archived', label: 'Archives', n: archived.length },
      ] as t (t.id)}
        <button
          class="shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition sm:px-4 {tab === t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}"
          onclick={() => (tab = t.id)}
        >
          {t.label}
          <span class="ml-1 rounded-full px-1.5 text-xs {tab === t.id ? 'bg-indigo-100' : 'bg-slate-100'}">{t.n}</span>
        </button>
      {/each}
    </div>
    <label class="flex items-center gap-2 pb-2 text-sm text-slate-600">
      <span class="shrink-0">Organisation</span>
      <select class="input py-1.5 sm:w-60" bind:value={orgFilter}>
        <option value="all">Toutes</option>
        <option value="none">Personnelles (sans organisation)</option>
        {#each filterOrgs as o (o.id)}<option value={String(o.id)}>{o.name}</option>{/each}
      </select>
    </label>
  </div>

  {#if tab === 'active'}
    <div class="space-y-10">
      {#if current.length}
        <section>
          <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">En cours</h2>
          {@render grid(current)}
        </section>
      {/if}
      {#if upcoming.length}
        <section>
          <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">À venir</h2>
          {@render grid(upcoming)}
        </section>
      {/if}
      {#if !current.length && !upcoming.length}
        <p class="py-8 text-center text-slate-500">
          Aucune occasion en cours ou à venir{orgFilter === 'all' ? '' : ' pour ce filtre'}.
        </p>
      {/if}
    </div>
  {:else if tab === 'managed'}
    <p class="mb-4 text-sm text-slate-500">
      Les occasions que vous avez créées, et celles des organisations dont vous êtes responsable ou administrateur.
    </p>
    <div class="space-y-10">
      {#if managedActive.length}
        <section>
          <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">En cours et à venir</h2>
          {@render grid(managedActive)}
        </section>
      {/if}
      {#if managedArchived.length}
        <section>
          <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Archivées</h2>
          {@render grid(managedArchived)}
        </section>
      {/if}
      {#if !managedActive.length && !managedArchived.length}
        <p class="py-8 text-center text-slate-500">Vous ne gérez aucune occasion{orgFilter === 'all' ? '' : ' pour ce filtre'}.</p>
      {/if}
    </div>
  {:else if archived.length}
    <p class="mb-4 text-sm text-slate-500">
      Les occasions terminées ou archivées par leur créateur restent consultables en lecture seule.
    </p>
    {@render grid(archived)}
  {:else}
    <p class="py-8 text-center text-slate-500">Aucune occasion archivée{orgFilter === 'all' ? '' : ' pour ce filtre'}.</p>
  {/if}
{/if}

{#if creating}
  <CreateOccasion {orgs} onclose={() => (creating = false)} oncreated={(o) => navigate(`/o/${o.slug}`)} />
{/if}
