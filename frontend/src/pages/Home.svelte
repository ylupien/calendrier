<script>
  import { onOrgChange } from '../lib/orgLive.svelte.js';
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { navigate, link } from '../lib/router.svelte.js';
  import { fmtOccasionDays, todayStr } from '../lib/dates.js';
  import CreateOccasion from '../components/CreateOccasion.svelte';
  import CopyLink from '../components/CopyLink.svelte';
  import OrgLogo from '../components/OrgLogo.svelte';
  import { t } from '../lib/i18n.svelte.js';

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
  // An organization changed (name, logo) or was deleted: reload.
  onOrgChange(() => load());

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
    if (!confirm(t('Home.archiveConfirm', { title: o.title }))) return;
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
    title={o.isCreator ? t('Home.crown.createdTitle') : t('Home.crown.adminTitle')}
    aria-label={o.isCreator ? t('Home.crown.createdLabel') : t('Home.crown.adminLabel')}>👑</span>
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
        {#if o.allMembers}<span class="shrink-0 rounded-full bg-slate-100 px-2 py-0.5">{t('Home.allMembers')}</span>{/if}
        {#if o.canManage}{@render crown(o)}{/if}
      </div>
    {/if}
    <div class="flex items-start justify-between gap-3">
      <h3 class="font-semibold text-slate-900 group-hover:text-indigo-600">{o.title}</h3>
      <div class="flex shrink-0 gap-1">
        {#if o.archived}
          <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{t('Home.archivedBadge')}</span>
        {:else if o.editClosed}
          <span class="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{t('Home.editClosed')}</span>
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
          <button class="btn-ghost px-2 py-1 text-xs" onclick={(e) => archive(e, o)}>🗄️ {t('Home.archive')}</button>
        {:else if o.isCreator && o.archivedManually}
          <button class="btn-ghost px-2 py-1 text-xs" onclick={(e) => unarchive(e, o)}>↩️ {t('Home.unarchive')}</button>
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
    <h1 class="text-2xl font-bold text-slate-900">{t('common.myOccasions')}</h1>
    <p class="mt-1 text-slate-500">{t('Home.intro')}</p>
  </div>
  <button class="btn-primary" onclick={() => (creating = true)}>＋ {t('Home.newOccasion')}</button>
</div>

{#if loading}
  <p class="py-12 text-center text-slate-400">{t('common.loading')}</p>
{:else if error}
  <p class="py-12 text-center text-rose-600">{error}</p>
{:else if occasions.length === 0}
  <div class="card flex flex-col items-center gap-3 px-6 py-16 text-center">
    <div class="text-4xl">🗓️</div>
    <h2 class="text-lg font-semibold">{t('Home.empty.title')}</h2>
    <p class="max-w-md text-slate-500">{t('Home.empty.text')}</p>
    <button class="btn-primary mt-2" onclick={() => (creating = true)}>{t('Home.empty.create')}</button>
  </div>
{:else}
  <div class="mb-6 flex flex-col-reverse gap-3 border-b border-slate-200 sm:flex-row sm:items-end sm:justify-between">
    <div class="-mb-px flex gap-1 overflow-x-auto">
      {#each [
        { id: 'active', label: t('Home.tabs.active'), n: current.length + upcoming.length },
        { id: 'managed', label: t('Home.tabs.managed'), n: managedActive.length },
        { id: 'archived', label: t('Home.tabs.archived'), n: archived.length },
      ] as tb (tb.id)}
        <button
          class="shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition sm:px-4 {tab === tb.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}"
          onclick={() => (tab = tb.id)}
        >
          {tb.label}
          <span class="ml-1 rounded-full px-1.5 text-xs {tab === tb.id ? 'bg-indigo-100' : 'bg-slate-100'}">{tb.n}</span>
        </button>
      {/each}
    </div>
    <label class="flex items-center gap-2 pb-2 text-sm text-slate-600">
      <span class="shrink-0">{t('Home.filter.label')}</span>
      <select class="input py-1.5 sm:w-60" bind:value={orgFilter}>
        <option value="all">{t('Home.filter.all')}</option>
        <option value="none">{t('Home.filter.none')}</option>
        {#each filterOrgs as o (o.id)}<option value={String(o.id)}>{o.name}</option>{/each}
      </select>
    </label>
  </div>

  {#if tab === 'active'}
    <div class="space-y-10">
      {#if current.length}
        <section>
          <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t('Home.sections.current')}</h2>
          {@render grid(current)}
        </section>
      {/if}
      {#if upcoming.length}
        <section>
          <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t('Home.sections.upcoming')}</h2>
          {@render grid(upcoming)}
        </section>
      {/if}
      {#if !current.length && !upcoming.length}
        <p class="py-8 text-center text-slate-500">
          {orgFilter === 'all' ? t('Home.none.active') : t('Home.none.activeFiltered')}
        </p>
      {/if}
    </div>
  {:else if tab === 'managed'}
    <p class="mb-4 text-sm text-slate-500">
      {t('Home.managedIntro')}
    </p>
    <div class="space-y-10">
      {#if managedActive.length}
        <section>
          <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t('Home.tabs.active')}</h2>
          {@render grid(managedActive)}
        </section>
      {/if}
      {#if managedArchived.length}
        <section>
          <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t('Home.sections.archived')}</h2>
          {@render grid(managedArchived)}
        </section>
      {/if}
      {#if !managedActive.length && !managedArchived.length}
        <p class="py-8 text-center text-slate-500">{orgFilter === 'all' ? t('Home.none.managed') : t('Home.none.managedFiltered')}</p>
      {/if}
    </div>
  {:else if archived.length}
    <p class="mb-4 text-sm text-slate-500">
      {t('Home.archivedIntro')}
    </p>
    {@render grid(archived)}
  {:else}
    <p class="py-8 text-center text-slate-500">{orgFilter === 'all' ? t('Home.none.archived') : t('Home.none.archivedFiltered')}</p>
  {/if}
{/if}

{#if creating}
  <CreateOccasion {orgs} onclose={() => (creating = false)} oncreated={(o) => navigate(`/o/${o.slug}`)} />
{/if}
