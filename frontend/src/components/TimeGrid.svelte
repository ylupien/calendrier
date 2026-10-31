<script>
  import { onMount } from 'svelte';
  import { minToTime } from '../lib/dates.js';

  // columns: [{ key, day, title, subtitle?, color?, today?, enabled, lanes: [{ userId, slots, drafts }] }]
  // from / to: hours of the day shown (minutes), set per occasion.
  let { columns, colors, nameOf, onpick, showNames = false, overlap = null, total = 0, from = 0, to = 1440 } = $props();

  const HOUR = 44; // px per hour
  // One row per hour, starting at the occasion's first hour.
  const hours = $derived(Array.from({ length: Math.ceil((to - from) / 60) }, (_, i) => from + i * 60));
  const gridHeight = $derived(((to - from) / 60) * HOUR);
  let scroller;

  onMount(() => {
    // Whole day shown: start around 7:00 rather than midnight.
    if (from < 7 * 60) scroller.scrollTop = ((7 * 60 - from) / 60) * HOUR;
  });

  const clip = (m) => Math.min(to, Math.max(from, m));
  // Ranges entirely outside the occasion's hours are not drawn (they can predate a change of hours).
  const inView = (s) => s.end > from && s.start < to;
  const top = (m) => ((clip(m) - from) / 60) * HOUR;
  // Compact time label ("9h–10h30") so it fits narrow lanes.
  const short = (m) => `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`;
  const height = (s, e) => Math.max(((clip(e) - clip(s)) / 60) * HOUR, 14);

  function pick(e, col) {
    if (!col.enabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const row = Math.min(hours.length - 1, Math.max(0, Math.floor((e.clientY - rect.top) / HOUR)));
    onpick(col.day, from + row * 60);
  }

  /** Splits the day in 15-minute steps and counts how many guests are available in each. */
  const coverage = $derived.by(() => {
    if (!overlap) return [];
    const counts = new Array(96).fill(0);
    const perUser = new Map();
    for (const s of overlap) {
      if (!perUser.has(s.userId)) perUser.set(s.userId, new Array(96).fill(false));
      const arr = perUser.get(s.userId);
      for (let i = Math.floor(s.start / 15); i < Math.ceil(s.end / 15); i++) arr[i] = true;
    }
    for (const arr of perUser.values()) arr.forEach((v, i) => v && counts[i]++);
    const segs = [];
    for (let i = 0; i < 96; i++) {
      if (!counts[i]) continue;
      const last = segs.at(-1);
      if (last && last.count === counts[i] && last.end === i * 15) last.end = (i + 1) * 15;
      else segs.push({ start: i * 15, end: (i + 1) * 15, count: counts[i] });
    }
    return segs;
  });
</script>

<div class="overflow-x-auto">
  <div class={showNames ? 'min-w-max' : 'min-w-[640px]'}>
    <!-- Header -->
    <div class="flex border-b border-slate-200 bg-slate-50">
      <div class="w-12 shrink-0"></div>
      {#if overlap}
        <div class="w-20 shrink-0 border-l border-slate-200 px-1 py-2 text-center text-xs font-semibold text-emerald-700">Commun</div>
      {/if}
      {#each columns as col (col.key)}
        <div class="flex-1 border-l border-slate-200 px-1 py-2 text-center {showNames ? 'min-w-28' : ''} {col.enabled ? '' : 'bg-slate-100 text-slate-300'}">
          {#if showNames}
            <div class="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-700">
              <span class="h-2.5 w-2.5 rounded-full" style="background:{col.color}"></span>
              <span class="max-w-24 truncate">{col.title}</span>
            </div>
          {:else}
            <div class="text-xs uppercase text-slate-500">{col.title}</div>
            <div class="mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold {col.today ? 'bg-indigo-600 text-white' : ''}">
              {col.subtitle}
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Body -->
    <div bind:this={scroller} class="max-h-[620px] overflow-y-auto">
      <div class="relative flex" style="height:{gridHeight}px">
        <div class="w-12 shrink-0">
          {#each hours as h (h)}
            <div class="relative text-right text-[10px] text-slate-400" style="height:{HOUR}px">
              {#if h > from}<span class="absolute -top-1.5 right-1.5">{minToTime(h)}</span>{/if}
            </div>
          {/each}
        </div>

        {#if overlap}
          <div class="relative w-20 shrink-0 border-l border-slate-200 bg-emerald-50/30">
            {#each hours as h (h)}<div class="border-b border-slate-100" style="height:{HOUR}px"></div>{/each}
            {#each coverage.filter(inView) as seg (seg.start)}
              <div
                class="absolute inset-x-1 flex items-center justify-center rounded text-[11px] font-semibold text-white"
                style="top:{top(seg.start)}px;height:{height(seg.start, seg.end)}px;background:rgba(5,150,105,{0.25 + 0.75 * (seg.count / Math.max(total, 1))})"
                title="{seg.count}/{total} disponibles de {minToTime(seg.start)} à {minToTime(seg.end)}"
              >{seg.count}/{total}</div>
            {/each}
          </div>
        {/if}

        {#each columns as col (col.key)}
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div
            class="relative flex-1 border-l border-slate-200 {showNames ? 'min-w-28' : ''} {col.enabled ? 'cursor-pointer bg-white hover:bg-indigo-50/40' : 'cursor-not-allowed bg-slate-100'}"
            onclick={(e) => pick(e, col)}
          >
            {#each hours as h (h)}<div class="border-b border-slate-100" style="height:{HOUR}px"></div>{/each}

            {#each col.lanes as lane, li (lane.userId)}
              {@const w = 100 / col.lanes.length}
              {@const color = colors.get(lane.userId)}
              {#each lane.slots.filter(inView) as s (s.id)}
                <div
                  class="pointer-events-none absolute overflow-hidden rounded-md border-l-4 px-1 py-0.5 text-[10px] leading-tight shadow-sm {s.live ? 'z-10 ring-2 ring-offset-1' : ''} {s.deleting ? 'opacity-30' : ''}"
                  style="top:{top(s.start)}px;height:{height(s.start, s.end)}px;left:calc({li * w}% + 2px);width:calc({w}% - 4px);background:{color}BF;border-color:{color};color:#fff;--tw-ring-color:{color}"
                  title="{nameOf(lane.userId)} · {minToTime(s.start)}–{minToTime(s.end)}"
                >
                  {#if !showNames}<div class="truncate font-semibold">{nameOf(lane.userId)}</div>{/if}
                  <div class="break-words">{short(s.start)}–{short(s.end)}</div>
                </div>
              {/each}
              {#each lane.drafts.filter(inView) as d (d.userId)}
                <div
                  class="pointer-events-none absolute animate-pulse overflow-hidden rounded-md border-2 border-dashed px-1 text-[10px] font-semibold"
                  style="top:{top(d.start)}px;height:{height(d.start, d.end)}px;left:calc({li * w}% + 2px);width:calc({w}% - 4px);border-color:{color};color:{color};background:{color}11"
                  title="{nameOf(lane.userId)} est en train de modifier"
                >✎ {nameOf(lane.userId).split(' ')[0]}</div>
              {/each}
            {/each}
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>
