<script>
  import { onMount } from 'svelte';
  import { api } from './lib/api.js';
  import { route, link } from './lib/router.svelte.js';
  import { session, askProfile } from './lib/session.svelte.js';
  import { initials } from './lib/colors.js';
  import Home from './pages/Home.svelte';
  import Occasion from './pages/Occasion.svelte';
  import Organizations from './pages/Organizations.svelte';
  import ProfileModal from './components/ProfileModal.svelte';
  import OrgLogo from './components/OrgLogo.svelte';
  import LinkDevice from './components/LinkDevice.svelte';
  import LinkClaim from './pages/LinkClaim.svelte';
  import Landing from './pages/Landing.svelte';
  import Privacy from './pages/Privacy.svelte';
  import Terms from './pages/Terms.svelte';
  import Login from './pages/Login.svelte';
  import Admin from './pages/Admin.svelte';
  import { REPO_URL } from './lib/project.js';
  import { theme, nextTheme, THEME_LABELS, THEME_ICONS } from './lib/theme.svelte.js';
  import { lockScroll } from './lib/scrollLock.js';
  import { asset } from './lib/assets.js';
  import Modal from './components/Modal.svelte';

  let error = $state('');
  let linking = $state(false);
  let menuOpen = $state(false);
  let logoZoom = $state(false); // occasion's logo shown large

  // The page behind the open phone menu must not scroll.
  $effect(() => {
    if (menuOpen) return lockScroll();
  });

  // Close the phone menu when the page changes.
  $effect(() => {
    route.path;
    menuOpen = false;
  });

  // Opening the app calls /api/me, which creates the permanent identification cookie.
  onMount(async () => {
    try {
      session.me = await api.me();
    } catch (e) {
      error = e.message;
    }
  });

  const NAV = $derived([
    { href: '/', label: 'Occasions', icon: '🗓️', active: (p) => p === '/' || p.startsWith('/o/') },
    { href: '/organisations', label: 'Organisations', icon: '🏢', active: (p) => p.startsWith('/organisations') },
    ...(session.me?.isSiteAdmin
      ? [{ href: '/admin', label: 'Administration', icon: '🛡️', active: (p) => p.startsWith('/admin') }]
      : []),
  ]);

  const linkToken = $derived(route.path.match(/^\/lier\/([\w-]+)\/?$/)?.[1] ?? null);
  const occasionSlug = $derived(route.path.match(/^\/o\/([\w-]+)\/?$/)?.[1] ?? null);
  // The presentation page (same rules as the routing below) already shows the logo, large, in its center.
  const showsLanding = $derived(
    !!session.me &&
      !linkToken &&
      !occasionSlug &&
      !['/confidentialite', '/conditions', '/connexion'].includes(route.path) &&
      (route.path === '/a-propos' || !session.me.id),
  );
</script>

