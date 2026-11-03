<script>
  import { onOrgChange } from '../lib/orgLive.svelte.js';
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { navigate, link } from '../lib/router.svelte.js';
  import { session, askProfile } from '../lib/session.svelte.js';
  import { fmtOccasionDays } from '../lib/dates.js';
  import OrgLogo from '../components/OrgLogo.svelte';
  import CreateOccasion from '../components/CreateOccasion.svelte';
  import { t } from '../lib/i18n.svelte.js';

  let orgs = $state([]);
  let occasions = $state([]);
  let loading = $state(true);
  let error = $state('');
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
  // An organization changed (name, logo) or was deleted: reload.
  onOrgChange(() => load());

  function newOrganization() {
    if (!session.me?.name) askProfile({ then: () => navigate('/organisations/nouvelle') });
    else navigate('/organisations/nouvelle');
  }

  /** Current and upcoming occasions of an organization (archived ones are counted only). */
  const occasionsOf = (orgId) => occasions.filter((o) => o.organization?.id === orgId);
  const range = fmtOccasionDays;
</script>

<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
  <div>
    <h1 class="text-2xl font-bold text-slate-900">{t('Organizations.title')}</h1>
    <p class="mt-1 text-slate-500">{t('Organizations.intro')}</p>
  </div>
  <button class="btn-primary" onclick={newOrganization}>＋ {t('Organizations.new')}</button>
</div>

{#if loading}
  <p class="py-12 text-center text-slate-400">{t('common.loading')}</p>
{:else if error}
  <p class="py-12 text-center text-rose-600">{error}</p>
{:else if orgs.length === 0}
  <div class="card flex flex-col items-center gap-3 px-6 py-16 text-center">
    <div class="text-4xl">🏢</div>
    <h2 class="text-lg font-semibold">{t('Organizations.empty.title')}</h2>
    <p class="max-w-md text-slate-500">
      {t('Organizations.empty.text')}
    </p>
    <button class="btn-primary mt-2" onclick={newOrganization}>{t('Organizations.empty.create')}</button>
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
                {o.isOwner ? t('Organizations.role.owner') : o.isAdmin ? t('Organizations.role.admin') : t('Organizations.role.member')}
              </span>
              <span class="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{o.mode === 'free' ? t('Organizations.mode.free') : t('Organizations.mode.restricted')}</span>
              <span class="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{t('Organizations.members', { count: o.memberCount })}</span>
              <span class="rounded-full px-2 py-0.5 {o.canCreate ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}">
                {o.canCreate ? t('Organizations.canCreate') : t('Organizations.cannotCreate')}
              </span>
            </div>
          </div>
        </div>

        <div class="flex-1 p-5">
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t('Organizations.activeOccasions', { n: active.length })}
          </h3>
          {#if active.length}
            <ul class="space-y-1">
              {#each active as occ (occ.id)}
                <li>
                  <a href="/o/{occ.slug}" onclick={link} class="group flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                    <span class="text-link truncate font-medium group-hover:underline">{occ.title}</span>
                    <span class="shrink-0 text-xs text-slate-500">{range(occ)}</span>
                  </a>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="text-sm text-slate-400">{t('Organizations.noActive')}</p>
          {/if}
          {#if list.length > active.length}
            <p class="mt-2 text-xs text-slate-400">{t('Organizations.archivedMore', { count: list.length - active.length })}</p>
          {/if}
        </div>

        <div class="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          {#if o.isAdmin}
            <a href="/organisations/{o.id}" onclick={link} class="btn-ghost">⚙️ {t('Organizations.manage')}</a>
          {/if}
          {#if o.canCreate}
            <button class="btn-outline" onclick={() => (creatingFor = o.id)}>＋ {t('Organizations.occasion')}</button>
          {/if}
        </div>
      </article>
    {/each}
  </div>
{/if}


{#if creatingFor}
  <CreateOccasion
    {orgs}
    initialOrganizationId={creatingFor}
    onclose={() => (creatingFor = null)}
    oncreated={(o) => navigate(`/o/${o.slug}`)}
  />
{/if}
