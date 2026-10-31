<script>
  import { monthGrid, toDay, parseDay, addMonths, fmtMonth, todayStr, WEEKDAYS } from '../lib/dates.js';

  // Days open for the occasion, chosen one by one. Click or drag to (de)select, click a weekday
  // header to toggle that weekday for the whole month. Past days cannot be added (one already
  // chosen, when editing, can still be removed).
  let { days = $bindable([]) } = $props();

  const today = todayStr();
  // svelte-ignore state_referenced_locally
  let month = $state(parseDay(days.length ? days.find((d) => d >= today) ?? days.at(-1) : today));
  let painting = $state(null); // true = adding, false = removing, while the pointer is down

  const selected = $derived(new Set(days));
  const grid = $derived(monthGrid(month));
  const inMonth = (d) => d.getMonth() === month.getMonth();
  const canAdd = (day) => day >= today;

  function setDay(day, on) {
    if (on === selected.has(day)) return;
    if (on && !canAdd(day)) return;
    days = on ? [...days, day].sort() : days.filter((d) => d !== day);
  }

  function down(e, day) {
    e.preventDefault();
    painting = !selected.has(day);
    if (painting && !canAdd(day)) {
      painting = null;
      return;
    }
    setDay(day, painting);
    // Pointer capture would keep events on the first cell: track the finger/mouse over the grid instead.
    window.addEventListener('pointerup', up, { once: true });
    window.addEventListener('pointercancel', up, { once: true });
  }

  function over(e) {
    if (painting === null) return;
    const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-day]');
    if (cell) setDay(cell.dataset.day, painting);
  }

  function up() {
    painting = null;
  }

  /** Weekday header: select every (future) day of that weekday in the month, or clear them if all are selected. */
  function toggleWeekday(index) {
    const list = grid.filter((d) => inMonth(d) && d.getDay() === index).map(toDay).filter((day) => canAdd(day) || selected.has(day));
    const allOn = list.length && list.every((day) => selected.has(day));
    let next = new Set(days);
    for (const day of list) {
      if (allOn) next.delete(day);
      else if (canAdd(day)) next.add(day);
    }
    days = [...next].sort();
  }
</script>

<div class="rounded-xl border border-slate-200 bg-surface p-3">
  <div class="mb-2 flex items-center justify-between">
    <button type="button" class="btn-ghost px-2.5 text-lg leading-none" onclick={() => (month = addMonths(month, -1))} aria-label="Mois précédent">‹</button>
    <span class="text-sm font-semibold text-slate-800 first-letter:uppercase">{fmtMonth(month)}</span>
    <button type="button" class="btn-ghost px-2.5 text-lg leading-none" onclick={() => (month = addMonths(month, 1))} aria-label="Mois suivant">›</button>
  </div>

  <div class="grid grid-cols-7 text-center">
    {#each WEEKDAYS as w, i (w)}
      <button
        type="button"
        class="rounded-md py-1 text-[11px] font-medium uppercase text-slate-500 hover:bg-slate-100 hover:text-indigo-600"
        title="Sélectionner tous les {w} du mois"
        onclick={() => toggleWeekday(i)}
      >{w}</button>
    {/each}
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="grid select-none grid-cols-7 gap-1" style="touch-action: none" onpointermove={over}>
    {#each grid as d (d.getTime())}
      {@const day = toDay(d)}
      {@const on = selected.has(day)}
      {@const past = !canAdd(day)}
      <button
        type="button"
        data-day={day}
        class="flex aspect-square items-center justify-center rounded-lg text-sm transition
          {on ? 'bg-indigo-600 font-semibold text-white shadow-sm' : past ? 'text-slate-300' : 'text-slate-700 hover:bg-indigo-50'}
          {!inMonth(d) ? 'opacity-40' : ''}
          {day === today && !on ? 'ring-1 ring-inset ring-indigo-400' : ''}
          {past && !on ? 'cursor-not-allowed' : ''}"
        aria-pressed={on}
        aria-label={day}
        onpointerdown={(e) => down(e, day)}
        onclick={(e) => e.detail === 0 && setDay(day, !on)}
      >{d.getDate()}</button>
    {/each}
  </div>

  <div class="mt-2 flex items-center justify-between text-xs">
    <span class={days.length ? 'font-medium text-indigo-700' : 'text-slate-500'}>
      {days.length ? `${days.length} journée${days.length > 1 ? 's' : ''} sélectionnée${days.length > 1 ? 's' : ''}` : 'Cliquez ou glissez sur les journées à ouvrir'}
    </span>
    {#if days.length}
      <button type="button" class="text-slate-500 hover:text-rose-600" onclick={() => (days = [])}>Tout effacer</button>
    {/if}
  </div>
</div>
