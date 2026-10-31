<script>
  import { initials } from '../lib/colors.js';
  import { fmtShort, minToTime } from '../lib/dates.js';

  // canManage: creator or organization administrator (remove / add guests).
  // focus: people selected to be shown in the calendar (empty = everyone); onhover greys out the others.
  let {
    participants, colors, slots, presence, me, creatorId, canManage = false, onremove, onaddguests,
    focus = new Set(), onhover = () => {}, ontoggle = () => {}, onclearfocus = () => {},
  } = $props();

  const online = $derived(new Set(presence.online));
  const editingBy = $derived(new Map(presence.editing.map((e) => [e.userId, e])));
  const daysBy = $derived.by(() => {
    const m = new Map();
    for (const s of slots) {
      if (!m.has(s.userId)) m.set(s.userId, new Set());
      m.get(s.userId).add(s.day);
    }
    return m;
  });
</script>

<aside class="card h-fit p-4">
  <div class="mb-3 flex items-center justify-between">
    <h2 class="font-semibold text-slate-900">Invités <span class="text-slate-400">({participants.length})</span></h2>
    {#if canManage}
      <button class="btn-ghost px-2 py-1 text-xs" onclick={onaddguests}>＋ Ajouter</button>
    {/if}
    <span class="flex items-center gap-1.5 text-xs text-slate-500">
      <span class="h-2 w-2 rounded-full bg-emerald-500"></span>{presence.online.length} en ligne
    </span>
  </div>
  {#if participants.length === 0}
    <p class="text-sm text-slate-500">Personne pour l'instant. Partagez le lien !</p>
  {:else if focus.size}
    <div class="mb-2 flex items-center justify-between rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs text-indigo-700">
      <span>👁 {focus.size} personne{focus.size > 1 ? 's' : ''} affichée{focus.size > 1 ? 's' : ''} dans le calendrier</span>
      <button class="text-link font-medium" onclick={onclearfocus}>Tout afficher</button>
    </div>
  {:else}
    <p class="mb-2 text-xs text-slate-400">Survolez un nom pour le repérer, cliquez pour n'afficher que certaines personnes.</p>
  {/if}
  <ul class="space-y-1">
    {#each participants as p (p.id)}
      {@const ed = editingBy.get(p.id)}
      {@const selected = focus.has(p.id)}
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <li
        class="group relative flex items-center gap-1 rounded-lg transition
          {selected ? 'bg-indigo-50 ring-1 ring-indigo-300' : p.id === me?.id ? 'bg-indigo-50/60' : ''}
          {focus.size && !selected ? 'opacity-50' : ''}"
        onmouseenter={() => onhover(p.id)}
        onmouseleave={() => onhover(null)}
      >
        <button
          class="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-100/70"
          aria-pressed={selected}
          title={selected ? 'Retirer de la sélection' : 'Afficher seulement les personnes sélectionnées'}
          onclick={() => ontoggle(p.id)}
          onfocus={() => onhover(p.id)}
          onblur={() => onhover(null)}
        >
        <div class="relative shrink-0">
          <span class="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white" style="background:{colors.get(p.id)}">
            {initials(p.name)}
          </span>
          {#if online.has(p.id)}
            <span class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" title="En ligne"></span>
          {/if}
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5">
            <span class="truncate text-sm font-medium text-slate-800">{p.name}</span>
            {#if p.id === me?.id}<span class="text-xs text-slate-400">(vous)</span>{/if}
            {#if p.id === creatorId}<span title="Créateur">👑</span>{/if}
          </div>
          {#if p.email}<div class="truncate text-xs text-slate-500">{p.email}</div>{/if}
          {#if ed}
            <div class="mt-0.5 animate-pulse text-xs font-medium" style="color:{colors.get(p.id)}">
              ✎ modifie le {fmtShort(ed.day)} ({minToTime(ed.start)}–{minToTime(ed.end)})
            </div>
          {:else}
            <div class="text-xs text-slate-400">{daysBy.get(p.id)?.size ?? 0} jour(s) disponible(s)</div>
          {/if}
        </div>
        {#if selected}<span class="shrink-0 text-base" title="Affiché dans le calendrier">👁</span>{/if}
        </button>
        {#if canManage && p.id !== creatorId}
          <button
            class="absolute right-1 top-1 rounded-md bg-surface px-1.5 py-0.5 text-xs text-slate-400 opacity-0 shadow-sm transition hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100"
            title="Retirer de l'occasion"
            onclick={() => onremove(p)}
          >Retirer</button>
        {/if}
      </li>
    {/each}
  </ul>
</aside>
