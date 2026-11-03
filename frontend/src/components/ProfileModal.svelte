<script>
  import { api } from '../lib/api.js';
  import { session } from '../lib/session.svelte.js';
  import Modal from './Modal.svelte';
  import { t } from '../lib/i18n.svelte.js';

  let name = $state(session.me?.name ?? '');
  let email = $state(session.me?.email ?? '');
  let error = $state('');
  let saving = $state(false);
  // Password: optional, to find the account again on another device or after the cookie is lost.
  let pwOpen = $state(false);
  let password = $state('');
  let currentPassword = $state('');
  const hasPassword = $derived(!!session.me?.hasPassword);

  // First visit (no name yet): the person may already have an account, from another browser or device.
  const welcome = !session.me?.name;
  const loginHref = `/connexion?retour=${encodeURIComponent(location.pathname + location.hash)}`;
  const norm = (s) => (s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const sameName = $derived(
    welcome && norm(name) ? (session.occasionNames.find((n) => norm(n) === norm(name)) ?? null) : null,
  );

  const close = () => {
    session.profileOpen = false;
    session.afterProfile = null;
  };

  async function submit(e) {
    e.preventDefault();
    error = '';
    saving = true;
    try {
      let me = await api.saveMe({ name, email });
      if (pwOpen && password) me = await api.setPassword(password, currentPassword);
      session.me = { ...session.me, ...me };
      const then = session.afterProfile;
      close();
      then?.();
    } catch (err) {
      error = err.message;
    } finally {
      saving = false;
    }
  }

  async function logout() {
    if (!confirm(t('ProfileModal.logoutConfirm'))) return;
    await api.logout();
    location.assign('/');
  }
</script>

<Modal onclose={session.profileRequired ? null : close}>
  <form class="space-y-4 p-6" onsubmit={submit}>
    <div>
      <h2 class="text-lg font-semibold text-slate-900">
        {session.me?.name ? t('ProfileModal.titleProfile') : t('ProfileModal.titleWelcome')}
      </h2>
      <p class="mt-1 text-sm text-slate-500">
        {t('ProfileModal.visibility')}
        <a href="/confidentialite" target="_blank" rel="noopener" class="text-link">{t('ProfileModal.learnMore')}</a>
      </p>
    </div>
    {#if welcome}
      <!-- Full page load: the sign-in page then brings the person back here, on their account -->
      <p class="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
        {t('ProfileModal.alreadyBefore')}
        <a href={loginHref} class="text-link font-medium">{t('ProfileModal.alreadyLink')}</a> {t('ProfileModal.alreadyAfter')}
      </p>
    {/if}
    <div>
      <label class="label" for="pf-name">{t('common.name')}</label>
      <!-- svelte-ignore a11y_autofocus -->
      <input id="pf-name" class="input" bind:value={name} required maxlength="100" autofocus autocomplete="name" />
    </div>
    <div>
      <label class="label" for="pf-email">
        {t('common.email')}
        {#if !hasPassword && !pwOpen}<span class="font-normal text-slate-400">{t('common.optional')}</span>{/if}
      </label>
      <input id="pf-email" type="email" class="input" bind:value={email} maxlength="255" autocomplete="email" required={hasPassword || pwOpen} />
    </div>
    {#if sameName}
      <div class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
        <strong>{sameName}</strong> {t('ProfileModal.sameNameBefore')}
        <a href={loginHref} class="font-medium underline">{t('ProfileModal.sameNameLink')}</a> {t('ProfileModal.sameNameAfter')}
      </div>
    {/if}
    {#if session.me?.name}
      <div class="rounded-xl border border-slate-200 p-3">
        {#if !pwOpen}
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm text-slate-600">
              {#if hasPassword}
                {t('ProfileModal.passwordSet')}
              {:else}
                {t('ProfileModal.passwordChoose')}
              {/if}
            </p>
            <button type="button" class="btn-outline shrink-0" onclick={() => (pwOpen = true)}>
              {hasPassword ? t('ProfileModal.change') : t('ProfileModal.choose')}
            </button>
          </div>
        {:else}
          <div class="space-y-3">
            {#if hasPassword}
              <div>
                <label class="label" for="pf-current">{t('ProfileModal.currentPassword')}</label>
                <input id="pf-current" type="password" class="input" bind:value={currentPassword} required autocomplete="current-password" />
              </div>
            {/if}
            <div>
              <label class="label" for="pf-password">{hasPassword ? t('ProfileModal.newPassword') : t('common.password')}</label>
              <input id="pf-password" type="password" class="input" bind:value={password} required minlength="8" autocomplete="new-password" />
              <p class="mt-1 text-xs text-slate-500">{t('ProfileModal.passwordHelp')}</p>
            </div>
          </div>
        {/if}
      </div>
    {/if}
    {#if error}<p class="text-sm text-rose-600">{error}</p>{/if}
    <div class="flex flex-wrap justify-end gap-2 pt-2">
      {#if hasPassword}
        <button type="button" class="btn-ghost mr-auto text-slate-500" onclick={logout}>{t('ProfileModal.logout')}</button>
      {/if}
      {#if !session.profileRequired}
        <button type="button" class="btn-ghost" onclick={close}>{t('common.cancel')}</button>
      {/if}
      <button class="btn-primary" disabled={saving}>{saving ? t('common.saving') : t('ProfileModal.continue')}</button>
    </div>
  </form>
</Modal>
