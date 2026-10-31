<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import Modal from './Modal.svelte';
  import OrgLogo from './OrgLogo.svelte';

  // orgId = null: creation form; otherwise the organization editor (owner only).
  let { orgId = null, onclose, onchanged } = $props();

  // svelte-ignore state_referenced_locally
  let id = $state(orgId);
  let org = $state(null);
  let name = $state('');
  let mode = $state('free');
  let error = $state('');
  let saving = $state(false);
  let uploading = $state(false);
  let fileInput = $state(null);

  const MODES = [
    { id: 'free', label: 'Libre', help: 'Tous les membres peuvent créer des occasions.' },
    { id: 'restricted', label: 'Autorisé', help: 'Seuls les membres cochés ci-dessous peuvent créer des occasions.' },
  ];

  async function load() {
    try {
      org = await api.organization(id);
      name = org.name;
      mode = org.mode;
    } catch (e) {
      error = e.message;
    }
  }

  onMount(() => {
    if (id) load();
  });

  async function run(fn) {
    error = '';
    try {
      await fn();
    } catch (e) {
      error = e.message;
    }
  }

  async function submit(e) {
    e.preventDefault();
    saving = true;
    await run(async () => {
      if (!id) {
        const created = await api.createOrganization({ name, mode });
        id = created.id;
        await load(); // continue in the editor (logo, members)
      } else {
        const updated = await api.updateOrganization(id, { name, mode });
        org = { ...org, ...updated };
      }
      onchanged?.();
    });
    saving = false;
  }

  async function onFile(e) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    uploading = true;
    await run(async () => {
      org = { ...org, ...(await api.uploadLogo(id, file)) };
      onchanged?.();
    });
    uploading = false;
  }

  const removeLogo = () =>
    run(async () => {
      org = { ...org, ...(await api.deleteLogo(id)) };
      onchanged?.();
    });

  const setDarkBg = (value) =>
    run(async () => {
      org = { ...org, ...(await api.updateOrganization(id, { logoDarkBg: value })) };
      onchanged?.();
    });

  const activeMembers = $derived((org?.members ?? []).filter((m) => !m.removed));
  const removedMembers = $derived((org?.members ?? []).filter((m) => m.removed));

  const setMember = (m, data) =>
    run(async () => {
      org.members = await api.setMember(id, m.id, data);
    });

  async function removeMember(m) {
    if (!confirm(`Retirer ${m.name} de l'organisation ? Il ne verra plus ses occasions « tous les membres » et ne pourra plus en créer.`)) return;
    await run(async () => {
      org.members = await api.removeMember(id, m.id);
      onchanged?.();
    });
  }

  const restoreMember = (m) =>
    run(async () => {
      org.members = await api.restoreMember(id, m.id);
      onchanged?.();
    });

  async function remove() {
    if (!confirm(`Supprimer l'organisation « ${org.name} » ? Ses occasions sont conservées, sans organisation.`)) return;
    await run(async () => {
      await api.deleteOrganization(id);
      onchanged?.();
      onclose();
    });
  }
</script>

