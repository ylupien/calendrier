<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { session } from '../lib/session.svelte.js';
  import { link, navigate } from '../lib/router.svelte.js';
  import OrgLogo from './OrgLogo.svelte';
  import LogoGallery from './LogoGallery.svelte';
  import BackgroundPicker from './BackgroundPicker.svelte';
  import { logoView } from '../lib/logoDisplay.svelte.js';
  import { t } from '../lib/i18n.svelte.js';
  import { onOrgChange } from '../lib/orgLive.svelte.js';

  // Page of an organization (/organisations/<id>, owner and administrators), or its creation (/organisations/nouvelle).
  // backHref: page to go back to (the administration's list when opened from there).
  let { orgId = null, backHref = '/organisations', backLabel = null } = $props();
  const back = () => navigate(backHref);

  // svelte-ignore state_referenced_locally
  let id = $state(orgId);
  let org = $state(null);
  let name = $state('');
  let mode = $state('free');
  let error = $state('');
  let saving = $state(false);
  let uploading = $state(false);
  let fileInput = $state(null);

  const MODES = $derived([
    { id: 'free', label: t('OrganizationEditor.modes.free.label'), help: t('OrganizationEditor.modes.free.help') },
    { id: 'restricted', label: t('OrganizationEditor.modes.restricted.label'), help: t('OrganizationEditor.modes.restricted.help') },
  ]);

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

  // Changed by another manager meanwhile: its logos and members are refreshed (not the form being typed).
  onOrgChange(async (last) => {
    if (!id || last?.id !== id) return;
    if (last.deleted) return back();
    try {
      org = { ...org, ...(await api.organization(id)) };
    } catch {
      // shown again at the next change
    }
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
        // Continue on its page (logo, members).
        navigate(`/organisations/${created.id}`);
        return;
      } else {
        const updated = await api.updateOrganization(id, { name, mode });
        org = { ...org, ...updated };
      }
          });
    saving = false;
  }

  async function onFile(e) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (file) await uploadLogo(file);
  }

  // Logos: the custom file and the logos made in the gallery, all kept; the one shown is chosen (shownLogoId).
  let logoTab = $state(null); // null until the organization is loaded: opens on the logo shown
  $effect(() => {
    if (org && logoTab === null) logoTab = org.shownLogoId && org.shownLogoId !== org.customLogoId ? 'gallery' : 'custom';
  });
  const shownKind = $derived(
    !org?.shownLogoId ? null : org.shownLogoId === org.customLogoId ? 'custom' : 'generic',
  );

  async function uploadLogo(file) {
    uploading = true;
    await run(async () => {
      org = { ...org, ...(await api.uploadLogo(id, file)) };
    });
    uploading = false;
  }

  /** Saves a logo made in the gallery; true once done (the creator then closes). */
  async function createLogo({ file, darkFile, ...choices }) {
    uploading = true;
    let ok = false;
    await run(async () => {
      const created = await api.createGenericLogo(id, file, choices);
      org = { ...org, ...created };
      // Following the theme: its image for a dark background too.
      if (darkFile) org = { ...org, ...(await api.uploadLogoDark(id, created.createdLogoId, darkFile)) };
      ok = true;
    });
    uploading = false;
    return ok;
  }

  /** Saves the new choices of a gallery logo; true once done. */
  async function editLogo(logo, { file, darkFile, ...choices }) {
    uploading = true;
    let ok = false;
    await run(async () => {
      org = { ...org, ...(await api.updateGenericLogo(id, logo.id, file, choices)) };
      if (darkFile) org = { ...org, ...(await api.uploadLogoDark(id, logo.id, darkFile)) };
      ok = true;
    });
    uploading = false;
    return ok;
  }

  const showLogo = (logoId) =>
    run(async () => {
      org = { ...org, ...(await api.updateOrganization(id, { logoId })) };
    });

  const deleteLogo = (logoId) =>
    run(async () => {
      org = { ...org, ...(await api.deleteOrgLogo(id, logoId)) };
    });

  const removeLogo = () =>
    run(async () => {
      org = { ...org, ...(await api.deleteLogo(id)) };
          });

  const setBackground = (logoBackground) =>
    run(async () => {
      org = { ...org, ...(await api.updateOrganization(id, { logoBackground })) };
          });

  const activeMembers = $derived((org?.members ?? []).filter((m) => !m.removed));
  const removedMembers = $derived((org?.members ?? []).filter((m) => m.removed));

  const setMember = (m, data) =>
    run(async () => {
      org.members = await api.setMember(id, m.id, data);
    });

  async function removeMember(m) {
    if (!confirm(t('OrganizationEditor.removeMemberConfirm', { name: m.name }))) return;
    await run(async () => {
      org.members = await api.removeMember(id, m.id);
          });
  }

  const restoreMember = (m) =>
    run(async () => {
      org.members = await api.restoreMember(id, m.id);
          });

  async function remove() {
    if (!confirm(t('OrganizationEditor.deleteConfirm', { name: org.name }))) return;
    await run(async () => {
      await api.deleteOrganization(id);
      back();
    });
  }
