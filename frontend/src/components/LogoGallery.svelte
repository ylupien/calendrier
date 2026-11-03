<script>
  import { t } from '../lib/i18n.svelte.js';
  import { logoView } from '../lib/logoDisplay.svelte.js';
  import LogoCreator from './LogoCreator.svelte';

  // Logos made in the gallery: click one to show it, ✏️ to edit it, ✕ to delete it, "Create a logo" to make a
  // new one. oncreate(payload) / onedit(logo, payload) return true once saved (the editor then closes).
  let { logos = [], shownLogoId = null, defaultCaption = '', busy = false, onshow, ondelete, oncreate, onedit } = $props();

  let creating = $state(false);
  let editing = $state(null); // logo being edited

  const PLATES = { light: 'bg-white border-[#e2e8f0]', dark: 'bg-[#0f172a] border-transparent', theme: 'bg-surface border-slate-200' };

  async function save(payload) {
    if (editing ? await onedit(editing, payload) : await oncreate(payload)) {
      creating = false;
      editing = null;
    }
  }
</script>

<div class="space-y-3">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <p class="text-sm text-slate-500">
      {logos.length ? t('LogoGallery.listHint') : t('LogoGallery.empty')}
    </p>
    <button type="button" class="btn-primary" onclick={() => (creating = true)} disabled={busy}>＋ {t('LogoGallery.createButton')}</button>
  </div>

  {#if logos.length}
    <ul class="grid gap-2 sm:grid-cols-2">
      {#each logos as l (l.id)}
        {@const view = logoView(l)}
        {@const isShown = l.id === shownLogoId}
        <li class="relative">
          <button
            type="button"
            class="flex w-full flex-col items-center gap-1.5 rounded-xl border p-3 pb-2 transition {PLATES[l.background] ?? PLATES.theme}
              {isShown ? '!border-indigo-500 ring-2 ring-indigo-300' : 'hover:!border-slate-300'}"
            aria-pressed={isShown}
            title={isShown ? t('LogoGallery.shown') : t('LogoGallery.show')}
            disabled={busy}
            onclick={() => !isShown && onshow(l)}
          >
            <span class="flex h-14 w-full items-center justify-center">
              <img src={view.src} alt={l.caption} class="h-full w-auto max-w-full object-contain" />
            </span>
            <span class="text-xs font-medium {isShown ? 'text-indigo-600' : l.background === 'theme' ? 'text-slate-500' : l.background === 'dark' ? 'text-[#cbd5e1]' : 'text-[#64748b]'}">
              {isShown ? `✓ ${t('LogoGallery.shown')}` : t('LogoGallery.show')}
            </span>
          </button>
          <div class="absolute top-1.5 right-1.5 flex gap-1">
            <button
              type="button"
              class="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-surface text-xs text-slate-500 shadow-sm hover:border-indigo-300 hover:text-indigo-600"
              title={t('LogoGallery.edit')}
              aria-label={t('LogoGallery.edit')}
              disabled={busy}
              onclick={() => (editing = l)}
            >✏️</button>
            <!-- Delete (asks first) -->
            <button
              type="button"
              class="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-surface text-sm text-slate-500 shadow-sm hover:border-rose-300 hover:text-rose-600"
              title={t('LogoGallery.delete')}
              aria-label={t('LogoGallery.delete')}
              disabled={busy}
              onclick={() => confirm(t('LogoGallery.deleteConfirm')) && ondelete(l)}
            >✕</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>

{#if creating || editing}
  {#key editing?.id}
    <LogoCreator
      initial={editing}
      {defaultCaption}
      {busy}
      oncreate={save}
      onclose={() => { creating = false; editing = null; }}
    />
  {/key}
{/if}
