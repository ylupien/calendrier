<script>
  import { api } from '../lib/api.js';
  import { onMount } from 'svelte';
  import Modal from './Modal.svelte';
  import OrgPicker from './OrgPicker.svelte';
  import DayHoursPicker from './DayHoursPicker.svelte';
  import DaysPicker from './DaysPicker.svelte';

  // slots: current availabilities, to warn about those lost when a day is removed.
  let { occasion, slots = [], onclose, onsaved } = $props();

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
  // svelte-ignore state_referenced_locally
  let days = $state([...(occasion.days ?? [])]);
  let orgs = $state([]);

  const removedDays = $derived((occasion.days ?? []).filter((d) => !days.includes(d)));
  const lostSlots = $derived(slots.filter((s) => removedDays.includes(s.day)).length);
  let error = $state('');
  let saving = $state(false);

  onMount(async () => {
    orgs = await api.organizations().catch(() => []);
  });

  async function submit(e) {
    e.preventDefault();
    if (lostSlots && !confirm(`${lostSlots} plage${lostSlots > 1 ? 's' : ''} de disponibilité ser${lostSlots > 1 ? 'ont' : 'a'} supprimée${lostSlots > 1 ? 's' : ''} avec les journées retirées. Continuer ?`)) return;
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
        days,
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
    <div>
      <span class="label">Journées</span>
      <DaysPicker bind:days />
      {#if lostSlots}
        <p class="mt-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          ⚠️ {lostSlots} plage{lostSlots > 1 ? 's' : ''} de disponibilité ser{lostSlots > 1 ? 'ont' : 'a'} supprimée{lostSlots > 1 ? 's' : ''}
          avec {removedDays.length > 1 ? 'les journées retirées' : 'la journée retirée'}.
        </p>
      {/if}
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
      <button class="btn-primary" disabled={saving || !days.length}>Enregistrer</button>
    </div>
  </form>
</Modal>
