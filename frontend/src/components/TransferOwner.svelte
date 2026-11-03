<script>
  import { api } from '../lib/api.js';
  import Modal from './Modal.svelte';
  import { t, th } from '../lib/i18n.svelte.js';

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
    <h2 class="text-lg font-semibold text-slate-900">👑 {t('TransferOwner.title')}</h2>
    <p class="text-sm text-slate-600 [&_strong]:text-slate-900">
      {@html th('TransferOwner.text', { name: person.name, title: occasion.title })}
    </p>
    {#if iAmOwner}
      <p class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
        {#if occasion.organization}
          ⚠️ {t('TransferOwner.warnOrg')}
        {:else}
          ⚠️ {t('TransferOwner.warn')}
        {/if}
      </p>
    {/if}
    {#if error}<p class="text-sm text-rose-600">{error}</p>{/if}
    <div class="flex justify-end gap-2 pt-2">
      <button type="button" class="btn-ghost" onclick={onclose}>{t('common.cancel')}</button>
      <button class="btn-primary" disabled={saving} onclick={confirm}>{t('TransferOwner.confirm')}</button>
    </div>
  </div>
</Modal>
