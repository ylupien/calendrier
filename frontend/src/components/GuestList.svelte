<script>
  import { initials } from '../lib/colors.js';
  import { fmtShort, minToTime } from '../lib/dates.js';
  import { t } from '../lib/i18n.svelte.js';

  // canManage: creator or organization administrator (remove / add guests).
  // focus: people selected to be shown in the calendar (empty = everyone); onhover greys out the others.
  let {
    participants, colors, slots, presence, me, creatorId, canManage = false, onremove, ontransfer, onaddguests,
    oninvite, onresend,
    focus = new Set(), onhover = () => {}, ontoggle = () => {}, onclearfocus = () => {},
  } = $props();

  let menuFor = $state(null); // guest whose "⋯" menu is open

  // Members have already used the site; invited people have an account prepared by an invitation by email
  // and have not opened their link yet (greyed out, below a line).
  const members = $derived(participants.filter((p) => p.active !== false));
  const invited = $derived(participants.filter((p) => p.active === false));

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

<svelte:window
  onclick={() => (menuFor = null)}
  onkeydown={(e) => e.key === 'Escape' && (menuFor = null)}
/>

<aside class="card h-fit p-4">
  <div class="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
    <h2 class="mr-auto whitespace-nowrap font-semibold text-slate-900">{t('GuestList.title')} <span class="text-slate-400">({participants.length})</span></h2>
    {#if canManage}
      <button class="btn-ghost whitespace-nowrap px-2 py-1 text-xs" onclick={onaddguests} title={t('GuestList.addTitle')}>＋ {t('GuestList.add')}</button>
    {/if}
    <span class="flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-500">
      <span class="h-2 w-2 rounded-full bg-emerald-500"></span>{t('GuestList.online', { count: presence.online.length })}
    </span>
  </div>
  {#if participants.length === 0}
    <p class="text-sm text-slate-500">{t('GuestList.empty')}</p>
  {:else if focus.size}
    <div class="mb-2 flex items-center justify-between rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs text-indigo-700">
      <span>👁 {t('GuestList.focused', { count: focus.size })}</span>
      <button class="text-link font-medium" onclick={onclearfocus}>{t('GuestList.showAll')}</button>
    </div>
  {:else}
    <p class="mb-2 text-xs text-slate-400">{t('GuestList.hint')}</p>
  {/if}
  {#if invited.length}
    <h3 class="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('GuestList.members', { count: members.length })}</h3>
  {/if}
  <ul class="space-y-1">
    {#each members as p (p.id)}{@render guest(p)}{/each}
  </ul>
  {#if invited.length}
    <div class="my-3 border-t border-slate-200"></div>
    <h3 class="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{t('GuestList.invited', { count: invited.length })}</h3>
    <p class="mb-1.5 px-2 text-xs text-slate-400">{t('GuestList.invitedHint')}</p>
    <ul class="space-y-1">
      {#each invited as p (p.id)}{@render guest(p)}{/each}
    </ul>
  {/if}
  {#if canManage}
    <button
      class="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50"
      onclick={oninvite}
    >✉️ {t('GuestList.invite')}</button>
  {/if}
</aside>

{#snippet guest(p)}
  {@const ed = editingBy.get(p.id)}
  {@const selected = focus.has(p.id)}
  {@const pending = p.active === false}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <li
    class="group relative flex items-center gap-1 rounded-lg transition
      {selected ? 'bg-indigo-50 ring-1 ring-indigo-300' : p.id === me?.id ? 'bg-indigo-50/60' : ''}
      {focus.size && !selected ? 'opacity-50' : ''}"
    onmouseenter={() => !pending && onhover(p.id)}
    onmouseleave={() => onhover(null)}
  >
    <!-- An invited person has no availabilities yet: nothing to show in the calendar (disabled) -->
    <button
      class="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left {pending ? 'cursor-default' : 'hover:bg-slate-100/70'}"
      disabled={pending}
      aria-pressed={pending ? undefined : selected}
      title={pending ? t('GuestList.pendingTitle') : selected ? t('GuestList.unselect') : t('GuestList.select')}
      onclick={() => ontoggle(p.id)}
      onfocus={() => onhover(p.id)}
      onblur={() => onhover(null)}
    >
      <div class="relative shrink-0">
        {#if pending}
          <span class="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-slate-300 bg-slate-100 text-xs font-semibold text-slate-400">
            {initials(p.name)}
          </span>
        {:else}
          <span class="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white" style="background:{colors.get(p.id)}">
            {initials(p.name)}
          </span>
        {/if}
        {#if online.has(p.id)}
          <span class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" title={t('GuestList.onlineDot')}></span>
        {/if}
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5">
          <span class="truncate text-sm font-medium {pending ? 'text-slate-400' : 'text-slate-800'}">{p.name}</span>
          {#if p.id === me?.id}<span class="text-xs text-slate-400">{t('common.you')}</span>{/if}
          {#if p.id === creatorId}<span title={t('GuestList.owner')}>👑</span>{/if}
        </div>
        {#if p.email}<div class="truncate text-xs {pending ? 'text-slate-400' : 'text-slate-500'}">{p.email}</div>{/if}
        {#if pending}
          <div class="text-xs text-slate-400">✉️ {t('GuestList.invitationSent')}</div>
        {:else if ed}
          <div class="mt-0.5 animate-pulse text-xs font-medium" style="color:{colors.get(p.id)}">
            ✎ {t('GuestList.editing', { day: fmtShort(ed.day), start: minToTime(ed.start), end: minToTime(ed.end) })}
          </div>
        {:else}
          <div class="text-xs text-slate-400">{t('GuestList.days', { count: daysBy.get(p.id)?.size ?? 0 })}</div>
        {/if}
      </div>
      {#if selected}<span class="shrink-0 text-base" title={t('GuestList.shown')}>👁</span>{/if}
    </button>
    {#if canManage && p.id !== creatorId}
      <!-- Guest actions in a "⋯" menu, so nothing covers the name -->
      <div class="relative shrink-0 pr-1">
        <button
          class="flex h-8 w-8 items-center justify-center rounded-md text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700 {menuFor === p.id ? 'bg-slate-100 text-slate-700' : ''}"
          title={t('common.actions')}
          aria-label={t('GuestList.actionsFor', { name: p.name })}
          aria-haspopup="menu"
          aria-expanded={menuFor === p.id}
          onclick={(e) => { e.stopPropagation(); menuFor = menuFor === p.id ? null : p.id; }}
        >⋯</button>
        {#if menuFor === p.id}
          <div role="menu" class="absolute right-1 top-full z-20 mt-1 w-56 overflow-hidden rounded-lg border border-slate-200 bg-surface py-1 shadow-lg">
            {#if pending}
              {#if p.email}
                <button role="menuitem" class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                  onclick={() => { menuFor = null; onresend(p); }}>
                  <span class="w-5 text-center">✉️</span>{t('GuestList.resend')}
                </button>
              {/if}
            {:else}
              <button role="menuitem" class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                onclick={() => { menuFor = null; ontransfer(p); }}>
                <span class="w-5 text-center">👑</span>{t('GuestList.transfer')}
              </button>
            {/if}
            <button role="menuitem" class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
              onclick={() => { menuFor = null; onremove(p); }}>
              <span class="w-5 text-center">✕</span>{t('GuestList.remove')}
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </li>
{/snippet}