<Modal {onclose} size="max-w-2xl">
  <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
    <h2 class="text-lg font-semibold text-slate-900">{id ? "Gérer l'organisation" : 'Nouvelle organisation'}</h2>
    <button class="btn-ghost px-2 text-lg leading-none" onclick={onclose} aria-label="Fermer">×</button>
  </div>

  <div class="space-y-6 p-6">
    <form class="space-y-4" onsubmit={submit}>
      <div>
        <label class="label" for="org-name">Nom</label>
        <input id="org-name" class="input" bind:value={name} required maxlength="150" placeholder="Ex. : Club de randonnée" />
      </div>
      <fieldset>
        <legend class="label">Création d'occasions</legend>
        <div class="grid gap-2 sm:grid-cols-2">
          {#each MODES as m (m.id)}
            <label class="flex cursor-pointer gap-3 rounded-xl border p-3 transition {mode === m.id ? 'border-indigo-500 bg-indigo-50/60' : 'border-slate-200 hover:border-slate-300'}">
              <input type="radio" class="mt-0.5 accent-indigo-600" name="org-mode" value={m.id} bind:group={mode} />
              <span>
                <span class="block text-sm font-medium text-slate-800">Mode {m.label.toLowerCase()}</span>
                <span class="block text-xs text-slate-500">{m.help}</span>
              </span>
            </label>
          {/each}
        </div>
      </fieldset>
      <div class="flex justify-end">
        <button class="btn-primary" disabled={saving}>
          {saving ? 'Enregistrement…' : id ? 'Enregistrer' : "Créer l'organisation"}
        </button>
      </div>
    </form>

    {#if org}
      <section class="space-y-3 border-t border-slate-200 pt-5">
        <h3 class="text-sm font-semibold text-slate-800">Logo</h3>
        <div class="flex flex-wrap items-center gap-4">
          <div class="flex h-20 min-w-40 items-center justify-center rounded-xl border border-dashed border-slate-300 p-3 {org.logoDarkBg ? 'bg-slate-900' : 'bg-white'}">
            {#if org.logoUrl}
              <img src={org.logoUrl} alt="Logo" class="h-12 w-auto max-w-56 object-contain" />
            {:else}
              <span class="text-xs text-slate-400">Aucun logo</span>
            {/if}
          </div>
          <div class="flex flex-col gap-2">
            <div class="flex gap-2">
              <button class="btn-outline" onclick={() => fileInput.click()} disabled={uploading}>
                {uploading ? 'Envoi…' : org.logoUrl ? 'Changer le logo' : 'Ajouter un logo'}
              </button>
              {#if org.logoUrl}<button class="btn-ghost text-rose-600" onclick={removeLogo}>Retirer</button>{/if}
            </div>
            <label class="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" class="h-4 w-4 rounded accent-indigo-600" checked={org.logoDarkBg} onchange={(e) => setDarkBg(e.currentTarget.checked)} />
              Afficher sur fond sombre (logo blanc)
            </label>
            <span class="text-xs text-slate-400">PNG, JPEG, WebP, GIF ou SVG · 2 Mo max</span>
          </div>
          <input bind:this={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" class="hidden" onchange={onFile} />
        </div>
      </section>

      <section class="space-y-3 border-t border-slate-200 pt-5">
        <div>
          <h3 class="text-sm font-semibold text-slate-800">Membres <span class="font-normal text-slate-400">({activeMembers.length})</span></h3>
          <p class="text-xs text-slate-500">
            Les personnes qui ouvrent le lien d'une occasion de l'organisation en deviennent membres automatiquement.
            Les administrateurs gèrent l'organisation et les invités de ses occasions, comme le responsable.
            {#if org.mode === 'free'}En mode libre, tous les membres peuvent créer des occasions.{/if}
          </p>
        </div>
        <ul class="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {#each activeMembers as m (m.id)}
            {@const createLocked = m.isOwner || m.isAdmin || org.mode === 'free'}
            <li class="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium text-slate-800">
                  {m.name}
                  {#if m.isOwner}<span class="text-xs font-normal text-slate-400">· responsable</span>
                  {:else if m.isAdmin}<span class="text-xs font-normal text-indigo-600">· admin</span>{/if}
                </div>
                <div class="truncate text-xs text-slate-500">{m.email}</div>
              </div>
              <label class="flex shrink-0 items-center gap-1.5 text-sm {m.isOwner ? 'text-slate-400' : 'text-slate-700'}">
                <input type="checkbox" class="h-4 w-4 rounded accent-indigo-600" checked={m.isAdmin} disabled={m.isOwner}
                  onchange={() => setMember(m, { isAdmin: !m.isAdmin })} />
                Admin
              </label>
              <label class="flex shrink-0 items-center gap-1.5 text-sm {createLocked ? 'text-slate-400' : 'text-slate-700'}"
                title={createLocked ? (org.mode === 'free' ? 'Mode libre : tous les membres peuvent créer' : 'Responsable et admins peuvent toujours créer') : ''}>
                <input type="checkbox" class="h-4 w-4 rounded accent-indigo-600"
                  checked={createLocked || m.canCreate} disabled={createLocked}
                  onchange={() => setMember(m, { canCreate: !m.canCreate })} />
                Peut créer
              </label>
              {#if !m.isOwner}
                <button class="btn-ghost shrink-0 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50" onclick={() => removeMember(m)}>Retirer</button>
              {:else}
                <span class="w-[58px] shrink-0"></span>
              {/if}
            </li>
          {:else}
            <li class="px-3 py-4 text-center text-sm text-slate-500">Aucun membre pour l'instant.</li>
          {/each}
        </ul>
        {#if removedMembers.length}
          <div>
            <h4 class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Membres retirés</h4>
            <p class="mb-2 text-xs text-slate-500">Ouvrir un lien ne les réintègre pas automatiquement.</p>
            <ul class="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50">
              {#each removedMembers as m (m.id)}
                <li class="flex items-center gap-3 px-3 py-2">
                  <div class="min-w-0 flex-1 text-slate-500">
                    <div class="truncate text-sm">{m.name}</div>
                    <div class="truncate text-xs">{m.email}</div>
                  </div>
                  <button class="btn-outline shrink-0 px-2.5 py-1 text-xs" onclick={() => restoreMember(m)}>Réintégrer</button>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </section>

      <div class="flex justify-between border-t border-slate-200 pt-5">
        {#if org.isOwner}
          <button class="btn text-rose-600 hover:bg-rose-50" onclick={remove}>Supprimer l'organisation</button>
        {:else}<span></span>{/if}
        <button class="btn-outline" onclick={onclose}>Fermer</button>
      </div>
    {/if}

    {#if error}<p class="text-sm text-rose-600">{error}</p>{/if}
  </div>
</Modal>
