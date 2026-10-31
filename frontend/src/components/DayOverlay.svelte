<script>
  import { onMount, tick } from 'svelte';
  import { fmtLong, minToTime } from '../lib/dates.js';
  import Modal from './Modal.svelte';

  let {
    day, slots, drafts, participants, colors, me, editable, dayStart = 0, dayEnd = 1440,
    prevDay, nextDay, onchangeday, onadd, onupdate, ondelete, onediting, onclose,
  } = $props();

  const STEP = 15;
  // Hours of the day set for the occasion (minutes): everything is shown and edited within them.
  const from = $derived(dayStart);
  const to = $derived(dayEnd);
  const span = $derived(dayEnd - dayStart);
  const OPTIONS = $derived(Array.from({ length: (dayEnd - dayStart) / STEP + 1 }, (_, i) => dayStart + i * STEP));
  const PRESETS = [
    { label: 'Matin', start: 8 * 60, end: 12 * 60 },
    { label: 'Après-midi', start: 13 * 60, end: 17 * 60 },
    { label: 'Soirée', start: 18 * 60, end: 22 * 60 },
    { label: 'Journée', start: 8 * 60, end: 17 * 60 },
  ];
  // Scale labels: every hour for a short day, every 2 hours otherwise (in minutes).
  const TICKS = $derived.by(() => {
    const step = dayEnd - dayStart > 12 * 60 ? 120 : 60;
    return Array.from({ length: Math.floor((dayEnd - dayStart) / step) + 1 }, (_, i) => dayStart + i * step);
  });
  const presets = $derived(PRESETS.filter((p) => p.start >= dayStart && p.end <= dayEnd));
  // How far the pointer may leave the row before a dragged range is deleted on release.
  const OUT_Y = 28;
  const OUT_X = 16;
  // Phone layout: vertical timeline, 48 px per hour (15 min = 12 px, comfortable for a finger).
  const HOUR_V = 48;
  const OUT_SIDE = 36; // phone: drag a range sideways out of its column to delete it

  let mobile = $state(false);
  let vscroll = $state(null); // scrollable vertical timeline
  onMount(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const set = () => (mobile = mq.matches);
    set();
    mq.addEventListener('change', set);
    return () => mq.removeEventListener('change', set);
  });

  // Phone: show my first range (or 8:00) when the day opens.
  $effect(() => {
    day;
    if (!mobile || !vscroll) return;
    const first = mySlots[0]?.start ?? 8 * 60;
    tick().then(() => vscroll && (vscroll.scrollTop = Math.max(0, ((first - 30 - from) / 60) * HOUR_V)));
  });

  let track = $state(null); // the "Vous" row element
  let selectedId = $state(null); // range in edit mode
  // drag: { kind: 'create'|'slot', mode: 'create'|'move'|'start'|'end', id?, px, py, raw0, anchor?,
  //         origStart, origEnd, lo, hi, start, end, moved, outside }
  let drag = $state(null);
  let pending = $state(null); // { id?, start, end } shown while the server confirms

  const color = $derived(colors.get(me?.id) ?? '#4f46e5');
  const mySlots = $derived(slots.filter((s) => s.userId === me?.id).sort((a, b) => a.start - b.start));
  const selected = $derived(mySlots.find((s) => s.id === selectedId) ?? null);

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const clip = (m) => Math.min(to, Math.max(from, m));
  const inView = (x) => x.end > from && x.start < to;
  const pct = (m) => `${((clip(m) - from) / span) * 100}%`;
  /** Horizontal position + width of a range (clipped to the occasion's hours). */
  const hbox = (a, b) => `left:${pct(a)};width:${((clip(b) - clip(a)) / span) * 100}%`;
  // Ranges are drawn with their owner's color at 75% opacity.
  const fill = (c) => `${c}BF`;
  // Short label for narrow ranges: "9h–10h30" instead of "09:00–10:30".
  const short = (m) => `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`;
  const label = (v) => (v.end - v.start >= 150 ? `${minToTime(v.start)}–${minToTime(v.end)}` : `${short(v.start)}–${short(v.end)}`);

  /** Free interval around `at`, ignoring range `excludeId`: ranges may not overlap. */
  function bounds(at, excludeId = null) {
    let lo = from;
    let hi = to;
    for (const s of mySlots) {
      if (s.id === excludeId) continue;
      if (s.end <= at) lo = Math.max(lo, s.end);
      if (s.start >= at) hi = Math.min(hi, s.start);
    }
    return { lo, hi };
  }

  const fits = (start, end, excludeId = null) =>
    start < end && !mySlots.some((s) => s.id !== excludeId && s.start < end && s.end > start);

  /** Hours to display for one of my ranges (live while dragging, then until the server answers). */
  function shown(s) {
    if (drag?.kind === 'slot' && drag.id === s.id) return drag;
    if (pending?.id === s.id) return pending;
    return s;
  }

  // Broadcast the range being edited so other guests see it live.
  $effect(() => {
    if (!editable) return;
    let r = null;
    if (drag?.kind === 'slot') r = { start: drag.start, end: drag.end, slotId: drag.id, deleting: drag.outside };
    else if (drag?.kind === 'create') r = drag.outside ? null : { start: drag.start, end: drag.end };
    else if (selected) r = { ...shown(selected), slotId: selected.id };
    onediting(r && r.end > r.start ? { day, start: r.start, end: r.end, slotId: r.slotId ?? null, deleting: !!r.deleting } : null);
  });

  // Forget the selection when the day changes.
  $effect(() => {
    day;
    selectedId = null;
  });

  /** After a save the server may re-create the range (new id): find it again by its hours. */
  function reselect(start, end) {
    selectedId = mySlots.find((s) => s.start <= start && s.end >= end)?.id ?? null;
  }

  async function create(start, end) {
    pending = { start, end };
    const ok = await onadd(day, start, end);
    pending = null;
    if (ok) reselect(start, end);
  }

  async function update(slot, start, end) {
    if (start === slot.start && end === slot.end) return;
    pending = { id: slot.id, start, end };
    await onupdate(slot.id, start, end);
    pending = null;
    reselect(start, end);
  }

  async function remove(slot) {
    if (selectedId === slot.id) selectedId = null;
    await ondelete(slot.id);
  }

  // ---- Mouse & touch ----

  const snap = (m) => Math.round(m / STEP) * STEP;
  // Pixels the pointer must travel before a press becomes a drag (a click never moves anything).
  const DRAG_THRESHOLD = 4;

  /** Unsnapped minutes under the pointer (horizontal row on a computer, vertical column on a phone). */
  function rawMinutesAt(e) {
    const rect = track.getBoundingClientRect();
    const ratio = mobile ? (e.clientY - rect.top) / rect.height : (e.clientX - rect.left) / rect.width;
    return from + ratio * span;
  }

  const minutesAt = (e) => clamp(snap(rawMinutesAt(e)), from, to);

  function isOutside(e) {
    const r = track.getBoundingClientRect();
    if (mobile) return e.clientX < r.left - OUT_SIDE || e.clientX > r.right + OUT_SIDE;
    return e.clientY < r.top - OUT_Y || e.clientY > r.bottom + OUT_Y || e.clientX < r.left - OUT_X || e.clientX > r.right + OUT_X;
  }

  function stopListening() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
  }

  function beginDrag(e, info) {
    if (!editable || e.button !== 0) return;
    // On a phone, a tap on an empty area must still let the finger scroll the timeline.
    if (!(mobile && info.kind === 'create')) e.preventDefault();
    e.stopPropagation();
    drag = { ...info, px: e.clientX, py: e.clientY, raw0: rawMinutesAt(e), moved: false, outside: false };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    // The browser cancels the gesture when it turns into a scroll: then nothing happens.
    window.addEventListener('pointercancel', onCancel, { once: true });
  }

  function onCancel() {
    stopListening();
    drag = null;
  }

  function onTrackDown(e) {
    const anchor = minutesAt(e);
    const { lo, hi } = bounds(anchor);
    if (hi - lo < STEP) return;
    selectedId = null;
    const a = clamp(anchor, lo, hi);
    beginDrag(e, { kind: 'create', mode: 'create', anchor: a, lo, hi, origStart: a, origEnd: a, start: a, end: a });
  }

  /** Phone: tapping a range only selects it (handles appear); the finger can still scroll over it. */
  function onSlotTap(e, s) {
    e.stopPropagation();
    selectedId = s.id;
  }

  function onSlotDown(e, s, mode) {
    selectedId = s.id;
    const { lo, hi } = bounds(s.start, s.id);
    beginDrag(e, { kind: 'slot', mode, id: s.id, lo, hi, origStart: s.start, origEnd: s.end, start: s.start, end: s.end });
  }

  function onMove(e) {
    if (!drag) return;
    const d = drag;
    // Phone: an empty area is only tapped (a moving finger scrolls), creation happens on release.
    if (mobile && d.mode === 'create') return;
    const moved = d.moved || Math.hypot(e.clientX - d.px, e.clientY - d.py) >= DRAG_THRESHOLD;
    if (!moved) return;
    // The range follows the pointer from the exact point where it was grabbed; only the result is snapped.
    const delta = rawMinutesAt(e) - d.raw0;
    let s = d.start;
    let en = d.end;
    if (d.mode === 'create') {
      const p = clamp(minutesAt(e), d.lo, d.hi);
      s = Math.min(d.anchor, p);
      en = Math.max(d.anchor, p);
    } else if (d.mode === 'move') {
      const len = d.origEnd - d.origStart;
      s = clamp(snap(d.origStart + delta), d.lo, d.hi - len);
      en = s + len;
    } else if (d.mode === 'start') {
      s = clamp(snap(d.origStart + delta), d.lo, d.origEnd - STEP);
      en = d.origEnd;
    } else if (d.mode === 'end') {
      s = d.origStart;
      en = clamp(snap(d.origEnd + delta), d.origStart + STEP, d.hi);
    }
    drag = { ...d, start: s, end: en, moved: true, outside: isOutside(e) };
  }

  async function onUp() {
    stopListening();
    const d = drag;
    drag = null;
    if (!d) return;

    if (d.kind === 'create') {
      if (d.outside) return;
      let s = d.start;
      let en = d.end;
      if (en - s < STEP) {
        // Simple click: one hour from the clicked hour, within the free space.
        s = clamp(Math.floor(d.anchor / 60) * 60, d.lo, d.hi - STEP);
        en = Math.min(s + 60, d.hi);
      }
      await create(s, en);
      return;
    }

    const slot = mySlots.find((x) => x.id === d.id);
    if (!slot) return;
    if (d.outside) await remove(slot);
    else if (d.moved) await update(slot, d.start, d.end); // update() ignores unchanged hours
  }

  // ---- Fields (edit the selected range), presets and "new range" (create one) ----

  // Start: any free time of the day (the range is moved there). End: up to the next range.
  const startOptions = $derived(selected ? OPTIONS.filter((m) => m < to && fits(m, m + STEP, selected.id)) : []);
  const endOptions = $derived.by(() => {
    if (!selected) return [];
    const v = shown(selected);
    const { hi } = bounds(v.start, selected.id);
    return OPTIONS.filter((m) => m > v.start && m <= hi);
  });

  function changeStart(s) {
    const v = shown(selected);
    const { hi } = bounds(s, selected.id);
    // Keep the end if still valid, otherwise keep the duration (shortened if the next range is closer).
    const en = v.end > s && v.end <= hi ? v.end : Math.min(s + (v.end - v.start), hi);
    update(selected, s, en);
  }

  /** First free spot for a new range: one hour, after my last range (or 9:00), else any free 15 min. */
  function freeSpot() {
    const last = mySlots.at(-1);
    const after = last ? Math.ceil(last.end / 60) * 60 + 60 : Math.max(9 * 60, from);
    const order = [...OPTIONS.filter((m) => m >= after), ...OPTIONS.filter((m) => m < after)];
    for (const len of [60, STEP]) {
      const s = order.find((m) => m + len <= to && fits(m, m + len));
      if (s !== undefined) return { start: s, end: s + len };
    }
    return null;
  }
  const spot = $derived(freeSpot());

  function onkeydown(e) {
    if (!selected || !['Delete', 'Backspace'].includes(e.key)) return;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    e.preventDefault();
    remove(selected);
  }

  // ---- Read-only rows ----

  const others = $derived.by(() => {
    const byUser = new Map();
    for (const s of slots) {
      if (s.userId === me?.id && editable) continue; // shown in the interactive row
      if (!byUser.has(s.userId)) byUser.set(s.userId, []);
      byUser.get(s.userId).push(s);
    }
    const ghosts = new Map(drafts.map((d) => [d.userId, d]));
    return participants
      .filter((p) => byUser.has(p.id) || ghosts.has(p.id))
      .map((p) => ({ user: p, slots: byUser.get(p.id) ?? [], ghost: ghosts.get(p.id) ?? null }));
  });

  // Phone: my column + one narrow column per other guest (with ranges or drawing one).
  /** Vertical position + height of a range (clipped to the occasion's hours). */
  const vbox = (a, b) => `top:${((clip(a) - from) / 60) * HOUR_V}px;height:${((clip(b) - clip(a)) / 60) * HOUR_V}px`;
  const vHours = $derived(Array.from({ length: Math.ceil(span / 60) }, (_, i) => from + i * 60));
  const initialsOf = (name = '') =>
    name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

  const listRows = $derived.by(() => {
    const byUser = new Map();
    for (const s of slots) {
      if (!byUser.has(s.userId)) byUser.set(s.userId, []);
      byUser.get(s.userId).push(s);
    }
    const ordered = participants.filter((p) => byUser.has(p.id));
    ordered.sort((a, b) => (b.id === me?.id) - (a.id === me?.id));
    return ordered.map((p) => ({ user: p, slots: byUser.get(p.id).sort((a, b) => a.start - b.start) }));
  });
