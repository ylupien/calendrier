<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import Modal from './Modal.svelte';
  import { t } from '../lib/i18n.svelte.js';

  // Adds organization members not invited yet, or brings back removed guests.
  let { occasion, onclose, onadded } = $props();

  let candidates = $state(null); // { members, removed }
  let selected = $state(new Set());
  let error = $state('');
  let saving = $state(false);

  onMount(async () => {
    try {
      candidates = await api.guestCandidates(occasion.slug);
    } catch (e) {
      error = e.message;
    }
  });

  const all = $derived(candidates ? [...candidates.members, ...candidates.removed] : []);

  function toggle(id) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    selected = next;
  }

  async function add() {
    saving = true;
    error = '';
    try {
      const { participants } = await api.addGuests(occasion.slug, [...selected]);
      onadded(participants);
      onclose();
    } catch (e) {
      error = e.message;
    } finally {
      saving = false;
    }
  }
</script>

{#snippet group(title, list, hint)}
  {#if list.length}
    <div>
      <div class="mb-1.5 flex items-baseline justify-between">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
        <button
          class="text-xs text-indigo-600 hover:underline"
          onclick={() => (selected = new Set([...selected, ...list.map((p) => p.id)]))}
        >{t('AddGuests.selectAll')}</button>
      </div>
      {#if hint}<p class="mb-2 text-xs text-slate-500">{hint}</p>{/if}
      <ul class="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {#each list as p (p.id)}
          <li>
            <label class="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50">
              <input type="checkbox" class="h-4 w-4 rounded accent-indigo-600" checked={selected.has(p.id)} onchange={() => toggle(p.id)} />
              <span class="min-w-0">
                <span class="block truncate text-sm font-medium text-slate-800">{p.name}</span>
                {#if p.email}<span class="block truncate text-xs text-slate-500">{p.email}</span>{/if}
              </span>
            </label>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
{/snippet}

<Modal {onclose} size="max-w-lg">
  <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
    <h2 class="text-lg font-semibold text-slate-900">{t('AddGuests.title')}</h2>
    <button class="btn-ghost px-2 text-lg leading-none" onclick={onclose} aria-label={t('common.close')}>×</button>
  </div>
  <div class="space-y-5 p-6">
    {#if !candidates && !error}
      <p class="py-6 text-center text-slate-400">{t('common.loading')}</p>
    {:else if candidates && !all.length}
      <p class="py-4 text-center text-sm text-slate-500">
        {occasion.organization
          ? t('AddGuests.allInvited')
          : t('AddGuests.nobody')}
      </p>
    {:else if candidates}
      {@render group(occasion.organization ? t('AddGuests.membersOf', { name: occasion.organization.name }) : t('AddGuests.members'), candidates.members, '')}
      {@render group(t('AddGuests.removed'), candidates.removed, t('AddGuests.removedHint'))}
    {/if}
    {#if error}<p class="text-sm text-rose-600">{error}</p>{/if}
    <div class="flex justify-end gap-2">
      <button class="btn-ghost" onclick={onclose}>{t('common.cancel')}</button>
      <button class="btn-primary" disabled={!selected.size || saving} onclick={add}>
        {saving ? t('AddGuests.adding') : selected.size ? t('AddGuests.addCount', { count: selected.size }) : t('AddGuests.add')}
      </button>
    </div>
  </div>
</Modal>
