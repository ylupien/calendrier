<script>
  import { api } from '../lib/api.js';
  import Modal from './Modal.svelte';
  import { t, th } from '../lib/i18n.svelte.js';

  // Invites people by email: an account is prepared for whoever has none, and each person receives a
  // personal link that signs them in and opens the occasion.
  let { occasion, onclose, oninvited } = $props();

  const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
  const MAX = 50;

  let text = $state('');
  let message = $state('');
  let sending = $state(false);
  let error = $state('');
  let results = $state(null); // [{ email, already, mailed }] once sent

  /**
   * One address per line, or separated by commas / semicolons:
   * "marie@exemple.com", "Marie Tremblay <marie@exemple.com>" or "Marie Tremblay marie@exemple.com".
   */
  const entries = $derived.by(() => {
    const seen = new Set();
    const list = [];
    for (const raw of text.split(/[\n,;]+/)) {
      const part = raw.trim();
      if (!part) continue;
      const m = part.match(/^(.*?)\s*<\s*([^>]+?)\s*>\s*$/) ?? part.match(/^(.*?)\s*(\S+@\S+)$/);
      const email = (m ? m[2] : part).toLowerCase();
      const name = (m ? m[1] : '').replace(/^["']|["']$/g, '').trim();
      const valid = EMAIL_RE.test(email);
      if (valid && seen.has(email)) continue;
      seen.add(email);
      list.push({ name, email, valid, raw: part });
    }
    return list;
  });
  const valid = $derived(entries.filter((e) => e.valid));
  const invalid = $derived(entries.filter((e) => !e.valid));

  async function send(e) {
    e.preventDefault();
    error = '';
    sending = true;
    try {
      const res = await api.inviteByEmail(
        occasion.slug,
        valid.map(({ name, email }) => ({ name, email })),
        message,
      );
      results = res.results;
      oninvited(res.participants);
    } catch (err) {
      error = err.message;
    } finally {
      sending = false;
    }
  }

  const sent = $derived(results?.filter((r) => r.mailed) ?? []);
  const failed = $derived(results?.filter((r) => !r.mailed) ?? []);
</script>

<Modal {onclose} size="max-w-lg">
  <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
    <h2 class="text-lg font-semibold text-slate-900">✉️ {t('InviteByEmail.title')}</h2>
    <button class="btn-ghost px-2 text-lg leading-none" onclick={onclose} aria-label={t('common.close')}>×</button>
  </div>

  {#if results}
    <div class="space-y-4 p-6">
      {#if sent.length}
        <div class="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900" role="status">
          📬 {t('InviteByEmail.sent', { count: sent.length })}
        </div>
      {/if}
      <ul class="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
        {#each results as r (r.email)}
          <li class="flex items-center gap-2 px-3 py-2">
            <span class="w-5 text-center">{r.mailed ? '✓' : '⚠️'}</span>
            <span class="min-w-0 flex-1 truncate text-slate-700">{r.email}</span>
            <span class="shrink-0 text-xs {r.mailed ? 'text-slate-400' : 'text-rose-600'}">
              {r.mailed ? (r.already ? t('InviteByEmail.resent') : t('InviteByEmail.invited')) : t('InviteByEmail.notSent')}
            </span>
          </li>
        {/each}
      </ul>
      {#if failed.length}
        <p class="text-sm text-rose-600">
          {t('InviteByEmail.failed', { count: failed.length })}
        </p>
      {/if}
      <div class="flex justify-end gap-2">
        <button class="btn-ghost" onclick={() => { results = null; text = ''; }}>{t('InviteByEmail.more')}</button>
        <button class="btn-primary" onclick={onclose}>{t('InviteByEmail.done')}</button>
      </div>
    </div>
  {:else}
    <form class="space-y-4 p-6" onsubmit={send}>
      <p class="text-sm text-slate-600">
        {@html th('InviteByEmail.intro', { title: occasion.title })}
      </p>
      <div>
        <label class="label" for="inv-emails">{t('InviteByEmail.emails')}</label>
        <!-- svelte-ignore a11y_autofocus -->
        <textarea
          id="inv-emails"
          class="input min-h-28 font-mono text-sm"
          bind:value={text}
          autofocus
          placeholder={t('InviteByEmail.emailsPlaceholder')}
        ></textarea>
        <p class="mt-1 text-xs text-slate-500">{t('InviteByEmail.emailsHelp')}</p>
      </div>

      {#if entries.length}
        <ul class="flex flex-wrap gap-1.5">
          {#each entries as e (e.raw)}
            <li
              class="max-w-full truncate rounded-full px-2.5 py-1 text-xs {e.valid ? 'bg-indigo-50 text-indigo-800' : 'bg-rose-50 text-rose-700 line-through'}"
              title={e.valid ? e.email : t('InviteByEmail.invalid')}
            >{e.name ? `${e.name} · ` : ''}{e.email}</li>
          {/each}
        </ul>
        {#if invalid.length}
          <p class="text-xs text-rose-600">{t('InviteByEmail.invalidCount', { count: invalid.length })}</p>
        {/if}
      {/if}

      <div>
        <label class="label" for="inv-message">{t('InviteByEmail.message')} <span class="font-normal text-slate-400">{t('common.optional')}</span></label>
        <textarea id="inv-message" class="input min-h-20 text-sm" bind:value={message} maxlength="1000"
          placeholder={t('InviteByEmail.messagePlaceholder')}></textarea>
      </div>

      {#if valid.length > MAX}<p class="text-sm text-rose-600">{t('InviteByEmail.max', { max: MAX })}</p>{/if}
      {#if error}<p class="text-sm text-rose-600">{error}</p>{/if}
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-ghost" onclick={onclose}>{t('common.cancel')}</button>
        <button class="btn-primary" disabled={!valid.length || valid.length > MAX || sending}>
          {sending ? t('InviteByEmail.sending') : t('InviteByEmail.send', { count: valid.length })}
        </button>
      </div>
    </form>
  {/if}
</Modal>
