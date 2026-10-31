<script>
  import { api } from '../lib/api.js';
  import { session, askProfile } from '../lib/session.svelte.js';
  import Modal from './Modal.svelte';
  import OrgPicker from './OrgPicker.svelte';
  import DayHoursPicker from './DayHoursPicker.svelte';
  import DaysPicker from './DaysPicker.svelte';

  let { orgs = [], initialOrganizationId = null, onclose, oncreated } = $props();

  let title = $state('');
  let description = $state('');
  let days = $state([]); // chosen days, 'YYYY-MM-DD'
  let withDeadline = $state(false);
  let editDeadline = $state('');
  let error = $state('');
  let saving = $state(false);
  // Preselect the given organization, otherwise the first one the user may create occasions in.
  // svelte-ignore state_referenced_locally
  let organizationId = $state(initialOrganizationId ?? orgs.find((o) => o.canCreate)?.id ?? null);
  let allMembers = $state(false);
  let dayStart = $state(8 * 60);
  let dayEnd = $state(22 * 60);

  async function create() {
    error = '';
    saving = true;
    try {
      const occasion = await api.createOccasion({
        title,
        description,
        days,
        editDeadline: withDeadline && editDeadline ? editDeadline : null,
        organizationId,
        allMembers: !!organizationId && allMembers,
        dayStart,
        dayEnd,
      });
      oncreated(occasion);
    } catch (err) {
      error = err.message;
    } finally {
      saving = false;
    }
  }

  function submit(e) {
    e.preventDefault();
    // The creator also needs a name/email so they appear in the guest list.
    if (!session.me?.name) askProfile({ then: create });
    else create();
  }
</script>

<Modal {onclose} size="max-w-lg">
  <form class="space-y-4 p-6" onsubmit={submit}>
    <h2 class="text-lg font-semibold text-slate-900">Nouvelle occasion</h2>
    <OrgPicker {orgs} bind:organizationId bind:allMembers />
    <div>
      <label class="label" for="oc-title">Titre</label>
      <!-- svelte-ignore a11y_autofocus -->
      <input id="oc-title" class="input" bind:value={title} required maxlength="200" placeholder="Ex. : Souper d'équipe" autofocus />
    </div>
    <div>
      <label class="label" for="oc-desc">Description <span class="font-normal text-slate-400">(facultatif)</span></label>
      <textarea id="oc-desc" class="input" rows="2" bind:value={description} maxlength="5000"></textarea>
    </div>
    <div>
      <span class="label">Journées</span>
      <DaysPicker bind:days />
    </div>
    <DayHoursPicker bind:dayStart bind:dayEnd />
    <div class="rounded-xl bg-slate-50 p-3">
      <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input type="checkbox" class="h-4 w-4 rounded accent-indigo-600" bind:checked={withDeadline} />
        Définir une date de fin de l'édition
      </label>
      {#if withDeadline}
        <input type="datetime-local" class="input mt-2" bind:value={editDeadline} required />
        <p class="mt-1 text-xs text-slate-500">Après ce moment, plus personne ne pourra modifier ses disponibilités.</p>
      {/if}
    </div>
    {#if error}<p class="text-sm text-rose-600">{error}</p>{/if}
    <div class="flex justify-end gap-2 pt-2">
      <button type="button" class="btn-ghost" onclick={onclose}>Annuler</button>
      <button class="btn-primary" disabled={saving || !days.length} title={days.length ? '' : 'Choisissez au moins une journée'}>{saving ? 'Création…' : "Créer l'occasion"}</button>
    </div>
  </form>
</Modal>
