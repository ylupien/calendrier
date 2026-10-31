<script>
  import { api } from '../lib/api.js';
  import { session } from '../lib/session.svelte.js';
  import Modal from './Modal.svelte';

  let name = $state(session.me?.name ?? '');
  let email = $state(session.me?.email ?? '');
  let error = $state('');
  let saving = $state(false);

  const close = () => {
    session.profileOpen = false;
    session.afterProfile = null;
  };

  async function submit(e) {
    e.preventDefault();
    error = '';
    saving = true;
    try {
      const me = await api.saveMe({ name, email });
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
    <div>
      <label class="label" for="pf-name">Nom</label>
      <!-- svelte-ignore a11y_autofocus -->
      <input id="pf-name" class="input" bind:value={name} required maxlength="100" autofocus autocomplete="name" />
    </div>
    <div>
      <label class="label" for="pf-email">Courriel <span class="font-normal text-slate-400">(facultatif)</span></label>
      <input id="pf-email" type="email" class="input" bind:value={email} maxlength="255" autocomplete="email" />
    </div>
    {#if error}<p class="text-sm text-rose-600">{error}</p>{/if}
    <div class="flex justify-end gap-2 pt-2">
      {#if !session.profileRequired}
        <button type="button" class="btn-ghost" onclick={close}>Annuler</button>
      {/if}
      <button class="btn-primary" disabled={saving}>{saving ? 'Enregistrement…' : 'Continuer'}</button>
    </div>
  </form>
</Modal>
