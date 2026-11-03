<script>
  import { parseDay, minToTime, todayStr } from '../lib/dates.js';
  import { t, locale } from '../lib/i18n.svelte.js';

  let { occasion, participants, slots, onopenday } = $props();

  const STEP = 15;
  const STEPS = 1440 / STEP;
  let hideEmpty = $state(true);
  // Zone hovered in either the "best moments" list or the heatmap: both are highlighted together.
  let hovered = $state(null);
  const keyOf = (day, start) => `${day}|${start}`;

  const total = $derived(participants.length);
  const nameOf = $derived(new Map(participants.map((p) => [p.id, p.name])));
  const pctOf = (count) => (total ? Math.round((count / total) * 100) : 0);

  // One row per day chosen for the occasion.
  const days = $derived(occasion.days ?? []);

  /**
   * For each day: segments of consecutive 15-minute steps where exactly the same people are available.
   * { day, segments: [{ start, end, count, users }], max }
   */
  const rows = $derived.by(() => {
    const valid = new Set(participants.map((p) => p.id));
    const byDay = new Map();
    for (const s of slots) {
      if (!valid.has(s.userId)) continue;
      if (!byDay.has(s.day)) byDay.set(s.day, Array.from({ length: STEPS }, () => new Set()));
      const steps = byDay.get(s.day);
      for (let i = Math.floor(s.start / STEP); i < Math.ceil(s.end / STEP); i++) steps[i].add(s.userId);
    }
    return days.map((day) => {
      const steps = byDay.get(day);
      const segments = [];
      if (steps) {
        for (let i = 0; i < STEPS; i++) {
          if (!steps[i].size) continue;
          const key = [...steps[i]].sort().join(',');
          const last = segments.at(-1);
          if (last && last.key === key && last.end === i * STEP) last.end += STEP;
          else segments.push({ key, start: i * STEP, end: (i + 1) * STEP, count: steps[i].size, users: [...steps[i]] });
        }
      }
      return { day, segments, max: Math.max(0, ...segments.map((s) => s.count)) };
    });
  });

  const globalMax = $derived(Math.max(0, ...rows.map((r) => r.max)));
  const shownRows = $derived(hideEmpty ? rows.filter((r) => r.max > 0) : rows);

  // Hour range displayed: the occasion's hours of the day.
  const range = $derived({ from: occasion.dayStart ?? 0, to: occasion.dayEnd ?? 1440 });
  const span = $derived(range.to - range.from);
  const hours = $derived(Array.from({ length: span / 60 + 1 }, (_, i) => range.from + i * 60));
  const pos = (m) => `${((m - range.from) / span) * 100}%`;

  /** Darker = more people available. */
  const shade = (count) => {
    const r = total ? count / total : 0;
    return `rgba(79, 70, 229, ${0.12 + 0.88 * r})`;
  };

  const best = $derived(
    rows
      .flatMap((r) => r.segments.map((s) => ({ ...s, day: r.day })))
      .sort((a, b) => b.count - a.count || b.end - b.start - (a.end - a.start) || a.day.localeCompare(b.day))
      .slice(0, 5),
  );
  const bestKeys = $derived(new Set(best.map((b) => keyOf(b.day, b.start))));
  // Only zones listed in "best moments" are linked; other zones just show their tooltip.
  const linked = $derived(hovered && bestKeys.has(hovered) ? hovered : null);

  const dayLabel = (day) =>
    parseDay(day).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' });
  const names = (users) => users.map((id) => nameOf.get(id)).join(', ');
  const today = todayStr();
</script>

