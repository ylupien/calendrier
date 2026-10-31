<script>
  import { api } from '../lib/api.js';
  import { onMount } from 'svelte';
  import Modal from './Modal.svelte';
  import OrgPicker from './OrgPicker.svelte';
  import DayHoursPicker from './DayHoursPicker.svelte';

  let { occasion, onclose, onsaved } = $props();

  // Form fields start from the current values (intentionally not reactive).
  // svelte-ignore state_referenced_locally
  let title = $state(occasion.title);
  // svelte-ignore state_referenced_locally
  let description = $state(occasion.description);
  // svelte-ignore state_referenced_locally
  let withDeadline = $state(!!occasion.editDeadline);
  // svelte-ignore state_referenced_locally
  let editDeadline = $state(occasion.editDeadline ?? '');
  // svelte-ignore state_referenced_locally
  let organizationId = $state(occasion.organization?.id ?? null);
  // svelte-ignore state_referenced_locally
  let allMembers = $state(occasion.allMembers);
  // svelte-ignore state_referenced_locally
  let dayStart = $state(occasion.dayStart);
  // svelte-ignore state_referenced_locally
  let dayEnd = $state(occasion.dayEnd);
  let orgs = $state([]);
  let error = $state('');
  let saving = $state(false);

  onMount(async () => {
    orgs = await api.organizations().catch(() => []);
  });

  async function submit(e) {
    e.preventDefault();
    saving = true;
    error = '';
    try {
      onsaved(await api.updateOccasion(occasion.slug, {
        title,
        description,
        editDeadline: withDeadline && editDeadline ? editDeadline : null,
        organizationId,
        allMembers: !!organizationId && allMembers,
        dayStart,
        dayEnd,
      }));
    } catch (err) {
      error = err.message;
    } finally {
      saving = false;
    }
  }
</script>

<Modal {onclose} size="max-w-lg">
  <form class="space-y-4 p-6" onsubmit={submit}>
    <h2 class="text-lg font-semibold text-slate-900">Paramètres de l'occasion</h2>
    <OrgPicker {orgs} bind:organizationId bind:allMembers />
    <div>
      <label class="label" for="os-title">Titre</label>
      <input id="os-title" class="input" bind:value={title} required maxlength="200" />
    </div>
    <div>
      <label class="label" for="os-desc">Description</label>
      <textarea id="os-desc" class="input" rows="3" bind:value={description} maxlength="5000"></textarea>
    </div>
    <DayHoursPicker bind:dayStart bind:dayEnd />
    <div class="rounded-xl bg-slate-50 p-3">
      <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input type="checkbox" class="h-4 w-4 rounded accent-indigo-600" bind:checked={withDeadline} />
        Date de fin de l'édition
      </label>
      {#if withDeadline}
        <input type="datetime-local" class="input mt-2" bind:value={editDeadline} required />
      {/if}
    </div>
    {#if error}<p class="text-sm text-rose-600">{error}</p>{/if}
    <div class="flex justify-end gap-2 pt-2">
      <button type="button" class="btn-ghost" onclick={onclose}>Annuler</button>
      <button class="btn-primary" disabled={saving}>Enregistrer</button>
    </div>
  </form>
</Modal>
