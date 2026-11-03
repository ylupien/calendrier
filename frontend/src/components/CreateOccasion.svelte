<script>
  import { api } from '../lib/api.js';
  import { session, askProfile } from '../lib/session.svelte.js';
  import Modal from './Modal.svelte';
  import { t } from '../lib/i18n.svelte.js';
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
    <h2 class="text-lg font-semibold text-slate-900">{t('CreateOccasion.title')}</h2>
    <OrgPicker {orgs} bind:organizationId bind:allMembers />
    <div>
      <label class="label" for="oc-title">{t('CreateOccasion.titleLabel')}</label>
      <!-- svelte-ignore a11y_autofocus -->
      <input id="oc-title" class="input" bind:value={title} required maxlength="200" placeholder={t('CreateOccasion.titlePlaceholder')} autofocus />
    </div>
    <div>
      <label class="label" for="oc-desc">{t('CreateOccasion.description')} <span class="font-normal text-slate-400">{t('common.optional')}</span></label>
      <textarea id="oc-desc" class="input" rows="2" bind:value={description} maxlength="5000"></textarea>
    </div>
    <div>
      <span class="label">{t('CreateOccasion.days')}</span>
      <DaysPicker bind:days />
    </div>
    <DayHoursPicker bind:dayStart bind:dayEnd />
    <div class="rounded-xl bg-slate-50 p-3">
      <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input type="checkbox" class="h-4 w-4 rounded accent-indigo-600" bind:checked={withDeadline} />
        {t('CreateOccasion.withDeadline')}
      </label>
      {#if withDeadline}
        <input type="datetime-local" class="input mt-2" bind:value={editDeadline} required />
        <p class="mt-1 text-xs text-slate-500">{t('CreateOccasion.deadlineHelp')}</p>
      {/if}
    </div>
    {#if error}<p class="text-sm text-rose-600">{error}</p>{/if}
    <div class="flex justify-end gap-2 pt-2">
      <button type="button" class="btn-ghost" onclick={onclose}>{t('common.cancel')}</button>
      <button class="btn-primary" disabled={saving || !days.length} title={days.length ? '' : t('CreateOccasion.chooseDay')}>{saving ? t('CreateOccasion.creating') : t('CreateOccasion.create')}</button>
    </div>
  </form>
</Modal>
