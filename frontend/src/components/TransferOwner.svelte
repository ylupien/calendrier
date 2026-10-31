<script>
  import { api } from '../lib/api.js';
  import Modal from './Modal.svelte';

  // person: guest who will become the owner; iAmOwner: the current user gives away their own occasion.
  let { occasion, person, iAmOwner, onclose, ondone } = $props();

  let saving = $state(false);
  let error = $state('');

  async function confirm() {
    saving = true;
    error = '';
    try {
      ondone(await api.transferOwner(occasion.slug, person.id));
    } catch (e) {
      error = e.message;
      saving = false;
    }
  }
</script>

<Modal {onclose}>
  <div class="space-y-4 p-6">
    <h2 class="text-lg font-semibold text-slate-900">👑 Donner la propriété</h2>
    <p class="text-sm text-slate-600">
      <strong class="text-slate-900">{person.name}</strong> deviendra propriétaire de
      « <strong class="text-slate-900">{occasion.title}</strong> ». Cette personne pourra modifier ses paramètres,
      l'archiver et gérer les invités.
    </p>
    {#if iAmOwner}
      <p class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
        {#if occasion.organization}
          ⚠️ Vous ne serez plus propriétaire : vous ne pourrez plus modifier les paramètres ni archiver l'occasion,
          et vous ne gérerez les invités que si vous administrez l'organisation.
        {:else}
          ⚠️ Vous ne serez plus propriétaire et ne pourrez plus gérer cette occasion. Seule cette personne pourra vous la redonner.
        {/if}
      </p>
    {/if}
    {#if error}<p class="text-sm text-rose-600">{error}</p>{/if}
    <div class="flex justify-end gap-2 pt-2">
      <button type="button" class="btn-ghost" onclick={onclose}>Annuler</button>
      <button class="btn-primary" disabled={saving} onclick={confirm}>Donner la propriété</button>
    </div>
  </div>
</Modal>
