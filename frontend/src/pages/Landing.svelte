<script>
  // Presentation page for a visitor without an account (accounts are only created by an invitation link).
  import { REPO_URL } from '../lib/project.js';
  import { session } from '../lib/session.svelte.js';
  import { link } from '../lib/router.svelte.js';
  import { asset } from '../lib/assets.js';
  import { t, th } from '../lib/i18n.svelte.js';

  const FEATURE_ICONS = ['🗓️', '🖱️', '⚡', '📊', '✉️', '🏢', '🎨', '🌐', '🔒'];
  const FEATURES = $derived(
    FEATURE_ICONS.map((icon, i) => ({ icon, title: t(`Landing.features.${i}.title`), text: t(`Landing.features.${i}.text`) })),
  );

  const SHOT_FILES = [
    { src: asset('/captures/calendrier-semaine.png'), w: 1440, h: 1000 },
    { src: asset('/captures/rapport-sombre.png'), w: 1440, h: 900 },
    { src: asset('/captures/mes-occasions.png'), w: 1440, h: 760 },
    { src: asset('/captures/creer-logo.png'), w: 1440, h: 900 },
  ];
  const SHOTS = $derived(
    SHOT_FILES.map((f, i) => ({
      ...f,
      title: t(`Landing.shots.${i}.title`),
      text: t(`Landing.shots.${i}.text`),
      alt: t(`Landing.shots.${i}.alt`),
    })),
  );
  const [HERO, ...OTHER_SHOTS] = $derived(SHOTS);
</script>

<div class="space-y-16 pb-6 sm:space-y-20">
  <!-- Hero -->
  <section class="mx-auto max-w-3xl pt-4 text-center sm:pt-8">
    <img src={asset('/logo-disponibilites.png')} alt={t('common.appName')} class="mx-auto h-14 w-auto sm:h-20" />
    <h1 class="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{t('Landing.heroTitle')}</h1>
    <p class="mt-4 text-lg text-slate-600">
      {@html th('Landing.heroText')}
    </p>

    {#if session.me?.id}
      <!-- Already invited (page opened from the footer's "À propos") -->
      <div class="mt-8 flex flex-wrap justify-center gap-3">
        <a href="/" onclick={link} class="btn-primary px-5 py-2.5">🗓️ {t('common.myOccasions')}</a>
        <a href="/organisations" onclick={link} class="btn-outline px-5 py-2.5">🏢 {t('common.organizations')}</a>
      </div>
    {:else}
    <div class="mx-auto mt-8 max-w-xl rounded-2xl border border-indigo-200 bg-indigo-50 p-5 text-left">
      <h2 class="flex items-center gap-2 font-semibold text-indigo-900">{t('Landing.inviteTitle')}</h2>
      <p class="mt-1.5 text-sm text-indigo-900/80">
        {t('Landing.inviteText')}
      </p>
      <p class="mt-2 text-sm text-indigo-900/70">
        {t('Landing.inviteDevice')}
      </p>
      <p class="mt-2 text-sm text-indigo-900/70">
        {t('Landing.passwordBefore')} <a href="/connexion" onclick={link} class="text-link font-medium">{t('Landing.passwordLink')}</a>
        {t('Landing.passwordAfter')}
      </p>
    </div>
    {/if}
  </section>

  <!-- Main screenshot -->
  <figure class="mx-auto max-w-5xl">
    <img
      src={HERO.src} width={HERO.w} height={HERO.h} alt={HERO.alt}
      class="h-auto w-full rounded-xl border border-slate-200 shadow-xl"
    />
    <figcaption class="mx-auto mt-5 max-w-2xl text-center">
      <span class="block text-lg font-semibold text-slate-900">{HERO.title}</span>
      <span class="mt-1 block text-slate-600">{HERO.text}</span>
    </figcaption>
  </figure>

  <!-- Features -->
  <section>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each FEATURES as f (f.title)}
        <div class="card p-5">
          <div class="text-2xl">{f.icon}</div>
          <h3 class="mt-2 font-semibold text-slate-900">{f.title}</h3>
          <p class="mt-1 text-sm text-slate-600">{f.text}</p>
        </div>
      {/each}
    </div>
  </section>

  <!-- Screenshots with their explanation, alternating sides -->
  {#each OTHER_SHOTS as s, i (s.src)}
    <section class="grid items-center gap-6 lg:grid-cols-[2fr_3fr] lg:gap-10">
      <div class={i % 2 ? 'lg:order-2' : ''}>
        <h2 class="text-2xl font-bold text-slate-900">{s.title}</h2>
        <p class="mt-2 text-slate-600">{s.text}</p>
      </div>
      <img
        src={s.src} width={s.w} height={s.h} alt={s.alt} loading="lazy"
        class="h-auto w-full rounded-xl border border-slate-200 shadow-lg {i % 2 ? 'lg:order-1' : ''}"
      />
    </section>
  {/each}

  <section class="grid items-center gap-6 lg:grid-cols-[3fr_2fr] lg:gap-10">
    <div>
      <h2 class="text-2xl font-bold text-slate-900">{t('Landing.mobileTitle')}</h2>
      <p class="mt-2 text-slate-600">
        {t('Landing.mobileText')}
      </p>
    </div>
    <img
      src={asset('/captures/mobile-editeur.png')} width="780" height="1688" loading="lazy"
      alt={t('Landing.mobileAlt')}
      class="mx-auto h-auto w-full max-w-[280px] rounded-3xl border border-slate-200 shadow-lg"
    />
  </section>

  <section class="text-center text-sm text-slate-500">
    {t('Landing.freeProject')}
    <a href={REPO_URL} target="_blank" rel="noopener" class="text-link font-medium">{t('Landing.seeSource')}</a>
  </section>
</div>
