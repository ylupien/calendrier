<script>
  import { onMount, onDestroy } from 'svelte';
  import QRCode from 'qrcode';
  import { api } from '../lib/api.js';
  import { session } from '../lib/session.svelte.js';
  import Modal from './Modal.svelte';
  import { t } from '../lib/i18n.svelte.js';

  // Computer side: shows a one-time QR code; the phone that scans it becomes the same user.
  let { onclose } = $props();

  let link = $state(null); // { id, url, expiresAt }
  let qr = $state('');
  let status = $state('pending'); // 'pending' | 'used' | 'expired'
  let remaining = $state(0);
  let error = $state('');
  let copied = $state(false);
  let timer;

  // Phones cannot reach localhost: the QR code uses the public address when there is one.
  const base = () => session.me?.publicUrl || location.origin;

  async function generate() {
    error = '';
    status = 'pending';
    try {
      const tk = await api.createLink();
      const url = `${base()}/lier/${tk.token}`;
      link = { id: tk.id, url, expiresAt: Date.now() + tk.ttlSeconds * 1000 };
      remaining = tk.ttlSeconds;
      qr = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0f172a', light: '#ffffff' } });
    } catch (e) {
      error = e.message;
    }
  }

  async function tick() {
    if (!link || status !== 'pending') return;
    remaining = Math.max(0, Math.round((link.expiresAt - Date.now()) / 1000));
    if (remaining === 0) {
      status = 'expired';
      return;
    }
    // Check every 2 seconds whether the phone has used the code.
    if (remaining % 2 === 0) {
      try {
        const s = await api.linkStatus(link.id);
        if (s.used) status = 'used';
        else if (s.expired) status = 'expired';
      } catch {
        // temporary network error: try again on the next tick
      }
    }
  }

  onMount(() => {
    generate();
    timer = setInterval(tick, 1000);
  });
  onDestroy(() => clearInterval(timer));

  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link.url);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      window.prompt(t('LinkDevice.copyPrompt'), link.url);
    }
  }
</script>

<Modal {onclose} size="max-w-md">
  <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
    <h2 class="text-lg font-semibold text-slate-900">{t('LinkDevice.title')}</h2>
    <button class="btn-ghost px-2 text-lg leading-none" onclick={onclose} aria-label={t('common.close')}>×</button>
  </div>

  <div class="space-y-4 p-6 text-center">
    {#if status === 'used'}
      <div class="py-6">
        <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">✓</div>
        <p class="mt-4 font-semibold text-slate-900">{t('LinkDevice.linked')}</p>
        <p class="mt-1 text-sm text-slate-500">{t('LinkDevice.linkedText')}</p>
      </div>
      <button class="btn-primary w-full" onclick={onclose}>{t('LinkDevice.done')}</button>
    {:else}
      <p class="text-sm text-slate-600">
        {t('LinkDevice.scan')}
      </p>
      <div class="relative mx-auto aspect-square w-60 rounded-xl border border-slate-200 bg-white p-2">
        {#if qr}
          <div class="h-full w-full {status === 'expired' ? 'opacity-10 blur-[2px]' : ''} [&_svg]:h-full [&_svg]:w-full">{@html qr}</div>
        {/if}
        {#if status === 'expired'}
          <div class="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <p class="text-sm font-medium text-slate-700">{t('LinkDevice.expired')}</p>
            <button class="btn-primary" onclick={generate}>{t('LinkDevice.newCode')}</button>
          </div>
        {/if}
      </div>
      {#if status === 'pending' && link}
        <p class="text-xs text-slate-500">
          {t('LinkDevice.validFor')} <span class="font-medium tabular-nums">{mmss(remaining)}</span> · {t('LinkDevice.singleUse')}
          <span class="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-indigo-500" title={t('LinkDevice.waiting')}></span>
        </p>
        <button class="text-xs text-indigo-600 hover:underline" onclick={copy}>{copied ? t('LinkDevice.copied') : t('LinkDevice.copyInstead')}</button>
      {/if}
      <p class="rounded-lg bg-amber-50 px-3 py-2 text-left text-xs text-amber-800">
        {t('LinkDevice.warning')}
      </p>
    {/if}
    {#if error}<p class="text-sm text-rose-600">{error}</p>{/if}
  </div>
</Modal>
