<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { navigate, link } from '../lib/router.svelte.js';
  import { session } from '../lib/session.svelte.js';
  import { t, th } from '../lib/i18n.svelte.js';

  // Phone side: opened from the QR code shown on the computer.
  let { token } = $props();

  let preview = $state(null); // { name, target, current, sameUser }
  let error = $state('');
  let busy = $state(false);
  let merge = $state(true);
  // Sign-in link sent by email: ?retour=/o/abc brings the person back to that page.
  const back = (() => {
    const r = new URLSearchParams(location.search).get('retour') ?? '';
    return /^\/(?![/\\])/.test(r) ? r : null;
  })();
  // Invitation to an occasion by email (?invitation=1): its own wording.
  const invitation = new URLSearchParams(location.search).has('invitation');

  onMount(async () => {
    try {
      preview = await api.linkPreview(token);
      // Already this person's account on this device: straight to the occasion.
      if (preview.sameUser && back) location.replace(back);
    } catch (e) {
      // An invitation shows its own message (see below).
      error = e.message;
    }
  });

  const otherAccount = $derived(preview?.current?.hasData ? preview.current : null);

  const describe = (a) =>
    [
      a.occasions ? t('LinkClaim.occasions', { count: a.occasions }) : null,
      a.slots ? t('LinkClaim.slots', { count: a.slots }) : null,
      a.organizations ? t('LinkClaim.organizations', { count: a.organizations }) : null,
    ]
      .filter(Boolean)
      .join(' · ') || t('LinkClaim.noOccasion');

  async function confirm() {
    busy = true;
    error = '';
    try {
      const user = await api.claimLink(token, otherAccount ? merge : true);
      session.me = { ...session.me, ...user };
      // Full reload when going back to a page: its data and the live connection use the new account.
      if (back) location.assign(back);
      else navigate('/');
    } catch (e) {
      error = e.message;
    } finally {
      busy = false;
    }
  }
</script>

<div class="mx-auto max-w-md">
  <div class="card space-y-5 p-6">
    <div class="text-center">
      <div class="text-4xl">{invitation ? '🎉' : '📱'}</div>
      <h1 class="mt-2 text-xl font-bold text-slate-900">{invitation ? t('LinkClaim.titleInvitation') : t('LinkClaim.title')}</h1>
    </div>

    {#if error && !preview && invitation}
      <p class="text-center text-slate-600">{t('LinkClaim.inviteExpired')}</p>
      {#if session.me?.id && back}
        <!-- Probably already opened on this device -->
        <a href={back} class="btn-primary w-full">{t('LinkClaim.openOccasion')}</a>
      {/if}
      <p class="text-center text-sm text-slate-500">
        {t('LinkClaim.otherDevice')}
      </p>
      <a href="/connexion{back ? `?retour=${encodeURIComponent(back)}` : ''}" onclick={link} class="btn-outline w-full">{t('LinkClaim.newLink')}</a>
    {:else if error && !preview}
      <p class="text-center text-slate-600">{error}</p>
      <a href="/" onclick={link} class="btn-outline w-full">{t('common.goHome')}</a>
    {:else if !preview}
      <p class="py-6 text-center text-slate-400">{t('LinkClaim.checking')}</p>
    {:else if preview.sameUser && back}
      <p class="py-6 text-center text-slate-400">{t('LinkClaim.opening')}</p>
    {:else if preview.sameUser}
      <p class="text-center text-slate-600">{@html th('LinkClaim.alreadyLinked', { name: preview.name ?? t('LinkClaim.thisUser') })}</p>
      <a href="/" onclick={link} class="btn-primary w-full">{t('LinkClaim.seeOccasions')}</a>
    {:else}
      <p class="text-center text-slate-600">
        {#if invitation}
          {@html th('LinkClaim.welcome', { name: preview.name })}
        {:else}
        {@html th('LinkClaim.willUse', { name: preview.name ?? t('LinkClaim.yourComputer') })}
        {/if}
        {#if preview.target?.email}<span class="block text-sm text-slate-400">{preview.target.email}</span>{/if}
      </p>

      {#if otherAccount}
        <div class="space-y-2">
          <p class="text-sm text-slate-600">
            {@html th('LinkClaim.hasAccount', { name: otherAccount.name ?? t('LinkClaim.noName'), summary: describe(otherAccount) })}
          </p>
          <label class="flex cursor-pointer gap-3 rounded-xl border p-3 transition {merge ? 'border-indigo-500 bg-indigo-50/60' : 'border-slate-200'}">
            <input type="radio" class="mt-1 accent-indigo-600" name="merge" value={true} bind:group={merge} />
            <span>
              <span class="block text-sm font-medium text-slate-800">{t('LinkClaim.merge')}</span>
              <span class="block text-xs text-slate-500">
                {t('LinkClaim.mergeHelp', { name: preview.name ?? t('LinkClaim.theComputer') })}
              </span>
            </span>
          </label>
          <label class="flex cursor-pointer gap-3 rounded-xl border p-3 transition {!merge ? 'border-indigo-500 bg-indigo-50/60' : 'border-slate-200'}">
            <input type="radio" class="mt-1 accent-indigo-600" name="merge" value={false} bind:group={merge} />
            <span>
              <span class="block text-sm font-medium text-slate-800">{t('LinkClaim.keep')}</span>
              <span class="block text-xs text-slate-500">
                {t('LinkClaim.keepHelp', { name: otherAccount.name ?? t('LinkClaim.noName') })}
              </span>
            </span>
          </label>
        </div>
      {/if}

      {#if error}<p class="text-sm text-rose-600">{error}</p>{/if}
      <button class="btn-primary w-full py-2.5" disabled={busy} onclick={confirm}>
        {busy ? t('LinkClaim.linking') : otherAccount && merge ? t('LinkClaim.mergeAndLink') : invitation ? t('LinkClaim.join') : t('LinkClaim.title')}
      </button>
      <a href="/" onclick={link} class="text-link block text-center text-sm">{t('common.cancel')}</a>
    {/if}
  </div>
</div>
