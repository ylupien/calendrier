<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { link } from '../lib/router.svelte.js';
  import { hashTab } from '../lib/hashTab.svelte.js';
  import { fmtShort, fmtMedium, todayStr } from '../lib/dates.js';
  import AdminUser from '../components/AdminUser.svelte';
  import OrganizationEditor from '../components/OrganizationEditor.svelte';
  import OrgLogo from '../components/OrgLogo.svelte';

  // Tab in the address (/admin#comptes…), kept when the page is reloaded.
  const tab = hashTab({ users: 'comptes', organizations: 'organisations', occasions: 'occasions' }, 'users');
  let users = $state([]);
  let organizations = $state([]);
  let occasions = $state([]);
  let loading = $state(true);
  let error = $state('');
  let query = $state('');
  let showNameless = $state(false);
  let openUser = $state(undefined); // undefined = closed, null = new account, id = account
  let openOrg = $state(undefined);

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
      `Supprimer l'organisation « ${g.name} » ?\n\n` +
      `Ses ${g.memberCount} membre(s) en sont retirés et son logo est effacé. ` +
      `Ses ${g.occasionCount} occasion(s) sont conservées, sans organisation.`;
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
      `Supprimer définitivement l'occasion « ${o.title} » ?\n\n` +
      `Ses journées, ses ${o.guestCount} invité(s) et toutes leurs plages seront effacés. Cette action est irréversible.`;
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

  const TABS = [
    { id: 'users', label: '👤 Comptes' },
    { id: 'organizations', label: '🏢 Organisations' },
    { id: 'occasions', label: '🗓️ Occasions' },
  ];
</script>

<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
  <div>
    <h1 class="text-2xl font-bold text-slate-900">Administration</h1>
    <p class="mt-1 text-slate-500">Tous les comptes, organisations et occasions du site.</p>
  </div>
  {#if tab.value === 'users'}
    <button class="btn-primary" onclick={() => (openUser = null)}>＋ Nouveau compte</button>
  {/if}
</div>

<div class="mb-4 flex flex-wrap items-center gap-3">
  <div class="flex gap-1 border-b border-slate-200">
    {#each TABS as t (t.id)}
      <button
        class="-mb-px border-b-2 px-4 py-2 text-sm font-medium transition {tab.value === t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}"
        onclick={() => (tab.value = t.id)}
      >{t.label}</button>
    {/each}
  </div>
  {#if tab.value !== 'organizations'}
    <input class="input ml-auto w-full sm:w-64" type="search" bind:value={query} placeholder="Rechercher…" />
  {/if}
</div>

{#if loading}
  <p class="py-12 text-center text-slate-400">Chargement…</p>
{:else if error}
  <p class="py-12 text-center text-rose-600">{error}</p>
{:else if tab.value === 'users'}
  <div class="card overflow-hidden">
    <ul class="divide-y divide-slate-100">
      {#each shownUsers as u (u.id)}
        {@const dup = u.name ? nameCounts.get(norm(u.name)) : 0}
        <li>
          <button class="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-slate-50" onclick={() => (openUser = u.id)}>
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium text-slate-800">
                {u.name ?? '(sans nom)'}
                <span class="text-xs font-normal text-slate-400">n° {u.id}</span>
                {#if u.isSiteAdmin}<span class="ml-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">admin</span>{/if}
                {#if dup > 1}<span class="ml-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700" title="Plusieurs comptes portent ce nom">doublon ×{dup}</span>{/if}
              </span>
              <span class="block truncate text-sm text-slate-500">{u.email ?? 'sans courriel'}</span>
            </span>
            <span class="flex shrink-0 items-center gap-3 text-xs text-slate-500">
              <span title={u.hasPassword ? 'Peut se connecter avec un mot de passe' : 'Aucun mot de passe'}>{u.hasPassword ? '🔑' : '—'}</span>
              <span>{u.slotCount} plage{u.slotCount > 1 ? 's' : ''}</span>
              <span>{u.occasionCount} occasion{u.occasionCount > 1 ? 's' : ''}</span>
              <span class="w-20 text-right" title="Dernière visite">vu {when(u.lastSeenAt)}</span>
            </span>
          </button>
        </li>
      {:else}
        <li class="px-4 py-8 text-center text-slate-400">Aucun compte.</li>
      {/each}
    </ul>
  </div>
  {#if namelessCount}
    <label class="mt-3 flex items-center gap-2 text-sm text-slate-500">
      <input type="checkbox" class="h-4 w-4 accent-indigo-600" bind:checked={showNameless} />
      Afficher les {namelessCount} comptes sans nom (lien ouvert, profil jamais rempli)
    </label>
  {/if}
{:else if tab.value === 'organizations'}
  <div class="card overflow-hidden">
    <ul class="divide-y divide-slate-100">
      {#each organizations as g (g.id)}
        <li class="flex items-center hover:bg-slate-50">
          <button class="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left" onclick={() => (openOrg = g.id)}>
            <!-- Same width whatever the logo, so the names line up -->
            <span class="flex w-24 shrink-0 items-center"><OrgLogo org={g} size="h-9" maxWidth="max-w-24" /></span>
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium text-slate-800">{g.name}</span>
              <span class="block truncate text-sm text-slate-500">Responsable : {g.ownerName ?? '(sans nom)'}</span>
            </span>
            <span class="flex shrink-0 gap-3 text-xs text-slate-500">
              <span>{g.memberCount} membre{g.memberCount > 1 ? 's' : ''}</span>
              <span>{g.occasionCount} occasion{g.occasionCount > 1 ? 's' : ''}</span>
              <span>{g.mode === 'free' ? 'libre' : 'autorisé'}</span>
            </span>
          </button>
          <button class="btn-ghost mr-2 shrink-0 px-2.5 text-rose-600" onclick={() => deleteOrganization(g)}
            title="Supprimer l'organisation" aria-label="Supprimer l'organisation {g.name}">🗑️</button>
        </li>
      {:else}
        <li class="px-4 py-8 text-center text-slate-400">Aucune organisation.</li>
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
                {o.organizationName ? `🏢 ${o.organizationName} · ` : ''}créée par {o.creatorName ?? '(sans nom)'}
              </span>
            </span>
            <span class="flex shrink-0 gap-3 text-xs text-slate-500">
              <span>{o.firstDay ? (o.firstDay === o.lastDay ? fmtMedium(o.firstDay) : `${fmtShort(o.firstDay)} → ${fmtMedium(o.lastDay)}`) : '—'}</span>
              <span>{o.guestCount} invité{o.guestCount > 1 ? 's' : ''}</span>
              {#if ended(o)}<span>archivée</span>{/if}
            </span>
          </a>
          <button class="btn-ghost mr-2 shrink-0 px-2.5 text-rose-600" onclick={() => deleteOccasion(o)}
            title="Supprimer l'occasion" aria-label="Supprimer l'occasion {o.title}">🗑️</button>
        </li>
      {:else}
        <li class="px-4 py-8 text-center text-slate-400">Aucune occasion.</li>
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

{#if openOrg !== undefined}
  <OrganizationEditor orgId={openOrg} onclose={() => (openOrg = undefined)} onchanged={load} />
{/if}
