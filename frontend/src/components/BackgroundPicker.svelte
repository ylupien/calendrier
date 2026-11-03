<script>
  import { BACKGROUNDS } from '../lib/logoDisplay.svelte.js';
  import { t } from '../lib/i18n.svelte.js';

  // Background of a logo: follows the theme, always light (white) or always dark (dark blue).
  let { value, onchange, disabled = false } = $props();
  const ICONS = { theme: '🌓', light: '☀️', dark: '🌙' };
</script>

<div>
  <span class="label">{t('BackgroundPicker.label')}</span>
  <div class="inline-flex rounded-lg bg-slate-100 p-1" role="radiogroup" aria-label={t('BackgroundPicker.label')}>
    {#each BACKGROUNDS as b (b)}
      <button
        type="button"
        role="radio"
        aria-checked={value === b}
        {disabled}
        class="rounded-md px-3 py-1.5 text-sm font-medium transition {value === b ? 'bg-surface text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}"
        onclick={() => value !== b && onchange(b)}
      >{ICONS[b]} {t(`BackgroundPicker.${b}`)}</button>
    {/each}
  </div>
  <p class="mt-1 text-xs text-slate-400">{t(`BackgroundPicker.help.${value}`)}</p>
</div>
