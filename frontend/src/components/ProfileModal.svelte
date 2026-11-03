<script>
  import { api } from '../lib/api.js';
  import { session } from '../lib/session.svelte.js';
  import Modal from './Modal.svelte';

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
    if (!confirm('Se déconnecter de cet appareil ? Vous pourrez revenir avec votre courriel et votre mot de passe.')) return;
    await api.logout();
    location.assign('/');
  }
</script>

<Modal onclose={session.profileRequired ? null : close}>
  <form class="space-y-4 p-6" onsubmit={submit}>
    <div>
      <h2 class="text-lg font-semibold text-slate-900">
        {session.me?.name ? 'Mon profil' : 'Bienvenue !'}
      </h2>
      <p class="mt-1 text-sm text-slate-500">
        Votre nom (et votre courriel, si vous l'indiquez) sera visible des autres participants de vos occasions.
        <a href="/confidentialite" target="_blank" rel="noopener" class="text-link">En savoir plus</a>
      </p>
    </div>
    {#if welcome}
      <!-- Full page load: the sign-in page then brings the person back here, on their account -->
      <p class="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
        Déjà venu, sur ce site ou un autre appareil ?
        <a href={loginHref} class="text-link font-medium">Se connecter</a> pour retrouver votre compte et vos plages.
      </p>
    {/if}
    <div>
      <label class="label" for="pf-name">Nom</label>
      <!-- svelte-ignore a11y_autofocus -->
      <input id="pf-name" class="input" bind:value={name} required maxlength="100" autofocus autocomplete="name" />
    </div>
    <div>
      <label class="label" for="pf-email">
        Courriel
        {#if !hasPassword && !pwOpen}<span class="font-normal text-slate-400">(facultatif)</span>{/if}
      </label>
      <input id="pf-email" type="email" class="input" bind:value={email} maxlength="255" autocomplete="email" required={hasPassword || pwOpen} />
    </div>
    {#if sameName}
      <div class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
        <strong>{sameName}</strong> participe déjà à cette occasion. Si c'est vous,
        <a href={loginHref} class="font-medium underline">connectez-vous</a> plutôt : sinon vous aurez deux comptes,
        et vos plages seront séparées. Pas de mot de passe ? Vous pourrez recevoir un lien de connexion par courriel.
      </div>
    {/if}
    {#if session.me?.name}
      <div class="rounded-xl border border-slate-200 p-3">
        {#if !pwOpen}
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm text-slate-600">
              {#if hasPassword}
                🔑 Mot de passe défini : connectez-vous avec votre courriel sur un autre appareil.
              {:else}
                Choisissez un mot de passe pour retrouver votre compte si cet appareil l'oublie.
              {/if}
            </p>
            <button type="button" class="btn-outline shrink-0" onclick={() => (pwOpen = true)}>
              {hasPassword ? 'Changer' : 'Choisir'}
            </button>
          </div>
        {:else}
          <div class="space-y-3">
            {#if hasPassword}
              <div>
                <label class="label" for="pf-current">Mot de passe actuel</label>
                <input id="pf-current" type="password" class="input" bind:value={currentPassword} required autocomplete="current-password" />
              </div>
            {/if}
            <div>
              <label class="label" for="pf-password">{hasPassword ? 'Nouveau mot de passe' : 'Mot de passe'}</label>
              <input id="pf-password" type="password" class="input" bind:value={password} required minlength="8" autocomplete="new-password" />
              <p class="mt-1 text-xs text-slate-500">Au moins 8 caractères. Votre courriel ci-dessus sert à vous connecter.</p>
            </div>
          </div>
        {/if}
      </div>
    {/if}
    {#if error}<p class="text-sm text-rose-600">{error}</p>{/if}
    <div class="flex flex-wrap justify-end gap-2 pt-2">
      {#if hasPassword}
        <button type="button" class="btn-ghost mr-auto text-slate-500" onclick={logout}>Se déconnecter</button>
      {/if}
      {#if !session.profileRequired}
        <button type="button" class="btn-ghost" onclick={close}>Annuler</button>
      {/if}
      <button class="btn-primary" disabled={saving}>{saving ? 'Enregistrement…' : 'Continuer'}</button>
    </div>
  </form>
</Modal>