</script>

<svelte:window {onkeydown} />

{#snippet readonlyRow(name, list, c, ghost = null)}
  <div class="flex items-center gap-3">
    <span class="w-24 shrink-0 truncate text-right text-xs text-slate-600">{name}</span>
    <div class="hour-grid relative h-8 flex-1 rounded-md bg-slate-100">
      {#each list.filter(inView) as s (s.id)}
        <!-- `live`: the owner is moving/resizing this range right now -->
        <div
          class="absolute inset-y-0.5 flex items-center justify-center overflow-hidden rounded-md font-medium text-white {s.end - s.start < 150 ? 'text-[10px] tracking-tight' : 'text-[11px]'} {s.live ? 'ring-2 ring-slate-900/50 ring-offset-1' : ''} {s.deleting ? 'opacity-30' : ''}"
          style="{hbox(s.start, s.end)};background:{s.deleting ? '#e11d48' : fill(c)}"
          title="{minToTime(s.start)} – {minToTime(s.end)}"
        ><span class="truncate px-1.5">{label(s)}</span></div>
      {/each}
      {#if ghost}
        <!-- Range the owner is drawing right now -->
        <div
          class="absolute inset-y-0.5 flex animate-pulse items-center justify-center overflow-hidden rounded-md border-2 border-dashed text-[10px] font-semibold"
          style="{hbox(ghost.start, ghost.end)};border-color:{c};background:{c}33;color:{c}"
          title="{minToTime(ghost.start)} – {minToTime(ghost.end)} (en cours)"
        ><span class="truncate px-1.5">{label(ghost)}</span></div>
      {/if}
    </div>
  </div>
{/snippet}

{#snippet timeline()}
  <div class="select-none space-y-2" style="--hours:{span / 60}">
    <div class="flex items-end gap-3">
      <div class="w-24 shrink-0"></div>
      <div class="relative h-4 flex-1 text-[10px] text-slate-400">
        {#each TICKS as h (h)}
          <span class="absolute -translate-x-1/2" style="left:{pct(h)}">{short(h)}</span>
        {/each}
      </div>
    </div>

    {#if editable}
      <div class="flex items-center gap-3">
        <span class="w-24 shrink-0 text-right text-xs font-semibold text-indigo-700">Vous</span>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          bind:this={track}
          class="hour-grid relative h-12 flex-1 touch-none rounded-lg bg-slate-100 ring-1 ring-slate-200 {drag ? 'cursor-grabbing' : 'cursor-crosshair'}"
          onpointerdown={onTrackDown}
        >
          {#each mySlots.filter(inView) as s (s.id)}
            {@const v = shown(s)}
            {@const isSel = s.id === selectedId}
            {@const dragging = drag?.kind === 'slot' && drag.id === s.id}
            {@const out = dragging && drag.outside}
            <div
              class="absolute inset-y-1 flex items-center justify-center overflow-hidden rounded-md text-[11px] font-medium text-white shadow-sm transition-[opacity,box-shadow]
                {dragging ? 'cursor-grabbing' : 'cursor-grab'}
                {isSel ? 'z-10 ring-2 ring-slate-900/70 ring-offset-1' : ''}
                {out ? 'opacity-40' : ''}"
              style="{hbox(v.start, v.end)};background:{out ? '#e11d48' : fill(color)}"
              title="Cliquez pour modifier · glissez pour déplacer · étirez les bords · glissez hors de la ligne pour supprimer"
              onpointerdown={(e) => onSlotDown(e, s, 'move')}
            >
              <span class="pointer-events-none truncate px-1.5 {v.end - v.start < 150 ? 'text-[10px] tracking-tight' : ''}">{out ? 'Supprimer' : label(v)}</span>
              <span class="absolute inset-y-0 left-0 w-2.5 cursor-ew-resize hover:bg-black/20" onpointerdown={(e) => onSlotDown(e, s, 'start')}>
                {#if isSel}<span class="absolute left-0.5 top-1/2 h-5 w-1 -translate-y-1/2 rounded bg-white/90"></span>{/if}
              </span>
              <span class="absolute inset-y-0 right-0 w-2.5 cursor-ew-resize hover:bg-black/20" onpointerdown={(e) => onSlotDown(e, s, 'end')}>
                {#if isSel}<span class="absolute right-0.5 top-1/2 h-5 w-1 -translate-y-1/2 rounded bg-white/90"></span>{/if}
              </span>
            </div>
          {/each}

          <!-- Range being drawn, or waiting for the server -->
          {#if (drag?.kind === 'create' && drag.end > drag.start) || (pending && !pending.id)}
            {@const r = drag?.kind === 'create' ? drag : pending}
            {@const out = drag?.kind === 'create' && drag.outside}
            <div
              class="pointer-events-none absolute inset-y-1 flex items-center justify-center overflow-hidden rounded-md text-[11px] font-medium text-white shadow-sm {out ? 'opacity-40' : ''}"
              style="{hbox(r.start, r.end)};background:{out ? '#e11d48' : fill(color)}"
            >
              <span class="truncate px-1.5 {r.end - r.start < 150 ? 'text-[10px] tracking-tight' : ''}">{out ? 'Annuler' : label(r)}</span>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    {#each others as row (row.user.id)}
      {@render readonlyRow(row.user.id === me?.id ? 'Vous' : row.user.name, row.slots, colors.get(row.user.id), row.ghost)}
    {/each}
  </div>
{/snippet}

{#snippet timelineVertical()}
  <div bind:this={vscroll} class="relative h-[52vh] select-none overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white">
    <!-- Column headers -->
    <div class="sticky top-0 z-30 flex border-b border-slate-200 bg-white/95 text-[11px] font-semibold backdrop-blur">
      <div class="w-10 shrink-0"></div>
      {#if editable}<div class="flex-[3] py-1.5 text-center text-indigo-700">Vous</div>{/if}
      {#each others as row (row.user.id)}
        <div class="min-w-9 flex-1 truncate border-l border-slate-100 py-1.5 text-center" style="color:{colors.get(row.user.id)}" title={row.user.name}>
          {row.user.id === me?.id ? 'Vous' : initialsOf(row.user.name)}
        </div>
      {/each}
    </div>

    <div class="relative flex" style="height:{(span / 60) * HOUR_V}px;--vofs:{-((from % 60) / 60) * HOUR_V}px">
      <!-- Hours -->
      <div class="w-10 shrink-0">
        {#each vHours as h (h)}
          <div class="relative text-right text-[10px] text-slate-400" style="height:{HOUR_V}px">
            {#if h > from}<span class="absolute -top-1.5 right-1.5">{short(h)}</span>{/if}
          </div>
        {/each}
      </div>

      {#if editable}
        <!-- My column: tap an empty hour to create, tap a range to select, use its handles -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          bind:this={track}
          class="hour-grid-v relative flex-[3] border-l border-slate-200 bg-indigo-50/30"
          style="touch-action: pan-y"
          onpointerdown={onTrackDown}
        >
          {#each mySlots.filter(inView) as s (s.id)}
            {@const v = shown(s)}
            {@const isSel = s.id === selectedId}
            {@const dragging = drag?.kind === 'slot' && drag.id === s.id}
            {@const out = dragging && drag.outside}
            <div
              class="absolute inset-x-1.5 rounded-lg text-white shadow-sm transition-[opacity,box-shadow] {isSel ? 'z-20 ring-2 ring-slate-900/70 ring-offset-1' : 'z-10'} {out ? 'opacity-40' : ''}"
              style="{vbox(v.start, v.end)};background:{out ? '#e11d48' : fill(color)};touch-action:pan-y"
              onpointerdown={(e) => onSlotTap(e, s)}
            >
              <div class="pointer-events-none overflow-hidden px-2 pt-1 text-xs font-semibold leading-tight">
                {out ? 'Relâcher pour supprimer' : `${minToTime(v.start)} – ${minToTime(v.end)}`}
              </div>
              {#if isSel}
                <!-- Big touch handles: top = start, bottom = end, center = move -->
                <button
                  class="absolute -top-3 left-1/2 flex h-6 w-14 -translate-x-1/2 items-center justify-center"
                  style="touch-action:none" aria-label="Changer l'heure de début"
                  onpointerdown={(e) => onSlotDown(e, s, 'start')}
                ><span class="h-2 w-10 rounded-full border-2 border-white bg-slate-900/80 shadow"></span></button>
                <button
                  class="absolute -bottom-3 left-1/2 flex h-6 w-14 -translate-x-1/2 items-center justify-center"
                  style="touch-action:none" aria-label="Changer l'heure de fin"
                  onpointerdown={(e) => onSlotDown(e, s, 'end')}
                ><span class="h-2 w-10 rounded-full border-2 border-white bg-slate-900/80 shadow"></span></button>
                {#if v.end - v.start >= 45}
                  <button
                    class="absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-sm text-slate-700 shadow"
                    style="touch-action:none" aria-label="Déplacer la plage"
                    onpointerdown={(e) => onSlotDown(e, s, 'move')}
                  >✥</button>
                {/if}
              {/if}
            </div>
          {/each}
          {#if pending && !pending.id}
            <div class="pointer-events-none absolute inset-x-1.5 rounded-lg opacity-70" style="{vbox(pending.start, pending.end)};background:{fill(color)}"></div>
          {/if}
        </div>
      {/if}

      {#each others as row (row.user.id)}
        {@const c = colors.get(row.user.id)}
        <div class="hour-grid-v relative min-w-9 flex-1 border-l border-slate-100">
          {#each row.slots.filter(inView) as s (s.id)}
            <div
              class="absolute inset-x-0.5 overflow-hidden rounded-md text-white {s.live ? 'ring-2 ring-slate-900/50' : ''} {s.deleting ? 'opacity-30' : ''}"
              style="{vbox(s.start, s.end)};background:{s.deleting ? '#e11d48' : fill(c)}"
              title="{row.user.name} · {minToTime(s.start)} – {minToTime(s.end)}"
            >
              {#if s.end - s.start >= 45}<div class="px-0.5 pt-0.5 text-center text-[9px] font-medium leading-tight">{short(s.start)}<br />{short(s.end)}</div>{/if}
            </div>
          {/each}
          {#if row.ghost}
            <div class="absolute inset-x-0.5 animate-pulse rounded-md border-2 border-dashed" style="{vbox(row.ghost.start, row.ghost.end)};border-color:{c};background:{c}33"></div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/snippet}

<Modal {onclose} size="max-w-4xl">
  <div class="flex items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
    <button class="btn-ghost px-2" disabled={!prevDay} onclick={() => onchangeday(prevDay)} aria-label="Jour précédent">‹</button>
    <h2 class="text-center text-base font-semibold text-slate-900 first-letter:uppercase">{fmtLong(day)}</h2>
    <div class="flex items-center">
      <button class="btn-ghost px-2" disabled={!nextDay} onclick={() => onchangeday(nextDay)} aria-label="Jour suivant">›</button>
      <button class="btn-ghost px-2 text-lg leading-none" onclick={onclose} aria-label="Fermer">×</button>
    </div>
  </div>

  <div class="space-y-5 p-4 sm:space-y-6 sm:p-6">
    {#if editable}
      <div class="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 sm:p-5">
        <h3 class="text-sm font-semibold text-slate-800">Mes disponibilités</h3>
        <p class="mt-0.5 text-xs text-slate-500">
          {#if mobile}
            Touchez une heure libre pour créer une plage. Touchez une plage pour la modifier : tirez ses poignées,
            ou utilisez ✥ pour la déplacer.
          {:else}
            Vous pouvez avoir plusieurs plages par jour. Cliquez ou glissez sur une zone libre de votre ligne pour en créer une.
            Cliquez une plage pour la modifier, étirez ses bords pour la redimensionner, glissez-la hors de la ligne pour la supprimer.
          {/if}
        </p>

        <div class="mt-3 grid grid-cols-2 items-end gap-3 sm:mt-4 sm:flex sm:flex-wrap sm:gap-4">
          <div>
            <label class="label text-xs" for="ov-start">Heure de début</label>
            <select
              id="ov-start"
              class="input w-full sm:w-32 disabled:bg-slate-100 disabled:text-slate-400"
              disabled={!selected}
              value={selected ? shown(selected).start : ''}
              onchange={(e) => changeStart(Number(e.currentTarget.value))}
            >
              {#if !selected}<option value="">--:--</option>{/if}
              {#each startOptions as m (m)}<option value={m}>{minToTime(m)}</option>{/each}
            </select>
          </div>
          <div>
            <label class="label text-xs" for="ov-end">Heure de fin</label>
            <select
              id="ov-end"
              class="input w-full sm:w-32 disabled:bg-slate-100 disabled:text-slate-400"
              disabled={!selected}
              value={selected ? shown(selected).end : ''}
              onchange={(e) => update(selected, shown(selected).start, Number(e.currentTarget.value))}
            >
              {#if !selected}<option value="">--:--</option>{/if}
              {#each endOptions as m (m)}<option value={m}>{minToTime(m)}</option>{/each}
            </select>
          </div>
          {#if selected}
            <button class="btn border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 sm:border-0 sm:bg-transparent" onclick={() => remove(selected)}>Supprimer<span class="hidden sm:inline">&nbsp;la plage</span></button>
          {:else}
            <p class="hidden pb-2 text-xs text-slate-500 sm:block">Sélectionnez une plage pour modifier ses heures.</p>
          {/if}
          <button
            class="btn-outline {selected ? '' : 'col-span-2'} sm:ml-auto"
            disabled={!spot}
            title={spot ? `Créer ${minToTime(spot.start)}–${minToTime(spot.end)}` : 'Plus de place libre dans cette journée'}
            onclick={() => create(spot.start, spot.end)}
          >＋ Nouvelle plage</button>
        </div>

        <div class="-mx-3 mt-3 flex items-center gap-1.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          <span class="shrink-0 text-xs text-slate-500">Ajout rapide :</span>
          {#each presets as p (p.label)}
            {@const ok = fits(p.start, p.end)}
            <button
              class="shrink-0 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-600 transition enabled:hover:border-indigo-400 disabled:opacity-40 sm:py-0.5"
              disabled={!ok}
              title={ok ? 'Ajouter cette plage' : 'Chevauche une de vos plages'}
              onclick={() => create(p.start, p.end)}
            >{p.label} <span class="opacity-70">{minToTime(p.start)}–{minToTime(p.end)}</span></button>
          {/each}
        </div>

        <div class="mt-4 sm:mt-5">{#if mobile}{@render timelineVertical()}{:else}{@render timeline()}{/if}</div>
      </div>
    {:else if mobile}
      {@render timelineVertical()}
    {:else}
      {@render timeline()}
    {/if}

    <div>
      <h3 class="mb-2 text-sm font-semibold text-slate-800">Disponibilités de la journée</h3>
      {#if listRows.length === 0}
        <p class="text-sm text-slate-500">Personne n'a encore indiqué de disponibilité pour cette journée.</p>
      {:else}
        <ul class="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {#each listRows as row (row.user.id)}
            {@const mine = row.user.id === me?.id}
            <li class="flex flex-wrap items-center gap-2 px-3 py-2">
              <span class="h-2.5 w-2.5 rounded-full" style="background:{colors.get(row.user.id)}"></span>
              <span class="min-w-24 text-sm font-medium text-slate-800">{row.user.name}{mine ? ' (vous)' : ''}</span>
              <div class="flex flex-wrap gap-1.5">
                {#each row.slots as s (s.id)}
                  {@const v = mine ? shown(s) : s}
                  {#if mine && editable}
                    <button
                      class="rounded-md px-2 py-0.5 text-xs transition {s.id === selectedId ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-indigo-100'}"
                      onclick={() => (selectedId = s.id)}
                    >{minToTime(v.start)} – {minToTime(v.end)}</button>
                  {:else}
                    <span class="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{minToTime(v.start)} – {minToTime(v.end)}</span>
                  {/if}
                {/each}
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
</Modal>

<style>
  /* One vertical line per hour behind the timeline rows. */
  .hour-grid {
    background-image: repeating-linear-gradient(to right, rgb(226 232 240) 0 1px, transparent 1px calc(100% / var(--hours, 24)));
  }
  /* Phone: one horizontal line per hour (48 px) and a lighter one at the half hour. */
  .hour-grid-v {
    background-image:
      repeating-linear-gradient(to bottom, rgb(226 232 240) 0 1px, transparent 1px 48px),
      repeating-linear-gradient(to bottom, transparent 0 24px, rgb(241 245 249) 24px 25px, transparent 25px 48px);
    background-position: 0 var(--vofs, 0);
  }
</style>
