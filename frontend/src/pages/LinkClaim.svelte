<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { navigate, link } from '../lib/router.svelte.js';
  import { session } from '../lib/session.svelte.js';

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

  onMount(async () => {
    try {
      preview = await api.linkPreview(token);
    } catch (e) {
      error = e.message;
    }
  });

  const otherAccount = $derived(preview?.current?.hasData ? preview.current : null);

  const describe = (a) =>
    [
      a.occasions ? `${a.occasions} occasion${a.occasions > 1 ? 's' : ''}` : null,
      a.slots ? `${a.slots} plage${a.slots > 1 ? 's' : ''}` : null,
      a.organizations ? `${a.organizations} organisation${a.organizations > 1 ? 's' : ''}` : null,
    ]
      .filter(Boolean)
      .join(' · ') || 'Aucune occasion';

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
      <div class="text-4xl">📱</div>
      <h1 class="mt-2 text-xl font-bold text-slate-900">Lier cet appareil</h1>
    </div>

    {#if error && !preview}
      <p class="text-center text-slate-600">{error}</p>
      <a href="/" onclick={link} class="btn-outline w-full">Aller à l'accueil</a>
    {:else if !preview}
      <p class="py-6 text-center text-slate-400">Vérification du code…</p>
    {:else if preview.sameUser}
      <p class="text-center text-slate-600">Cet appareil est déjà lié au compte de <strong>{preview.name ?? 'cet utilisateur'}</strong>.</p>
      <a href="/" onclick={link} class="btn-primary w-full">Voir mes occasions</a>
    {:else}
      <p class="text-center text-slate-600">
        Cet appareil utilisera le compte de <strong>{preview.name ?? 'votre ordinateur'}</strong>
        {#if preview.target?.email}<span class="block text-sm text-slate-400">{preview.target.email}</span>{/if}
      </p>

      {#if otherAccount}
        <div class="space-y-2">
          <p class="text-sm text-slate-600">
            Ce cellulaire a déjà un compte, <strong>{otherAccount.name ?? 'sans nom'}</strong> ({describe(otherAccount)}).
            Que voulez-vous en faire ?
          </p>
          <label class="flex cursor-pointer gap-3 rounded-xl border p-3 transition {merge ? 'border-indigo-500 bg-indigo-50/60' : 'border-slate-200'}">
            <input type="radio" class="mt-1 accent-indigo-600" name="merge" value={true} bind:group={merge} />
            <span>
              <span class="block text-sm font-medium text-slate-800">Fusionner les deux comptes</span>
              <span class="block text-xs text-slate-500">
                Ses occasions, plages et organisations sont ajoutées au compte de {preview.name ?? "l'ordinateur"}.
                En cas de doublon dans une même occasion, ce sont les plages de l'ordinateur qui sont gardées.
              </span>
            </span>
          </label>
          <label class="flex cursor-pointer gap-3 rounded-xl border p-3 transition {!merge ? 'border-indigo-500 bg-indigo-50/60' : 'border-slate-200'}">
            <input type="radio" class="mt-1 accent-indigo-600" name="merge" value={false} bind:group={merge} />
            <span>
              <span class="block text-sm font-medium text-slate-800">Utiliser seulement le compte de l'ordinateur</span>
              <span class="block text-xs text-slate-500">
                Le compte « {otherAccount.name ?? 'sans nom'} » n'est pas fusionné : il reste tel quel, mais n'est plus utilisé sur cet appareil.
              </span>
            </span>
          </label>
        </div>
      {/if}

      {#if error}<p class="text-sm text-rose-600">{error}</p>{/if}
      <button class="btn-primary w-full py-2.5" disabled={busy} onclick={confirm}>
        {busy ? 'Liaison…' : otherAccount && merge ? 'Fusionner et lier cet appareil' : 'Lier cet appareil'}
      </button>
      <a href="/" onclick={link} class="text-link block text-center text-sm">Annuler</a>
    {/if}
  </div>
</div>
