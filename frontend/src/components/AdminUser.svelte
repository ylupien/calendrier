<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { link } from '../lib/router.svelte.js';
  import { session } from '../lib/session.svelte.js';
  import { fmtShort, fmtDateTime } from '../lib/dates.js';
  import Modal from './Modal.svelte';

  // userId = null: new account (pre-associated with organizations and occasions); otherwise the account's file.
  // organizations, occasions, users: every one of them (admin lists), for the pickers.
  let { userId = null, organizations, occasions, users, onclose, onchanged } = $props();

  // svelte-ignore state_referenced_locally
  let id = $state(userId);
  let user = $state(null);
  let name = $state('');
  let email = $state('');
  let password = $state('');
  let removePassword = $state(false);
  let isSiteAdmin = $state(false);
  let error = $state('');
  let notice = $state('');
  let saving = $state(false);
  // New account: associations chosen before creating it.
  let newOrgs = $state(new Set());
  let newOccasions = $state(new Set());
  // Existing account: pickers.
  let addOrg = $state('');
  let addOccasion = $state('');
  let mergeInto = $state('');
  let signIn = $state(null); // { url, expires }
  let copied = $state(false);

  async function load() {
    try {
      user = await api.admin.user(id);
      name = user.name ?? '';
      email = user.email ?? '';
      isSiteAdmin = user.isSiteAdmin;
      password = '';
      removePassword = false;
    } catch (e) {
      error = e.message;
    }
  }

  onMount(() => {
    if (id) load();
  });

  async function run(action, message = '') {
    error = '';
    notice = '';
    saving = true;
    try {
      const res = await action();
      if (res?.id) user = res;
      notice = message;
      onchanged?.();
      return res;
    } catch (e) {
      error = e.message;
    } finally {
      saving = false;
    }
  }

  async function save(e) {
    e.preventDefault();
    if (!id) {
      const created = await run(() =>
        api.admin.createUser({
          name,
          email,
          password: password || undefined,
          organizationIds: [...newOrgs],
          occasionIds: [...newOccasions],
        }),
      );
      if (created) {
        id = created.id;
        await load();
        notice = 'Compte créé. Donnez-lui un lien de connexion, ou son courriel et son mot de passe.';
      }
      return;
    }
    const data = { name, email, isSiteAdmin };
    if (removePassword) data.password = null;
    else if (password) data.password = password;
    if (await run(() => api.admin.updateUser(id, data), 'Compte enregistré.')) {
      password = '';
      removePassword = false;
    }
  }

  async function makeSignInLink() {
    const res = await run(() => api.admin.signInLink(id));
    if (res) {
      const base = session.me?.publicUrl ?? location.origin;
      signIn = { url: `${base}${res.path}`, expires: new Date(Date.now() + res.ttlSeconds * 1000) };
      copied = false;
    }
  }

  async function copySignIn() {
    try {
      await navigator.clipboard.writeText(signIn.url);
    } catch {
      window.prompt('Copiez ce lien :', signIn.url);
    }
    copied = true;
  }

  async function merge() {
    const target = users.find((u) => u.id === Number(mergeInto));
    if (!target) return;
    const msg =
      `Fusionner ce compte dans celui de ${target.name ?? 'sans nom'} (n° ${target.id}) ?\n\n` +
      'Ses occasions, plages et organisations y seront ajoutées, puis ce compte sera supprimé. ' +
      'Les appareils qui l’utilisaient devront se reconnecter.';
    if (!confirm(msg)) return;
    const into = await run(() => api.admin.mergeUser(id, target.id));
    if (into) {
      id = into.id;
      mergeInto = '';
      await load();
      notice = `Fusion terminée : vous voyez maintenant le compte n° ${into.id}.`;
    }
  }

  async function remove() {
    if (!confirm(`Supprimer définitivement le compte de ${user.name ?? 'sans nom'} (n° ${user.id}) et ses plages ?`)) return;
    if (await run(() => api.admin.deleteUser(id))) onclose();
  }

  const activeOrgIds = $derived(new Set(user?.organizations.filter((g) => !g.removed).map((g) => g.id) ?? []));
  const activeOccasionIds = $derived(new Set(user?.occasions.filter((o) => !o.removed).map((o) => o.id) ?? []));
  // Merge targets: accounts with the same name first (lost-cookie duplicates).
  const mergeTargets = $derived(
    users
      .filter((u) => u.id !== id)
      .sort((a, b) => (b.name === user?.name) - (a.name === user?.name) || (a.name ?? '').localeCompare(b.name ?? '')),
  );

  const toggle = (set, value) => {
    const next = new Set(set);
    next.has(value) ? next.delete(value) : next.add(value);
    return next;
  };
  // Database datetimes ("YYYY-MM-DD HH:MM:SS") → readable.
  const when = (s) => (s ? fmtDateTime(s.slice(0, 16).replace(' ', 'T')) : '—');
  const occasionLabel = (o) => `${o.title}${o.firstDay ? ` · ${fmtShort(o.firstDay)}` : ''}`;