<section class="card min-w-0 overflow-hidden">
  <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-3 sm:px-4">
    <div>
      <h2 class="font-semibold text-slate-900">{t('Report.title')}</h2>
      <p class="text-xs text-slate-500">{t('Report.subtitle')}</p>
    </div>
    <label class="flex items-center gap-2 text-sm text-slate-600">
      <input type="checkbox" class="h-4 w-4 rounded accent-indigo-600" bind:checked={hideEmpty} />
      {t('Report.hideEmpty')}
    </label>
  </div>

  {#if best.length}
    <div class="border-b border-slate-200 p-4">
      <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('Report.best')}</h3>
      <ol class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {#each best as b, i (b.day + b.start)}
          {@const k = keyOf(b.day, b.start)}
          <li>
            <button
              class="flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition {linked === k ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/30' : 'border-slate-200'}"
              onclick={() => onopenday(b.day)}
              onmouseenter={() => (hovered = k)}
              onmouseleave={() => (hovered = null)}
              onfocus={() => (hovered = k)}
              onblur={() => (hovered = null)}
              title={names(b.users)}
            >
              <span
                class="flex h-11 w-14 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                style="background:{shade(b.count)}"
              >{pctOf(b.count)}%</span>
              <span class="min-w-0">
                <span class="block text-sm font-medium text-slate-800 first-letter:uppercase">{i + 1}. {dayLabel(b.day)}</span>
                <span class="block text-xs text-slate-500">{t('Report.bestLine', { start: minToTime(b.start), end: minToTime(b.end), count: b.count, total })}</span>
                <span class="block truncate text-xs text-slate-400">{names(b.users)}</span>
              </span>
            </button>
          </li>
        {/each}
      </ol>
    </div>
  {/if}

  <div class="overflow-x-auto p-4">
    {#if total === 0}
      <p class="py-10 text-center text-slate-500">{t('Report.noGuests')}</p>
    {:else if shownRows.length === 0}
      <p class="py-10 text-center text-slate-500">{t('Report.noSlots')}</p>
    {:else}
      <div class="min-w-[640px]">
        <!-- Hour scale -->
        <div class="flex items-end gap-3">
          <div class="w-28 shrink-0"></div>
          <div class="relative h-5 flex-1 text-[10px] text-slate-400">
            {#each hours as h, i (h)}
              {#if i % (span > 12 * 60 ? 2 : 1) === 0}
                <span class="absolute -translate-x-1/2" style="left:{pos(h)}">{t('Report.hour', { hour: h / 60 })}</span>
              {/if}
            {/each}
          </div>
          <div class="w-14 shrink-0"></div>
        </div>

        <div class="space-y-1">
          {#each shownRows as row (row.day)}
            <div class="flex items-center gap-3">
              <button
                class="w-28 shrink-0 truncate text-right text-xs first-letter:uppercase text-link {row.day === today || linked?.startsWith(row.day + '|') ? 'font-semibold' : ''}"
                onclick={() => onopenday(row.day)}
                title={t('Report.openDay')}
              >{dayLabel(row.day)}</button>
              <div
                class="relative h-9 flex-1 rounded-md bg-slate-50 ring-1 ring-slate-200"
                style="background-image:repeating-linear-gradient(to right, var(--color-slate-200) 0 1px, transparent 1px calc(100% / {span / 60}))"
              >
                {#each row.segments.filter((x) => x.end > range.from && x.start < range.to) as seg (seg.start)}
                  {@const isTop = seg.count === row.max}
                  {@const isBest = seg.count === globalMax}
                  {@const k = keyOf(row.day, seg.start)}
                  {@const isLinked = linked === k}
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div
                    class="absolute inset-y-0 flex items-center justify-center transition-opacity
                      {isBest ? 'z-10 outline-2 -outline-offset-2 outline-amber-400' : ''}
                      {isLinked ? 'z-30 rounded-sm ring-3 ring-indigo-600 ring-offset-2' : ''}
                      {linked && !isLinked ? 'opacity-35' : ''}"
                    onmouseenter={() => (hovered = k)}
                    onmouseleave={() => (hovered = null)}
                    style="left:{pos(Math.max(seg.start, range.from))};width:{pos(range.from + Math.min(seg.end, range.to) - Math.max(seg.start, range.from))};background:{shade(seg.count)}"
                    title={t('Report.segment', { start: minToTime(seg.start), end: minToTime(seg.end), count: seg.count, total, pct: pctOf(seg.count), names: names(seg.users) })}
                  >
                    {#if isTop || isLinked}
                      <!-- Pill may overflow narrow zones so the percentage always stays readable -->
                      <span class="pointer-events-none z-20 whitespace-nowrap rounded-full px-1.5 py-px text-[11px] font-bold shadow-sm {seg.count / total > 0.5 ? 'bg-surface/95 text-indigo-800' : 'bg-[#312e81]/85 text-white'}">{pctOf(seg.count)}%</span>
                    {/if}
                  </div>
                {/each}
              </div>
              <span class="w-14 shrink-0 text-right text-xs font-semibold {row.max ? 'text-slate-700' : 'text-slate-300'}" title={t('Report.dayMax')}>
                {row.max ? `${pctOf(row.max)}%` : '—'}
              </span>
            </div>
          {/each}
        </div>

        <!-- Legend -->
        <div class="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>{t('Report.legend')}</span>
          <span class="flex items-center gap-1">
            <span class="h-3 w-40 rounded" style="background:linear-gradient(to right, {shade(0)}, {shade(total)})"></span>
          </span>
          <span>{t('Report.legendRange', { count: total })}</span>
          <span class="flex items-center gap-1"><span class="h-3 w-4 rounded-sm outline-2 outline-amber-400"></span> {t('Report.bestMoment')}</span>
        </div>
      </div>
    {/if}
  </div>
</section>
