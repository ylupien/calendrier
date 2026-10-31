<script>
  import {
    parseDay, toDay, todayStr, addDays, addMonths, weekDays, monthGrid,
    fmtMonth, fmtLong, fmtShort, fmtWeekday,
  } from '../lib/dates.js';
  import MonthView from './MonthView.svelte';
  import TimeGrid from './TimeGrid.svelte';
  import DayOverlay from './DayOverlay.svelte';

  let { occasion, participants, slots, colors, me, editable, editing, onadd, onupdate, ondelete, onediting } = $props();

  const VIEWS = [
    { id: 'day', label: 'Jour' },
    { id: 'week', label: 'Semaine' },
    { id: 'month', label: 'Mois' },
  ];

  function initialCursor() {
    const t = todayStr();
    if (t < occasion.startDate) return parseDay(occasion.startDate);
    if (t > occasion.endDate) return parseDay(occasion.endDate);
    return parseDay(t);
  }

  // Initial view only; the user can switch afterwards.
  // svelte-ignore state_referenced_locally
  let view = $state(occasion.startDate === occasion.endDate ? 'day' : 'month');
  let cursor = $state(initialCursor());
  let overlay = $state(null); // { day }

  const inRange = (day) => day >= occasion.startDate && day <= occasion.endDate;
  const visible = $derived(new Set(participants.map((p) => p.id)));

  // Ranges someone is moving/resizing right now are shown at their live position.
  const liveById = $derived(new Map(editing.filter((e) => e.slotId).map((e) => [e.slotId, e])));

  const byDay = $derived.by(() => {
    const m = new Map();
    for (const raw of slots) {
      if (!visible.has(raw.userId)) continue;
      const live = liveById.get(raw.id);
      const s = live && live.day === raw.day ? { ...raw, start: live.start, end: live.end, live: true, deleting: live.deleting } : raw;
      if (!m.has(s.day)) m.set(s.day, []);
      m.get(s.day).push(s);
    }
    for (const list of m.values()) list.sort((a, b) => a.start - b.start);
    return m;
  });

  /** Everyone editing a day (month view badges). */
  const editingByDay = $derived.by(() => {
    const m = new Map();
    for (const e of editing) {
      if (!m.has(e.day)) m.set(e.day, []);
      m.get(e.day).push(e);
    }
    return m;
  });

  /** Ranges being drawn (not yet saved): shown as a dashed ghost in the owner's lane. */
  const ghostsByDay = $derived.by(() => {
    const m = new Map();
    for (const e of editing) {
      if (e.slotId) continue;
      if (!m.has(e.day)) m.set(e.day, []);
      m.get(e.day).push(e);
    }
    return m;
  });

  const nameOf = (id) => participants.find((p) => p.id === id)?.name ?? '?';

  /** Groups slots/drafts of a day into one lane per user. */
  function lanesOf(day, users = null) {
    const lanes = new Map();
    for (const id of users ?? []) lanes.set(id, { userId: id, slots: [], drafts: [] });
    for (const s of byDay.get(day) ?? []) {
      if (!lanes.has(s.userId)) lanes.set(s.userId, { userId: s.userId, slots: [], drafts: [] });
      lanes.get(s.userId).slots.push(s);
    }
    for (const e of ghostsByDay.get(day) ?? []) {
      if (!lanes.has(e.userId)) lanes.set(e.userId, { userId: e.userId, slots: [], drafts: [] });
      lanes.get(e.userId).drafts.push(e);
    }
    return [...lanes.values()];
  }

  const weekColumns = $derived(
    weekDays(cursor).map((d) => {
      const day = toDay(d);
      return {
        key: day,
        day,
        title: fmtWeekday(d),
        subtitle: String(d.getDate()),
        today: day === todayStr(),
        enabled: inRange(day),
        lanes: inRange(day) ? lanesOf(day) : [],
      };
    }),
  );

  const dayStr = $derived(toDay(cursor));
  const dayColumns = $derived(
    inRange(dayStr)
      ? participants.map((p) => ({
          key: `${dayStr}-${p.id}`,
          day: dayStr,
          title: p.name,
          color: colors.get(p.id),
          enabled: true,
          lanes: lanesOf(dayStr, [p.id]).filter((l) => l.userId === p.id),
        }))
      : [],
  );

  const title = $derived.by(() => {
    if (view === 'month') return fmtMonth(cursor);
    if (view === 'day') return fmtLong(dayStr);
    const days = weekDays(cursor);
    return `${fmtShort(toDay(days[0]))} – ${fmtShort(toDay(days[6]))} ${days[6].getFullYear()}`;
  });

  function move(dir) {
    if (view === 'month') cursor = addMonths(cursor, dir);
    else if (view === 'week') cursor = addDays(cursor, 7 * dir);
    else cursor = addDays(cursor, dir);
  }

  function open(day) {
    if (inRange(day)) overlay = { day };
  }

  /** Called from outside (report tab): show and open a given day. */
  export function openDay(day) {
    cursor = parseDay(day);
    open(day);
  }

  function closeOverlay() {
    overlay = null;
    onediting(null);
  }

  function changeOverlayDay(day) {
    overlay = { ...overlay, day };
    cursor = parseDay(day);
  }
