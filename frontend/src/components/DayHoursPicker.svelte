<script>
  import { minToTime } from '../lib/dates.js';
  import { t } from '../lib/i18n.svelte.js';

  // Hours of the day shown in the calendar (and allowed for availabilities), e.g. 09:00 → 22:00.
  let { dayStart = $bindable(8 * 60), dayEnd = $bindable(22 * 60) } = $props();

  const OPTIONS = Array.from({ length: 25 }, (_, i) => i * 60); // whole hours keep the grid lines aligned
</script>

<div>
  <span class="label">{t('DayHoursPicker.label')}</span>
  <div class="flex items-center gap-2">
    <select class="input" aria-label={t('DayHoursPicker.start')} bind:value={dayStart}>
      {#each OPTIONS.filter((m) => m <= dayEnd - 60) as m (m)}<option value={m}>{minToTime(m)}</option>{/each}
    </select>
    <span class="shrink-0 text-sm text-slate-500">{t('DayHoursPicker.to')}</span>
    <select class="input" aria-label={t('DayHoursPicker.end')} bind:value={dayEnd}>
      {#each OPTIONS.filter((m) => m >= dayStart + 60) as m (m)}<option value={m}>{m === 1440 ? '24:00' : minToTime(m)}</option>{/each}
    </select>
  </div>
  <p class="mt-1 text-xs text-slate-500">{t('DayHoursPicker.help')}</p>
</div>
