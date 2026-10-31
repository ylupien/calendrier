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

  let error = $state('');
  let linking = $state(false);
  let menuOpen = $state(false);

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

  const NAV = [
    { href: '/', label: 'Occasions', icon: '🗓️', active: (p) => p === '/' || p.startsWith('/o/') },
    { href: '/organisations', label: 'Organisations', icon: '🏢', active: (p) => p.startsWith('/organisations') },
  ];

  const linkToken = $derived(route.path.match(/^\/lier\/([\w-]+)\/?$/)?.[1] ?? null);
  const occasionSlug = $derived(route.path.match(/^\/o\/([\w-]+)\/?$/)?.[1] ?? null);
</script>

<header class="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
  <div class="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:h-16">
    <a href="/" onclick={link} class="flex min-w-0 items-center gap-2.5 text-slate-900 sm:gap-3">
      {#if session.branding}
        <OrgLogo org={session.branding} size="h-8 sm:h-10" />
        <span class="h-6 w-px shrink-0 bg-slate-300 sm:h-7"></span>
      {:else}
        <img src="/favicon.svg" alt="" class="h-8 w-8 shrink-0" />
      {/if}
      <span class="truncate font-semibold">Disponibilités</span>
    </a>

    <!-- Computer: links and buttons in the bar -->
    <nav class="ml-6 mr-auto hidden gap-1 sm:flex">
      {#each NAV as n (n.href)}
        <a
          href={n.href}
          onclick={link}
          class="rounded-lg px-3 py-1.5 text-sm font-medium transition {n.active(route.path) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}"
        >{n.label}</a>
      {/each}
    </nav>
    <button class="btn-ghost hidden px-2.5 sm:inline-flex" onclick={() => (linking = true)} title="Utiliser mon compte sur mon cellulaire (code QR)">
      📱<span class="hidden lg:inline">Lier un cellulaire</span>
    </button>
    {#if session.me?.name}
      <button class="btn-ghost hidden sm:inline-flex" onclick={() => askProfile()} title="Modifier mon profil">
        <span class="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
          {initials(session.me.name)}
        </span>
        <span class="hidden md:inline">{session.me.name}</span>
      </button>
    {/if}

    <!-- Phone: one menu button -->
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
  </div>

  {#if menuOpen}
    <div class="fixed inset-x-0 bottom-0 top-14 z-40 sm:hidden">
      <button class="absolute inset-0 cursor-default bg-slate-900/30" aria-label="Fermer le menu" tabindex="-1" onclick={() => (menuOpen = false)}></button>
      <nav class="relative border-b border-slate-200 bg-white px-3 pb-4 pt-2 shadow-lg">
        {#each NAV as n (n.href)}
          <a
            href={n.href}
            onclick={(e) => { menuOpen = false; link(e); }}
            class="flex items-center gap-3 rounded-xl px-3 py-3 text-base font-medium {n.active(route.path) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 active:bg-slate-100'}"
          ><span class="w-6 text-center">{n.icon}</span>{n.label}</a>
        {/each}
        <div class="my-2 border-t border-slate-100"></div>
        <button class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-base text-slate-700 active:bg-slate-100"
          onclick={() => { menuOpen = false; linking = true; }}>
          <span class="w-6 text-center">📱</span>Lier un cellulaire
        </button>
        <button class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left active:bg-slate-100"
          onclick={() => { menuOpen = false; askProfile(); }}>
          <span class="w-6 text-center">👤</span>
          <span class="min-w-0">
            <span class="block truncate text-base text-slate-700">{session.me?.name ?? 'Mon profil'}</span>
            {#if session.me?.email}<span class="block truncate text-xs text-slate-500">{session.me.email}</span>{/if}
          </span>
        </button>
      </nav>
    </div>
  {/if}
</header>

<main class="mx-auto max-w-7xl px-4 py-6 sm:py-8">
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
  {:else if route.path.startsWith('/organisations')}
    <Organizations />
  {:else}
    <Home />
  {/if}
</main>

{#if linking}
  <LinkDevice onclose={() => (linking = false)} />
{/if}

{#if session.profileOpen}
  <ProfileModal />
{/if}