</script>

<section class="card min-w-0 overflow-hidden">
  <div class="space-y-2.5 border-b border-slate-200 p-3 sm:px-4">
    <!-- Line 1: date selector -->
    <div class="flex items-center gap-1">
      <button class="btn-ghost shrink-0 px-2.5 text-lg leading-none" onclick={() => move(-1)} aria-label="Précédent">‹</button>
      <h2 class="min-w-0 flex-1 truncate text-center text-base font-semibold text-slate-900 first-letter:uppercase">{title}</h2>
      <button class="btn-ghost shrink-0 px-2.5 text-lg leading-none" onclick={() => move(1)} aria-label="Suivant">›</button>
    </div>
    <!-- Line 2: "Today" on the left, Day / Week / Month on the right -->
    <div class="flex items-center gap-2">
    <button class="btn-outline shrink-0 px-3 py-1.5" onclick={() => (cursor = initialCursor())}>Aujourd'hui</button>
    <div class="flex flex-1 rounded-lg bg-slate-100 p-1 sm:ml-auto sm:flex-none">
      {#each VIEWS as v (v.id)}
        <button
          class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition sm:flex-none sm:py-1 {view === v.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}"
          onclick={() => (view = v.id)}
        >{v.label}</button>
      {/each}
    </div>
    </div>
  </div>

  {#if view === 'month'}
    <MonthView
      days={monthGrid(cursor)}
      month={cursor.getMonth()}
      {byDay}
      {editingByDay}
      {colors}
      {nameOf}
      {inRange}
      total={participants.length}
      onpick={(day) => open(day)}
    />
  {:else if view === 'week'}
    <TimeGrid columns={weekColumns} {colors} {nameOf} from={occasion.dayStart} to={occasion.dayEnd} onpick={(day) => open(day)} showNames={false} />
  {:else if inRange(dayStr)}
    {#if participants.length}
      <TimeGrid columns={dayColumns} {colors} {nameOf} from={occasion.dayStart} to={occasion.dayEnd} onpick={(day) => open(day)} showNames={true} overlap={byDay.get(dayStr) ?? []} total={participants.length} />
    {:else}
      <p class="p-10 text-center text-slate-500">Aucun invité pour l'instant.</p>
    {/if}
  {:else}
    <p class="p-10 text-center text-slate-500">Cette journée est hors de la période de l'occasion.</p>
  {/if}

  <div class="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
    {#if editable}
      Cliquez sur une journée pour ajouter vos disponibilités.
    {:else}
      Lecture seule.
    {/if}
  </div>
</section>

{#if overlay}
  <DayOverlay
    day={overlay.day}
    slots={byDay.get(overlay.day) ?? []}
    drafts={ghostsByDay.get(overlay.day) ?? []}
    {participants}
    {colors}
    {me}
    {editable}
    dayStart={occasion.dayStart}
    dayEnd={occasion.dayEnd}
    prevDay={inRange(toDay(addDays(parseDay(overlay.day), -1))) ? toDay(addDays(parseDay(overlay.day), -1)) : null}
    nextDay={inRange(toDay(addDays(parseDay(overlay.day), 1))) ? toDay(addDays(parseDay(overlay.day), 1)) : null}
    onchangeday={changeOverlayDay}
    {onadd}
    {onupdate}
    {ondelete}
    {onediting}
    onclose={closeOverlay}
  />
{/if}
