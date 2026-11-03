<script>
  import { onOrgChange } from '../lib/orgLive.svelte.js';
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { link, navigate } from '../lib/router.svelte.js';
  import { fmtShort, fmtMedium, todayStr } from '../lib/dates.js';
  import AdminUser from '../components/AdminUser.svelte';
  import OrgLogo from '../components/OrgLogo.svelte';
  import { t } from '../lib/i18n.svelte.js';

  // Tab in the address: /admin/comptes, /admin/organisations, /admin/occasions (see App.svelte).
  let { section = 'comptes' } = $props();
  const SECTIONS = { users: 'comptes', organizations: 'organisations', occasions: 'occasions' };
  const tab = $derived(Object.keys(SECTIONS).find((id) => SECTIONS[id] === section) ?? 'users');
  let users = $state([]);
  let organizations = $state([]);
  let occasions = $state([]);
  let loading = $state(true);
  let error = $state('');
  let query = $state('');
  let showNameless = $state(false);
  let openUser = $state(undefined); // undefined = closed, null = new account, id = account

  async function load() {
    try {
      [users, organizations, occasions] = await Promise.all([
        api.admin.users(),
        api.admin.organizations(),
        api.admin.occasions(),
      ]);
      error = '';
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  onMount(load);
  // An organization changed (name, logo) or was deleted: reload.
  onOrgChange(() => load());

  const norm = (s) => (s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  // Same name on several accounts: usually someone who lost their cookie.
  const nameCounts = $derived(
    users.reduce((m, u) => (u.name ? m.set(norm(u.name), (m.get(norm(u.name)) ?? 0) + 1) : m), new Map()),
  );
  const shownUsers = $derived(
    users.filter((u) => {
      if (!u.name && !showNameless) return false;
      const q = norm(query.trim());
      return !q || norm(u.name).includes(q) || norm(u.email).includes(q) || String(u.id) === q;
    }),
  );
  const namelessCount = $derived(users.filter((u) => !u.name).length);
  const shownOccasions = $derived(
    occasions.filter((o) => {
      const q = norm(query.trim());
      return !q || norm(o.title).includes(q) || norm(o.organizationName).includes(q) || norm(o.creatorName).includes(q);
    }),
  );

  async function deleteOrganization(g) {
    const msg =
      `${t('Admin.deleteOrg.question', { name: g.name })}\n\n` +
      `${t('Admin.deleteOrg.members', { count: g.memberCount })} ` +
      t('Admin.deleteOrg.occasions', { count: g.occasionCount });
    if (!confirm(msg)) return;
    try {
      await api.deleteOrganization(g.id);
      await load();
    } catch (e) {
      alert(e.message);
    }
  }

  async function deleteOccasion(o) {
    const msg =
      `${t('Admin.deleteOccasion.question', { title: o.title })}\n\n` +
      t('Admin.deleteOccasion.details', { count: o.guestCount });
    if (!confirm(msg)) return;
    try {
      await api.admin.deleteOccasion(o.id);
      await load();
    } catch (e) {
      alert(e.message);
    }
  }

  const when = (s) => (s ? fmtShort(s.slice(0, 10)) : '—');
  const ended = (o) => o.archived || (!!o.lastDay && o.lastDay < todayStr());

  const TABS = $derived([
    { id: 'users', label: `👤 ${t('Admin.tabs.users')}` },
    { id: 'organizations', label: `🏢 ${t('Admin.tabs.organizations')}` },
    { id: 'occasions', label: `🗓️ ${t('Admin.tabs.occasions')}` },
  ]);
</script>

<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
  <div>
    <h1 class="text-2xl font-bold text-slate-900">{t('Admin.title')}</h1>
    <p class="mt-1 text-slate-500">{t('Admin.intro')}</p>
  </div>
  {#if tab === 'users'}
    <button class="btn-primary" onclick={() => (openUser = null)}>＋ {t('Admin.newAccount')}</button>
  {/if}
</div>

<div class="mb-4 flex flex-wrap items-center gap-3">
  <div class="flex gap-1 border-b border-slate-200">
    {#each TABS as tb (tb.id)}
      <a
        href="/admin/{SECTIONS[tb.id]}"
        onclick={link}
        class="-mb-px border-b-2 px-4 py-2 text-sm font-medium transition {tab === tb.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}"
      >{tb.label}</a>
    {/each}
  </div>
  {#if tab !== 'organizations'}
    <input class="input ml-auto w-full sm:w-64" type="search" bind:value={query} placeholder={t('Admin.search')} />
  {/if}
</div>

{#if loading}
  <p class="py-12 text-center text-slate-400">{t('common.loading')}</p>
{:else if error}
  <p class="py-12 text-center text-rose-600">{error}</p>
{:else if tab === 'users'}
  <div class="card overflow-hidden">
    <ul class="divide-y divide-slate-100">
      {#each shownUsers as u (u.id)}
        {@const dup = u.name ? nameCounts.get(norm(u.name)) : 0}
        <li>
          <button class="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-slate-50" onclick={() => (openUser = u.id)}>
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium text-slate-800">
                {u.name ?? t('Admin.noName')}
                <span class="text-xs font-normal text-slate-400">{t('Admin.number', { id: u.id })}</span>
                {#if u.isSiteAdmin}<span class="ml-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">{t('Admin.adminBadge')}</span>{/if}
                {#if dup > 1}<span class="ml-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700" title={t('Admin.duplicateTitle')}>{t('Admin.duplicate', { n: dup })}</span>{/if}
              </span>
              <span class="block truncate text-sm text-slate-500">{u.email ?? t('Admin.noEmail')}</span>
            </span>
            <span class="flex shrink-0 items-center gap-3 text-xs text-slate-500">
              <span title={u.hasPassword ? t('Admin.hasPassword') : t('Admin.noPassword')}>{u.hasPassword ? '🔑' : '—'}</span>
              <span>{t('Admin.slots', { count: u.slotCount })}</span>
              <span>{t('Admin.occasions', { count: u.occasionCount })}</span>
              <span class="w-20 text-right" title={t('Admin.lastSeenTitle')}>{t('Admin.seen', { when: when(u.lastSeenAt) })}</span>
            </span>
          </button>
        </li>
      {:else}
        <li class="px-4 py-8 text-center text-slate-400">{t('Admin.noAccounts')}</li>
      {/each}
    </ul>
  </div>
  {#if namelessCount}
    <label class="mt-3 flex items-center gap-2 text-sm text-slate-500">
      <input type="checkbox" class="h-4 w-4 accent-indigo-600" bind:checked={showNameless} />
      {t('Admin.showNameless', { count: namelessCount })}
    </label>
  {/if}
{:else if tab === 'organizations'}
  <div class="card overflow-hidden">
    <ul class="divide-y divide-slate-100">
      {#each organizations as g (g.id)}
        <li class="flex items-center hover:bg-slate-50">
          <button class="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left" onclick={() => navigate(`/admin/organisations/${g.id}`)}>
            <!-- Same width whatever the logo, so the names line up -->
            <span class="flex w-24 shrink-0 items-center"><OrgLogo org={g} size="h-9" maxWidth="max-w-24" /></span>
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium text-slate-800">{g.name}</span>
              <span class="block truncate text-sm text-slate-500">{t('Admin.owner', { name: g.ownerName ?? t('Admin.noName') })}</span>
            </span>
            <span class="flex shrink-0 gap-3 text-xs text-slate-500">
              <span>{t('Admin.members', { count: g.memberCount })}</span>
              <span>{t('Admin.occasions', { count: g.occasionCount })}</span>
              <span>{g.mode === 'free' ? t('Admin.modeFree') : t('Admin.modeRestricted')}</span>
            </span>
          </button>
          <button class="btn-ghost mr-2 shrink-0 px-2.5 text-rose-600" onclick={() => deleteOrganization(g)}
            title={t('Admin.deleteOrgTitle')} aria-label={t('Admin.deleteOrgLabel', { name: g.name })}>🗑️</button>
        </li>
      {:else}
        <li class="px-4 py-8 text-center text-slate-400">{t('Admin.noOrganizations')}</li>
      {/each}
    </ul>
  </div>
{:else}
  <div class="card overflow-hidden">
    <ul class="divide-y divide-slate-100">
      {#each shownOccasions as o (o.id)}
        <li class="flex items-center hover:bg-slate-50">
          <a href="/o/{o.slug}" onclick={link} class="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 {ended(o) ? 'opacity-60' : ''}">
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium text-slate-800">{o.title}</span>
              <span class="block truncate text-sm text-slate-500">
                {o.organizationName ? `🏢 ${o.organizationName} · ` : ''}{t('Admin.createdBy', { name: o.creatorName ?? t('Admin.noName') })}
              </span>
            </span>
            <span class="flex shrink-0 gap-3 text-xs text-slate-500">
              <span>{o.firstDay ? (o.firstDay === o.lastDay ? fmtMedium(o.firstDay) : `${fmtShort(o.firstDay)} → ${fmtMedium(o.lastDay)}`) : '—'}</span>
              <span>{t('Admin.guests', { count: o.guestCount })}</span>
              {#if ended(o)}<span>{t('Admin.archived')}</span>{/if}
            </span>
          </a>
          <button class="btn-ghost mr-2 shrink-0 px-2.5 text-rose-600" onclick={() => deleteOccasion(o)}
            title={t('Admin.deleteOccasionTitle')} aria-label={t('Admin.deleteOccasionLabel', { title: o.title })}>🗑️</button>
        </li>
      {:else}
        <li class="px-4 py-8 text-center text-slate-400">{t('Admin.noOccasions')}</li>
      {/each}
    </ul>
  </div>
{/if}

{#if openUser !== undefined}
  <AdminUser
    userId={openUser}
    {organizations}
    {occasions}
    {users}
    onclose={() => { openUser = undefined; load(); }}
    onchanged={load}
  />
{/if}