<header class="sticky top-0 z-40 border-b border-slate-200 bg-surface/90 backdrop-blur">
  <div class="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:h-16">
    <!-- Fixed width on wide screens: the menu stays in the same place whatever the logo's width -->
    {#if session.branding}
      <div class="flex min-w-0 items-center gap-2.5 sm:gap-3 lg:w-80 lg:shrink-0">
        <!-- Same width whatever the logo (or initials), so the menu does not move between occasions -->
        <span class="flex shrink-0 items-center sm:w-28">
          <span class="group relative inline-flex">
            <a href="/" onclick={link}><OrgLogo org={session.branding} size="h-8 sm:h-10" maxWidth="max-w-28" /></a>
            {#if session.branding.logoUrl}
              <!-- Hover shortcut: see the logo large -->
              <button
                class="absolute -right-2 -bottom-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-surface text-[10px] text-slate-600 opacity-0 shadow transition group-hover:opacity-100 hover:bg-slate-100 focus-visible:opacity-100"
                onclick={() => (logoZoom = true)}
                title="Agrandir le logo"
                aria-label="Agrandir le logo"
              >🔍</button>
            {/if}
          </span>
        </span>
        <span class="h-6 w-px shrink-0 bg-slate-300 sm:h-7"></span>
        <a href="/" onclick={link} class="flex min-w-0 items-center gap-2.5 text-slate-900 sm:gap-3">
          <img src={asset('/logo-mark.png')} alt="" class="h-8 w-auto shrink-0" />
          <span class="truncate font-semibold">Disponibilités</span>
        </a>
      </div>
    {:else if showsLanding}
      <!-- No logo here (the page shows it in its center); same width so the menu does not move -->
      <span class="hidden lg:block lg:w-80 lg:shrink-0"></span>
    {:else}
      <a href="/" onclick={link} class="flex min-w-0 items-center lg:w-80 lg:shrink-0">
        <img src={asset('/logo-disponibilites.png')} alt="Disponibilités" class="h-9 w-auto max-w-full sm:h-11" />
      </a>
    {/if}

    <!-- Computer: links and buttons in the bar -->
    <!-- Without an account (no invitation yet) there is nothing to navigate to -->
    <nav class="ml-6 mr-auto hidden gap-1 {session.me?.id ? 'sm:flex' : ''}">
      {#each NAV as n (n.href)}
        <a
          href={n.href}
          onclick={link}
          class="rounded-lg px-3 py-1.5 text-sm font-medium transition {n.active(route.path) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}"
        >{n.label}</a>
      {/each}
    </nav>
    {#if session.me && !session.me.id && route.path !== '/connexion'}
      <!-- No account on this device: sign in with an email and a password -->
      <a href="/connexion" onclick={link} class="btn-outline ml-auto">Se connecter</a>
    {/if}
    <button class="btn-ghost px-2.5 {session.me?.id ? 'hidden sm:inline-flex' : route.path === '/connexion' ? 'ml-auto' : ''}" onclick={nextTheme} title="{THEME_LABELS[theme.mode]} — cliquer pour changer" aria-label={THEME_LABELS[theme.mode]}>
      {THEME_ICONS[theme.mode]}
    </button>
    {#if session.me?.id}
      <button class="btn-ghost hidden px-2.5 sm:inline-flex" onclick={() => (linking = true)} title="Utiliser mon compte sur mon cellulaire (code QR)">
        📱<span class="hidden lg:inline">Lier un cellulaire</span>
      </button>
    {/if}
    {#if session.me?.name}
      <button class="btn-ghost hidden sm:inline-flex" onclick={() => askProfile()} title="Modifier mon profil">
        <span class="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
          {initials(session.me.name)}
        </span>
        <span class="hidden md:inline">{session.me.name}</span>
      </button>
    {/if}

    <!-- Phone: one menu button -->
    {#if session.me?.id}
    <button
      class="ml-auto flex shrink-0 items-center gap-2 rounded-full border border-slate-200 py-1 pl-1 pr-3 sm:hidden"
      onclick={() => (menuOpen = !menuOpen)}
      aria-expanded={menuOpen}
      aria-label="Menu"
    >
      <span class="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
        {session.me?.name ? initials(session.me.name) : '?'}
      </span>
      <span class="text-lg leading-none text-slate-600">{menuOpen ? '✕' : '☰'}</span>
    </button>
    {/if}
  </div>

  {#if menuOpen}
    <div class="fixed inset-x-0 bottom-0 top-14 z-40 touch-none sm:hidden">
      <button class="absolute inset-0 cursor-default bg-black/30" aria-label="Fermer le menu" tabindex="-1" onclick={() => (menuOpen = false)}></button>
      <nav class="relative border-b border-slate-200 bg-surface px-3 pb-4 pt-2 shadow-lg">
        {#each NAV as n (n.href)}
          <a
            href={n.href}
            onclick={(e) => { menuOpen = false; link(e); }}
            class="flex items-center gap-3 rounded-xl px-3 py-3 text-base font-medium {n.active(route.path) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 active:bg-slate-100'}"
          ><span class="w-6 text-center">{n.icon}</span>{n.label}</a>
        {/each}
        <div class="my-2 border-t border-slate-100"></div>
        {#if session.me?.id}
          <button class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-base text-slate-700 active:bg-slate-100"
            onclick={() => { menuOpen = false; linking = true; }}>
            <span class="w-6 text-center">📱</span>Lier un cellulaire
          </button>
        {/if}
        <button class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-base text-slate-700 active:bg-slate-100" onclick={nextTheme}>
          <span class="w-6 text-center">{THEME_ICONS[theme.mode]}</span>{THEME_LABELS[theme.mode]}
          <span class="ml-auto text-xs text-slate-400">changer</span>
        </button>
        {#if session.me?.id}
        <button class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left active:bg-slate-100"
          onclick={() => { menuOpen = false; askProfile(); }}>
          <span class="w-6 text-center">👤</span>
          <span class="min-w-0">
            <span class="block truncate text-base text-slate-700">{session.me?.name ?? 'Mon profil'}</span>
            {#if session.me?.email}<span class="block truncate text-xs text-slate-500">{session.me.email}</span>{/if}
          </span>
        </button>
        {/if}
      </nav>
    </div>
  {/if}
</header>

<main class="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:py-8">
  {#if error}
    <div class="card p-6 text-center text-rose-600">Impossible de joindre le serveur : {error}</div>
  {:else if !session.me}
    <div class="py-24 text-center text-slate-400">Chargement…</div>
  {:else if linkToken}
    {#key linkToken}<LinkClaim token={linkToken} />{/key}
  {:else if occasionSlug}
    {#key occasionSlug}
      <Occasion slug={occasionSlug} />
    {/key}
  {:else if route.path === '/confidentialite'}
    <Privacy />
  {:else if route.path === '/conditions'}
    <Terms />
  {:else if route.path === '/connexion'}
    <Login />
  {:else if route.path === '/a-propos'}
    <!-- Presentation page, also reachable once invited (footer link) -->
    <Landing />
  {:else if !session.me.id}
    <!-- No account yet: presentation of the project (only an invitation link creates an account) -->
    <Landing />
  {:else if route.path.startsWith('/organisations')}
    <Organizations />
  {:else if route.path.startsWith('/admin') && session.me.isSiteAdmin}
    <Admin />
  {:else}
    <Home />
  {/if}
</main>

<!-- Authors (stays at the bottom of the screen, even on short pages) -->
<footer class="border-t border-slate-200">
  <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-5 text-xs text-slate-500">
    <span>Conçu par <span class="font-medium text-slate-700">Yanik Lupien</span> et <span class="font-medium text-slate-700">Claude</span></span>
    <span aria-hidden="true" class="text-slate-300">·</span>
    <a href="/a-propos" onclick={link} class="text-link">À propos</a>
    <span aria-hidden="true" class="text-slate-300">·</span>
    <a href="/confidentialite" onclick={link} class="text-link">Confidentialité et témoins</a>
    <span aria-hidden="true" class="text-slate-300">·</span>
    <a href="/conditions" onclick={link} class="text-link">Conditions d'utilisation</a>
    <span aria-hidden="true" class="text-slate-300">·</span>
    <a href={REPO_URL} target="_blank" rel="noopener" class="text-link" title="Code source sur GitHub, versé dans le domaine public">Code source (domaine public)</a>
  </div>
</footer>

{#if logoZoom && session.branding?.logoUrl}
  <Modal onclose={() => (logoZoom = false)} size="max-w-2xl">
    <button class="btn-ghost absolute top-2 right-2 px-2.5" onclick={() => (logoZoom = false)} aria-label="Fermer">✕</button>
    <div class="flex flex-col items-center gap-4 p-6 pt-12 sm:p-10 sm:pt-12">
      <div class="flex w-full justify-center rounded-xl p-4 {session.branding.logoDarkBg ? 'bg-[#0f172a]' : ''}">
        <img src={session.branding.logoUrl} alt={session.branding.name} class="max-h-[60vh] w-auto max-w-full object-contain" />
      </div>
      <p class="text-sm font-medium text-slate-600">{session.branding.name}</p>
    </div>
  </Modal>
{/if}

{#if linking}
  <LinkDevice onclose={() => (linking = false)} />
{/if}

{#if session.profileOpen}
  <ProfileModal />
{/if}
