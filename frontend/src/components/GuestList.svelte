<script>
  import { initials } from '../lib/colors.js';
  import { fmtShort, minToTime } from '../lib/dates.js';

  // canManage: creator or organization administrator (remove / add guests).
  let { participants, colors, slots, presence, me, creatorId, canManage = false, onremove, onaddguests } = $props();

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
  {/if}
  <ul class="space-y-1">
    {#each participants as p (p.id)}
      {@const ed = editingBy.get(p.id)}
      <li class="group flex items-center gap-3 rounded-lg px-2 py-2 {p.id === me?.id ? 'bg-indigo-50/60' : ''}">
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
          <div class="truncate text-xs text-slate-500">{p.email}</div>
          {#if ed}
            <div class="mt-0.5 animate-pulse text-xs font-medium" style="color:{colors.get(p.id)}">
              ✎ modifie le {fmtShort(ed.day)} ({minToTime(ed.start)}–{minToTime(ed.end)})
            </div>
          {:else}
            <div class="text-xs text-slate-400">{daysBy.get(p.id)?.size ?? 0} jour(s) disponible(s)</div>
          {/if}
        </div>
        {#if canManage && p.id !== creatorId}
          <button
            class="shrink-0 rounded-md px-1.5 py-0.5 text-xs text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100"
            title="Retirer de l'occasion"
            onclick={() => onremove(p)}
          >Retirer</button>
        {/if}
      </li>
    {/each}
  </ul>
</aside>