</script>

<Modal {onclose} size="max-w-2xl">
  <div class="flex items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
    <h2 class="text-lg font-semibold text-slate-900">
      {#if !id}Nouveau compte{:else}{user?.name ?? 'Compte sans nom'} <span class="text-sm font-normal text-slate-400">n° {id}</span>{/if}
    </h2>
    <button class="btn-ghost px-2 text-lg leading-none" onclick={onclose} aria-label="Fermer">×</button>
  </div>

  <div class="space-y-6 p-5">
    {#if id && !user && !error}
      <p class="py-8 text-center text-slate-400">Chargement…</p>
    {:else}
      {#if user}
        <p class="text-xs text-slate-500">
          Créé le {when(user.createdAt)} · vu le {when(user.lastSeenAt)} ·
          {user.slotCount} plage{user.slotCount > 1 ? 's' : ''}
        </p>
      {/if}

      <!-- Identity and sign-in -->
      <form class="space-y-3" onsubmit={save}>
        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <label class="label" for="au-name">Nom</label>
            <input id="au-name" class="input" bind:value={name} required maxlength="100" autocomplete="off" />
          </div>
          <div>
            <label class="label" for="au-email">Courriel</label>
            <input id="au-email" type="email" class="input" bind:value={email} maxlength="255" autocomplete="off" />
          </div>
        </div>
        <div>
          <label class="label" for="au-password">
            {user?.hasPassword ? 'Nouveau mot de passe' : 'Mot de passe'}
            <span class="font-normal text-slate-400">({user?.hasPassword ? 'vide : inchangé' : 'facultatif'})</span>
          </label>
          <input id="au-password" type="text" class="input font-mono" bind:value={password} minlength="8"
            disabled={removePassword} autocomplete="off" placeholder="Au moins 8 caractères" />
          <p class="mt-1 text-xs text-slate-500">
            Communiquez-le à la personne avec son courriel : elle se connecte à la page
            <a href="/connexion" onclick={link} class="text-link">/connexion</a> et peut le changer dans son profil.
          </p>
        </div>
        {#if user}
          <div class="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-700">
            {#if user.hasPassword}
              <label class="flex items-center gap-2">
                <input type="checkbox" class="h-4 w-4 accent-indigo-600" bind:checked={removePassword} />Retirer le mot de passe
              </label>
            {/if}
            <label class="flex items-center gap-2">
              <input type="checkbox" class="h-4 w-4 accent-indigo-600" bind:checked={isSiteAdmin} disabled={user.id === session.me?.id} />
              Administrateur du site
            </label>
          </div>
        {/if}

        {#if !id}
          <!-- New account: where it is expected -->
          <div class="grid gap-4 sm:grid-cols-2">
            <fieldset>
              <legend class="label">Organisations</legend>
              <div class="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {#each organizations as g (g.id)}
                  <label class="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" class="h-4 w-4 accent-indigo-600" checked={newOrgs.has(g.id)} onchange={() => (newOrgs = toggle(newOrgs, g.id))} />
                    {g.name}
                  </label>
                {:else}<p class="text-sm text-slate-400">Aucune organisation.</p>{/each}
              </div>
            </fieldset>
            <fieldset>
              <legend class="label">Occasions</legend>
              <div class="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {#each occasions as o (o.id)}
                  <label class="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" class="h-4 w-4 accent-indigo-600" checked={newOccasions.has(o.id)} onchange={() => (newOccasions = toggle(newOccasions, o.id))} />
                    <span class="truncate">{occasionLabel(o)}</span>
                  </label>
                {:else}<p class="text-sm text-slate-400">Aucune occasion.</p>{/each}
              </div>
              <p class="mt-1 text-xs text-slate-500">Une occasion ajoute aussi son organisation.</p>
            </fieldset>
          </div>
        {/if}

        {#if error}<p class="text-sm text-rose-600">{error}</p>{/if}
        {#if notice}<p class="text-sm text-emerald-700">{notice}</p>{/if}
        <div class="flex justify-end">
          <button class="btn-primary" disabled={saving}>{id ? 'Enregistrer' : 'Créer le compte'}</button>
        </div>
      </form>

      {#if user}
        <!-- Sign-in link: the simplest way to hand an account over -->
        <section class="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="text-sm font-semibold text-slate-800">Lien de connexion</h3>
              <p class="text-xs text-slate-500">À usage unique, valide 7 jours : l'ouvrir connecte l'appareil à ce compte.</p>
            </div>
            <button class="btn-outline" onclick={makeSignInLink} disabled={saving}>{signIn ? 'Nouveau lien' : 'Créer un lien'}</button>
          </div>
          {#if signIn}
            <div class="mt-3 flex items-center gap-2">
              <input class="input min-w-0 flex-1 bg-surface font-mono text-xs" readonly value={signIn.url} onfocus={(e) => e.currentTarget.select()} />
              <button class="btn-primary shrink-0" onclick={copySignIn}>{copied ? '✓ Copié' : 'Copier'}</button>
            </div>
          {/if}
        </section>

        <!-- Organizations -->
        <section>
          <h3 class="mb-2 text-sm font-semibold text-slate-800">Organisations</h3>
          <ul class="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {#each user.organizations as g (g.id)}
              <li class="flex items-center gap-2 px-3 py-2 text-sm {g.removed ? 'text-slate-400' : 'text-slate-700'}">
                <span class="flex-1 truncate">
                  {g.name}
                  {#if g.isOwner}<span class="text-xs text-slate-400">· responsable</span>{:else if g.isAdmin}<span class="text-xs text-indigo-600">· admin</span>{/if}
                  {#if g.removed}<span class="text-xs">· retiré</span>{/if}
                </span>
                {#if g.removed}
                  <button class="btn-ghost px-2 py-1 text-xs" onclick={() => run(() => api.admin.addToOrganization(id, g.id))}>Réintégrer</button>
                {:else if !g.isOwner}
                  <button class="btn-ghost px-2 py-1 text-xs text-rose-600" onclick={() => run(() => api.admin.removeFromOrganization(id, g.id))}>Retirer</button>
                {/if}
              </li>
            {:else}
              <li class="px-3 py-2 text-sm text-slate-400">Aucune organisation.</li>
            {/each}
          </ul>
          <div class="mt-2 flex gap-2">
            <select class="input min-w-0 flex-1" bind:value={addOrg}>
              <option value="">Ajouter à une organisation…</option>
              {#each organizations.filter((g) => !activeOrgIds.has(g.id)) as g (g.id)}<option value={g.id}>{g.name}</option>{/each}
            </select>
            <button class="btn-outline shrink-0" disabled={!addOrg || saving}
              onclick={async () => { await run(() => api.admin.addToOrganization(id, Number(addOrg))); addOrg = ''; }}>Ajouter</button>
          </div>
        </section>

        <!-- Occasions -->
        <section>
          <h3 class="mb-2 text-sm font-semibold text-slate-800">Occasions</h3>
          <ul class="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {#each user.occasions as o (o.id)}
              <li class="flex items-center gap-2 px-3 py-2 text-sm {o.removed ? 'text-slate-400' : 'text-slate-700'}">
                <a href="/o/{o.slug}" onclick={link} class="flex-1 truncate hover:underline">{occasionLabel(o)}</a>
                <span class="shrink-0 text-xs text-slate-400">
                  {o.slotCount} plage{o.slotCount > 1 ? 's' : ''}{o.isCreator ? ' · créateur' : ''}{o.removed ? ' · retiré' : ''}
                </span>
                {#if o.removed}
                  <button class="btn-ghost px-2 py-1 text-xs" onclick={() => run(() => api.admin.addToOccasion(id, o.id))}>Réinviter</button>
                {:else if !o.isCreator}
                  <button class="btn-ghost px-2 py-1 text-xs text-rose-600"
                    onclick={() => confirm(`Retirer de « ${o.title} » ? Ses plages dans cette occasion seront supprimées.`) && run(() => api.admin.removeFromOccasion(id, o.id))}>Retirer</button>
                {/if}
              </li>
            {:else}
              <li class="px-3 py-2 text-sm text-slate-400">Aucune occasion.</li>
            {/each}
          </ul>
          <div class="mt-2 flex gap-2">
            <select class="input min-w-0 flex-1" bind:value={addOccasion}>
              <option value="">Inviter à une occasion…</option>
              {#each occasions.filter((o) => !activeOccasionIds.has(o.id)) as o (o.id)}<option value={o.id}>{occasionLabel(o)}</option>{/each}
            </select>
            <button class="btn-outline shrink-0" disabled={!addOccasion || saving}
              onclick={async () => { await run(() => api.admin.addToOccasion(id, Number(addOccasion))); addOccasion = ''; }}>Inviter</button>
          </div>
        </section>

        <!-- Merge and delete -->
        {#if user.id !== session.me?.id}
          <section class="space-y-3 rounded-xl border border-rose-200 p-4">
            <h3 class="text-sm font-semibold text-rose-700">Zone sensible</h3>
            <div>
              <p class="mb-2 text-xs text-slate-500">
                Même personne, plusieurs comptes ? Fusionnez celui-ci dans l'autre : tout y est déplacé, puis ce compte est supprimé.
              </p>
              <div class="flex gap-2">
                <select class="input min-w-0 flex-1" bind:value={mergeInto}>
                  <option value="">Fusionner dans le compte…</option>
                  {#each mergeTargets as u (u.id)}
                    <option value={u.id}>{u.name ?? '(sans nom)'} · n° {u.id}{u.email ? ` · ${u.email}` : ''} · {u.slotCount} plage{u.slotCount > 1 ? 's' : ''}</option>
                  {/each}
                </select>
                <button class="btn-outline shrink-0 text-rose-600" disabled={!mergeInto || saving} onclick={merge}>Fusionner</button>
              </div>
            </div>
            <div class="flex items-center justify-between gap-3 border-t border-rose-100 pt-3">
              <p class="text-xs text-slate-500">
                {user.ownedCount ? 'Ce compte possède des occasions ou des organisations : il ne peut pas être supprimé.' : 'Supprime le compte, ses plages et ses adhésions.'}
              </p>
              <button class="btn-ghost shrink-0 text-rose-600" disabled={!!user.ownedCount || saving} onclick={remove}>Supprimer le compte</button>
            </div>
          </section>
        {/if}
      {/if}
    {/if}
  </div>
</Modal>
