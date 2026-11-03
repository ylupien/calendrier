<script>
  import { toDay, todayStr, minToTime, weekdayNames } from '../lib/dates.js';
  import { t } from '../lib/i18n.svelte.js';

  // highlight: person hovered in the guest list (shown first, the others greyed out).
  let { days, month, byDay, editingByDay, colors, nameOf, inRange, total, onpick, highlight = null } = $props();
  const dimmed = (userId) => highlight !== null && userId !== highlight;

  const today = todayStr();
  const firstName = (id) => nameOf(id).split(' ')[0];

  function summary(day) {
    const users = new Map();
    for (const s of byDay.get(day) ?? []) {
      if (!users.has(s.userId)) users.set(s.userId, []);
      users.get(s.userId).push(s);
    }
    const list = [...users.entries()];
    // The hovered person comes first so it stays visible among the first three.
    return highlight === null ? list : list.sort(([a], [b]) => (b === highlight) - (a === highlight));
  }
</script>

<div class="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-medium uppercase tracking-wide text-slate-500">
  {#each weekdayNames() as w (w)}<div class="py-2">{w}</div>{/each}
</div>
<div class="grid grid-cols-7">
  {#each days as d (d.getTime())}
    {@const day = toDay(d)}
    {@const enabled = inRange(day)}
    {@const users = enabled ? summary(day) : []}
    {@const drafts = editingByDay.get(day) ?? []}
    {@const ratio = total ? users.length / total : 0}
    <button
      class="group relative flex min-h-24 flex-col gap-1 border-b border-r border-slate-100 p-1.5 text-left transition sm:min-h-28
        {enabled ? 'cursor-pointer bg-surface hover:ring-2 hover:ring-inset hover:ring-indigo-400' : 'cursor-not-allowed bg-slate-100 dark:bg-slate-50'}
        {enabled && d.getMonth() !== month ? 'opacity-60' : ''}"
      style={enabled && ratio > 0 ? `background: rgba(16,185,129,${0.06 + ratio * 0.22})` : ''}
      disabled={!enabled}
      onclick={() => onpick(day)}
    >
      <div class="flex items-center justify-between">
        <span
          class="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold
            {day === today ? (enabled ? 'bg-indigo-600 text-white' : 'ring-1 ring-slate-300 text-slate-400') : enabled ? 'text-slate-800' : 'text-slate-300'}"
        >{d.getDate()}</span>
        {#if users.length}
          <span class="rounded-full bg-emerald-600/90 px-1.5 text-[10px] font-semibold text-white" title={t('MonthView.available', { count: users.length })}>
            {users.length}/{total}
          </span>
        {/if}
      </div>
      <div class="flex min-w-0 flex-col gap-0.5">
        {#each users.slice(0, 3) as [userId, list] (userId)}
          <div class="flex min-w-0 items-center gap-1 text-[11px] leading-tight text-slate-700 transition-[opacity,filter] {dimmed(userId) ? 'opacity-30 grayscale' : ''}">
            <span class="h-2 w-2 shrink-0 rounded-full" style="background:{colors.get(userId)}"></span>
            <span class="truncate"><span class="font-medium">{firstName(userId)}</span>
              <span class="hidden text-slate-500 md:inline">{minToTime(list[0].start)}–{minToTime(list[0].end)}{list.length > 1 ? ` +${list.length - 1}` : ''}</span></span>
          </div>
        {/each}
        {#if users.length > 3}<span class="text-[11px] text-slate-500">{t('MonthView.others', { count: users.length - 3 })}</span>{/if}
      </div>
      {#if drafts.length}
        <div class="mt-auto flex flex-wrap gap-1">
          {#each drafts as e (e.userId)}
            <span class="animate-pulse rounded px-1 text-[10px] font-medium text-white {dimmed(e.userId) ? 'opacity-30 grayscale' : ''}" style="background:{colors.get(e.userId)}" title={t('MonthView.editing', { name: nameOf(e.userId) })}>
              ✎ {firstName(e.userId)}
            </span>
          {/each}
        </div>
      {/if}
    </button>
  {/each}
</div>
