<script>
  // Page shown for an address that matches no page of the application (inside the usual header and footer).
  import { link, route } from '../lib/router.svelte.js';
  import { session } from '../lib/session.svelte.js';
  import { asset } from '../lib/assets.js';
  import { t } from '../lib/i18n.svelte.js';
</script>

<div class="mx-auto flex max-w-xl flex-col items-center py-10 text-center sm:py-16">
  <img src={asset('/logo-mark.png')} alt="" class="h-16 w-auto opacity-90 sm:h-20" />
  <p class="mt-6 text-6xl font-bold tracking-tight text-indigo-600 sm:text-7xl">404</p>
  <h1 class="mt-3 text-2xl font-bold text-slate-900">{t('NotFound.title')}</h1>
  <p class="mt-3 text-slate-600">
    {t('NotFound.addressBefore')}
    <code class="rounded bg-slate-100 px-1.5 py-0.5 text-sm break-all text-slate-700">{route.path}</code>
    {t('NotFound.addressAfter')}
  </p>
  <p class="mt-2 text-sm text-slate-500">
    {t('NotFound.hint')}
  </p>

  <div class="mt-8 flex flex-wrap justify-center gap-3">
    {#if session.me?.id}
      <a href="/" onclick={link} class="btn-primary px-5 py-2.5">🗓️ {t('common.myOccasions')}</a>
      <a href="/organisations" onclick={link} class="btn-outline px-5 py-2.5">🏢 {t('common.organizations')}</a>
    {:else}
      <a href="/" onclick={link} class="btn-primary px-5 py-2.5">{t('common.goHome')}</a>
    {/if}
  </div>
</div>