</script>

<div class="mx-auto max-w-3xl space-y-6">
  <div>
    <a href={backHref} onclick={link} class="text-link text-sm font-medium">← {backLabel ?? t('common.organizations')}</a>
    <div class="mt-3 flex items-center gap-3">
      {#if org}<OrgLogo {org} size="h-10" />{/if}
      <h1 class="min-w-0 truncate text-2xl font-bold text-slate-900">
        {id ? (org?.name ?? t('OrganizationEditor.titleManage')) : t('OrganizationEditor.titleNew')}
      </h1>
    </div>
  </div>

  {#if id && !org && !error}
    <p class="py-10 text-center text-slate-400">{t('common.loading')}</p>
  {/if}

  {#if !id || org}
    <form class="card space-y-4 p-6" onsubmit={submit}>
      <h2 class="font-semibold text-slate-900">{t('OrganizationEditor.general')}</h2>
      <div>
        <label class="label" for="org-name">{t('common.name')}</label>
        <input id="org-name" class="input" bind:value={name} required maxlength="150" placeholder={t('OrganizationEditor.namePlaceholder')} />
      </div>
      <fieldset>
        <legend class="label">{t('OrganizationEditor.creation')}</legend>
        <div class="grid gap-2 sm:grid-cols-2">
          {#each MODES as m (m.id)}
            <label class="flex cursor-pointer gap-3 rounded-xl border p-3 transition {mode === m.id ? 'border-indigo-500 bg-indigo-50/60' : 'border-slate-200 hover:border-slate-300'}">
              <input type="radio" class="mt-0.5 accent-indigo-600" name="org-mode" value={m.id} bind:group={mode} />
              <span>
                <span class="block text-sm font-medium text-slate-800">{m.label}</span>
                <span class="block text-xs text-slate-500">{m.help}</span>
              </span>
            </label>
          {/each}
        </div>
      </fieldset>
      <div class="flex justify-end">
        <button class="btn-primary" disabled={saving}>
          {saving ? t('common.saving') : id ? t('common.save') : t('OrganizationEditor.create')}
        </button>
      </div>
    </form>

  {/if}

    {#if org}
      <section class="card space-y-3 p-6">
        <h2 class="font-semibold text-slate-900">{t('OrganizationEditor.logo')}</h2>
        <div class="flex gap-1 border-b border-slate-200" role="tablist">
          {#each [{ id: 'custom', label: t('OrganizationEditor.logoTabs.custom') }, { id: 'gallery', label: t('OrganizationEditor.logoTabs.gallery') }] as tb (tb.id)}
            <button
              type="button"
              role="tab"
              aria-selected={logoTab === tb.id}
              class="-mb-px flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-sm font-medium transition {logoTab === tb.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}"
              onclick={() => (logoTab = tb.id)}
            >
              {tb.label}
              {#if shownKind === (tb.id === 'gallery' ? 'generic' : 'custom')}
                <!-- The logo shown on the occasions -->
                <span class="h-2 w-2 rounded-full bg-emerald-500" title={t('OrganizationEditor.logoShown')}></span>
              {/if}
            </button>
          {/each}
        </div>
        {#if logoTab === 'gallery'}
          <LogoGallery
            logos={org.genericLogos}
            shownLogoId={org.shownLogoId}
            defaultCaption={org.name}
            busy={uploading}
            onshow={(l) => showLogo(l.id)}
            ondelete={(l) => deleteLogo(l.id)}
            oncreate={createLogo}
            onedit={editLogo}
          />
        {:else}
        {@const customView = logoView({ url: org.customLogoUrl, background: org.customLogoBackground })}
        <div class="flex flex-wrap items-center gap-4">
          <div class="flex h-20 min-w-40 items-center justify-center rounded-xl border border-dashed border-slate-300 p-3 {customView.plateClass || 'bg-surface'}">
            {#if org.customLogoUrl}
              <img src={customView.src} alt={t('OrganizationEditor.logo')} class="h-12 w-auto max-w-56 object-contain" />
            {:else}
              <span class="text-xs text-slate-400">{t('OrganizationEditor.noLogo')}</span>
            {/if}
          </div>
          <div class="flex flex-col gap-2">
            <div class="flex gap-2">
              <button class="btn-outline" onclick={() => fileInput.click()} disabled={uploading}>
                {uploading ? t('OrganizationEditor.uploading') : org.customLogoUrl ? t('OrganizationEditor.changeLogo') : t('OrganizationEditor.addLogo')}
              </button>
              {#if org.customLogoUrl}<button class="btn-ghost text-rose-600" onclick={removeLogo}>{t('OrganizationEditor.remove')}</button>{/if}
            </div>
            {#if org.customLogoUrl}
              {#if shownKind === 'custom'}
                <span class="text-sm font-medium text-emerald-700">✓ {t('OrganizationEditor.logoShown')}</span>
              {:else}
                <button class="btn-outline self-start" onclick={() => showLogo(org.customLogoId)}>{t('OrganizationEditor.showThisLogo')}</button>
              {/if}
            {/if}
            {#if org.customLogoUrl}
              <BackgroundPicker value={org.customLogoBackground} onchange={setBackground} />
            {/if}
            <span class="text-xs text-slate-400">{t('OrganizationEditor.logoFormats')}</span>
          </div>
          <input bind:this={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" class="hidden" onchange={onFile} />
        </div>
        {/if}
      </section>

      <section class="card space-y-3 p-6">
        <div>
          <h2 class="font-semibold text-slate-900">{t('OrganizationEditor.members')} <span class="font-normal text-slate-400">({activeMembers.length})</span></h2>
          <p class="text-xs text-slate-500">
            {t('OrganizationEditor.membersHelp')}
            {#if org.mode === 'free'}{t('OrganizationEditor.membersHelpFree')}{/if}
          </p>
        </div>
        <ul class="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {#each activeMembers as m (m.id)}
            {@const createLocked = m.isOwner || m.isAdmin || org.mode === 'free'}
            <li class="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium text-slate-800">
                  {m.name}
                  {#if m.isOwner}<span class="text-xs font-normal text-slate-400">· {t('OrganizationEditor.ownerTag')}</span>
                  {:else if m.isAdmin}<span class="text-xs font-normal text-indigo-600">· {t('OrganizationEditor.adminTag')}</span>{/if}
                </div>
                {#if m.email}<div class="truncate text-xs text-slate-500">{m.email}</div>{/if}
              </div>
              <label class="flex shrink-0 items-center gap-1.5 text-sm {m.isOwner ? 'text-slate-400' : 'text-slate-700'}">
                <input type="checkbox" class="h-4 w-4 rounded accent-indigo-600" checked={m.isAdmin} disabled={m.isOwner}
                  onchange={() => setMember(m, { isAdmin: !m.isAdmin })} />
                {t('OrganizationEditor.admin')}
              </label>
              <label class="flex shrink-0 items-center gap-1.5 text-sm {createLocked ? 'text-slate-400' : 'text-slate-700'}"
                title={createLocked ? (org.mode === 'free' ? t('OrganizationEditor.createLockedFree') : t('OrganizationEditor.createLockedAdmin')) : ''}>
                <input type="checkbox" class="h-4 w-4 rounded accent-indigo-600"
                  checked={createLocked || m.canCreate} disabled={createLocked}
                  onchange={() => setMember(m, { canCreate: !m.canCreate })} />
                {t('OrganizationEditor.canCreate')}
              </label>
              {#if !m.isOwner}
                <button class="btn-ghost shrink-0 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50" onclick={() => removeMember(m)}>{t('OrganizationEditor.remove')}</button>
              {:else}
                <span class="w-[58px] shrink-0"></span>
              {/if}
            </li>
          {:else}
            <li class="px-3 py-4 text-center text-sm text-slate-500">{t('OrganizationEditor.noMembers')}</li>
          {/each}
        </ul>
        {#if removedMembers.length}
          <div>
            <h4 class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('OrganizationEditor.removedMembers')}</h4>
            <p class="mb-2 text-xs text-slate-500">{t('OrganizationEditor.removedHelp')}</p>
            <ul class="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50">
              {#each removedMembers as m (m.id)}
                <li class="flex items-center gap-3 px-3 py-2">
                  <div class="min-w-0 flex-1 text-slate-500">
                    <div class="truncate text-sm">{m.name}</div>
                    {#if m.email}<div class="truncate text-xs">{m.email}</div>{/if}
                  </div>
                  <button class="btn-outline shrink-0 px-2.5 py-1 text-xs" onclick={() => restoreMember(m)}>{t('OrganizationEditor.restore')}</button>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </section>

      {#if org.isOwner || session.me?.isSiteAdmin}
        <div class="flex justify-start">
          <button class="btn text-rose-600 hover:bg-rose-50" onclick={remove}>{t('OrganizationEditor.delete')}</button>
        </div>
      {/if}
    {/if}

    {#if error}<p class="text-sm text-rose-600">{error}</p>{/if}
</div>
