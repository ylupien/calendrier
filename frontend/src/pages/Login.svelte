<script>
  import { api } from '../lib/api.js';
  import { link } from '../lib/router.svelte.js';
  import { session } from '../lib/session.svelte.js';

  // The same email in both sections: typing it in one fills the other.
  let email = $state('');
  let password = $state('');
  let loginError = $state('');
  let loggingIn = $state(false);
  let linkError = $state('');
  let sending = $state(false);
  let sentTo = $state(null); // { email, minutes } once the link is sent

  // ?retour=/o/abc : page to go back to after signing in (only a path of this site).
  const back = (() => {
    const r = new URLSearchParams(location.search).get('retour') ?? '';
    // "//site" and "/\\site" would leave this site.
    return /^\/(?![/\\])/.test(r) ? r : '/';
  })();

  async function login(e) {
    e.preventDefault();
    loginError = '';
    loggingIn = true;
    try {
      await api.login(email, password);
      // Full reload: the page, the socket and the cookie all switch to the account.
      location.assign(back);
    } catch (err) {
      loginError = err.message;
      loggingIn = false;
    }
  }

  async function sendLink(e) {
    e.preventDefault();
    linkError = '';
    sending = true;
    try {
      const res = await api.emailLink(email, back);
      sentTo = { email, minutes: res.minutes };
    } catch (err) {
      linkError = err.message;
    } finally {
      sending = false;
    }
  }
</script>

<div class="mx-auto max-w-4xl py-6 sm:py-10">
  <div class="mb-6">
    <h1 class="text-2xl font-bold text-slate-900">Se connecter</h1>
    <p class="mt-1 text-slate-500">Retrouvez votre compte sur cet appareil, avec le courriel indiqué dans votre profil.</p>
  </div>

  {#if session.me?.name}
    <p class="mb-6 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
      Cet appareil utilise en ce moment le compte de <strong>{session.me.name}</strong> : il passera au compte
      auquel vous vous connectez.
    </p>
  {/if}

  <!-- Side by side on a wide screen, one above the other on a phone -->
  <div class="grid gap-6 md:grid-cols-2">
    <!-- With a password -->
    <form class="card flex flex-col gap-4 p-6 sm:p-8" onsubmit={login}>
      <div>
        <h2 class="text-lg font-semibold text-slate-900">🔑 Avec mon mot de passe</h2>
        <p class="mt-1 text-sm text-slate-500">Celui choisi dans « Mon profil », ou reçu de l'organisateur.</p>
      </div>
      <div>
        <label class="label" for="li-email">Courriel</label>
        <!-- svelte-ignore a11y_autofocus -->
        <input id="li-email" type="email" class="input" bind:value={email} required autocomplete="username" autofocus />
      </div>
      <div>
        <label class="label" for="li-password">Mot de passe</label>
        <input id="li-password" type="password" class="input" bind:value={password} required autocomplete="current-password" />
      </div>
      {#if loginError}<p class="text-sm text-rose-600">{loginError}</p>{/if}
      <button class="btn-primary mt-auto w-full" disabled={loggingIn}>{loggingIn ? 'Connexion…' : 'Se connecter'}</button>
    </form>

    <!-- Without a password: one-time link by email -->
    <form class="card flex flex-col gap-4 p-6 sm:p-8" onsubmit={sendLink}>
      <div>
        <h2 class="text-lg font-semibold text-slate-900">✉️ Pas de mot de passe ?</h2>
        <p class="mt-1 text-sm text-slate-500">
          Recevez par courriel un lien qui connecte cet appareil à votre compte. Il est valide quelques minutes,
          une seule fois.
        </p>
      </div>
      <div>
        <label class="label" for="li-link-email">Courriel</label>
        <input id="li-link-email" type="email" class="input" bind:value={email} required autocomplete="email" />
      </div>
      {#if sentTo}
        <div class="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900" role="status">
          📬 Si un compte utilise <strong>{sentTo.email}</strong>, un lien de connexion vient d'y être envoyé.
          Ouvrez-le <strong>sur cet appareil</strong> ; il est valide {sentTo.minutes} minutes.
          <span class="mt-1.5 block text-xs text-indigo-900/70">Rien reçu ? Regardez dans les courriels indésirables.</span>
        </div>
      {/if}
      {#if linkError}<p class="text-sm text-rose-600">{linkError}</p>{/if}
      <button class="btn-primary mt-auto w-full" disabled={sending}>
        {sending ? 'Envoi…' : sentTo ? 'Renvoyer le lien' : 'Recevoir un lien par courriel'}
      </button>
    </form>
  </div>

  <p class="mt-6 text-center text-sm text-slate-500">
    <a href="/" onclick={link} class="text-link">Retour à l'accueil</a>
  </p>
</div>
