<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { api } from '../lib/api.js';
  import { getSocket, ensureConnected } from '../lib/socket.js';
  import { link, navigate } from '../lib/router.svelte.js';
  import { hashTab } from '../lib/hashTab.svelte.js';
  import { session, askProfile } from '../lib/session.svelte.js';
  import { fmtOccasionDays, fmtDateTime, pad } from '../lib/dates.js';
  import { colorMap } from '../lib/colors.js';
  import Calendar from '../components/Calendar.svelte';
  import GuestList from '../components/GuestList.svelte';
  import CopyLink from '../components/CopyLink.svelte';
  import OccasionSettings from '../components/OccasionSettings.svelte';
  import Report from '../components/Report.svelte';
  import AddGuests from '../components/AddGuests.svelte';
  import TransferOwner from '../components/TransferOwner.svelte';

  let { slug } = $props();

  let occasion = $state(null);
  let participants = $state([]);
  let slots = $state([]);
  let presence = $state({ online: [], editing: [] });
  let error = $state('');
  let notice = $state('');
  let settingsOpen = $state(false);
  let addingGuests = $state(false);
  let transferTo = $state(null); // guest about to receive the ownership
  // Guest list → calendar: people selected to be shown (temporary, empty = everyone) and person hovered.
  let focus = $state(new Set());
  let hovered = $state(null);

  function toggleFocus(id) {
    const next = new Set(focus);
    next.has(id) ? next.delete(id) : next.add(id);
    focus = next;
  }
  // Tab in the address (#calendrier, #rapport), kept when the page is reloaded.
  const tab = hashTab({ calendar: 'calendrier', report: 'rapport' }, 'calendar');
  let calendar = $state(null);
  let nowLocal = $state(localNow());

  const socket = getSocket();
  const me = $derived(session.me);
  const colors = $derived(colorMap(participants));

  function localNow() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // The deadline may pass while the page is open: re-evaluate every 30 s (the server enforces it anyway).
  const editClosed = $derived(!!occasion && (occasion.editClosed || (!!occasion.editDeadline && occasion.editDeadline <= nowLocal)));
  // A site administrator who is not a guest only looks at the occasion.
  const editable = $derived(!!occasion && !occasion.archived && !editClosed && !!me?.name && occasion.isGuest !== false);
  const canSettings = $derived(!!occasion && (occasion.isCreator || !!me?.isSiteAdmin));
  const othersEditing = $derived(presence.editing.filter((e) => e.userId !== me?.id));

  async function load() {
    try {
      const data = await api.occasion(slug);
      occasion = data.occasion;
      participants = data.participants;
      slots = data.slots;
      error = '';
    } catch (e) {
      error = e.message;
    }
  }

  function join() {
    socket.emit('occasion:join', slug, (res) => {
      if (res?.ok) presence = res.presence;
    });
  }

  function applyDay({ userId, day, slots: daySlots }) {
    slots = [...slots.filter((s) => !(s.userId === userId && s.day === day)), ...daySlots];
  }

  function upsertParticipant(user) {
    const i = participants.findIndex((p) => p.id === user.id);
    if (i >= 0) participants[i] = user;
    else participants = [...participants, user];
  }

  /** Availabilities of days removed from the occasion are deleted by the server: drop them here too. */
  function keepOpenDays(o) {
    if (o?.days) slots = slots.filter((s) => o.days.includes(s.day));
  }

  function onOccasionUpdated(o) {
    keepOpenDays(o);
    // The owner changed: reload to get my management rights again.
    if (occasion && o.creatorId !== occasion.creatorId) return load();
    // Broadcasts carry no per-user flags: keep isCreator / canManageGuests computed for me.
    occasion = { ...o, isCreator: o.creatorId === me?.id, canManageGuests: occasion?.canManageGuests, isGuest: occasion?.isGuest };
  }

  function ownerTransferred(o) {
    occasion = { ...o, isGuest: occasion.isGuest };
    transferTo = null;
    settingsOpen = false;
    flash(`${participants.find((p) => p.id === o.creatorId)?.name ?? 'Cette personne'} est maintenant propriétaire de l'occasion.`);
  }

  function onOccasionDeleted() {
    error = 'Cette occasion a été supprimée.';
    socket.emit('occasion:leave');
  }

  /** Site administrator: deletes the occasion for everyone. */
  async function deleteOccasion() {
    const msg =
      `Supprimer définitivement l'occasion « ${occasion.title} » ?\n\n` +
      'Ses journées, ses invités et toutes leurs plages seront effacés. Cette action est irréversible.';
    if (!confirm(msg)) return;
    try {
      await api.admin.deleteOccasion(occasion.id);
      navigate('/admin');
    } catch (e) {
      flash(e.message);
    }
  }

  function onParticipantRemoved({ userId }) {
    if (userId === me?.id) {
      error = 'Vous avez été retiré de cette occasion.';
      socket.emit('occasion:leave');
      return;
    }
    participants = participants.filter((p) => p.id !== userId);
    slots = slots.filter((s) => s.userId !== userId);
  }

  async function removeGuest(p) {
    if (!confirm(`Retirer ${p.name} de l'occasion ? Ses disponibilités seront supprimées.`)) return;
    try {
      participants = (await api.removeGuest(slug, p.id)).participants;
      slots = slots.filter((s) => s.userId !== p.id);
    } catch (e) {
      flash(e.message);
    }
  }

  // After a reconnect, re-join the room and resync to catch changes missed while offline.
  function onReconnect() {
    join();
    load();
  }

  onMount(async () => {
    await load();
    if (!occasion) return;
    // First visit: opening this invitation link has just created the account and its cookie.
    if (!session.me?.id) {
      session.me = await api.me();
      occasion = { ...occasion, isCreator: occasion.creatorId === session.me.id };
    }
    ensureConnected();
    if (!me?.name && !occasion.archived && occasion.isGuest !== false) askProfile({ required: true, then: () => upsertParticipant(session.me) });

    socket.on('slots:day', applyDay);
    socket.on('participant:upsert', upsertParticipant);
    socket.on('occasion:updated', onOccasionUpdated);
    socket.on('participant:removed', onParticipantRemoved);
    socket.on('occasion:deleted', onOccasionDeleted);
    socket.on('presence', (p) => (presence = p));
    socket.on('connect', onReconnect);
    if (socket.connected) join();
  });

  const timer = setInterval(() => (nowLocal = localNow()), 30_000);

  // The header shows the logo of the occasion's organization.
  $effect(() => {
    session.branding = occasion?.organization ?? null;
  });

  // The welcome form warns a new visitor who types the name of a guest already there.
  $effect(() => {
    session.occasionNames = participants.filter((p) => p.id !== me?.id).map((p) => p.name);
  });

  onDestroy(() => {
    session.occasionNames = [];
    session.branding = null;
    clearInterval(timer);
    socket.emit('occasion:leave');
    socket.off('slots:day', applyDay);
    socket.off('participant:upsert', upsertParticipant);
    socket.off('occasion:updated', onOccasionUpdated);
    socket.off('participant:removed', onParticipantRemoved);
    socket.off('occasion:deleted', onOccasionDeleted);
    socket.off('presence');
    socket.off('connect', onReconnect);
  });

  function flash(message) {
    notice = message;
    setTimeout(() => (notice = ''), 4000);
  }

  async function addSlot(day, start, end) {
    try {
      applyDay(await api.addSlot(slug, { day, start, end }));
      return true;
    } catch (e) {
      flash(e.message);
      return false;
    }
  }

  async function updateSlot(id, start, end) {
    try {
      applyDay(await api.updateSlot(slug, id, { start, end }));
    } catch (e) {
      flash(e.message);
    }
  }

  async function deleteSlot(id) {
    try {
      applyDay(await api.deleteSlot(slug, id));
    } catch (e) {
      flash(e.message);
    }
  }

  async function setArchived(archived) {
    if (archived && !confirm(`Archiver « ${occasion.title} » ? Plus personne ne pourra modifier ses disponibilités.`)) return;
    try {
      occasion = { ...(await api.archiveOccasion(slug, archived)), canManageGuests: occasion.canManageGuests, isGuest: occasion.isGuest };
    } catch (e) {
      flash(e.message);
    }
  }

  function setEditing(state) {
    socket.emit('editing', state);
  }

  const range = $derived(occasion && fmtOccasionDays(occasion));
</script>

{#if error}
  <div class="card mx-auto max-w-lg p-8 text-center">
    <div class="text-4xl">🔍</div>
    <p class="mt-3 font-medium text-slate-800">{error}</p>
    <a href="/" onclick={link} class="btn-outline mt-5">Retour à mes occasions</a>
  </div>
{:else if !occasion}
  <p class="py-24 text-center text-slate-400">Chargement…</p>
{:else}
  <!-- Wide screens: both columns have the same height; the back link stays at the top,
       the title block ends at the same height as the action buttons. The minimum height is the one
       with the owner's buttons, so the title does not move for guests (who have no buttons). -->
  <div class="flex flex-col gap-4 lg:min-h-27 lg:flex-row lg:items-stretch lg:justify-between {occasion.description ? 'mb-3' : 'mb-6'}">
    <div class="flex min-w-0 flex-col justify-between gap-1">
      <a href="/" onclick={link} class="text-link self-start text-sm font-medium">← Mes occasions</a>
      <div>
      <h1 class="text-2xl font-bold text-slate-900">{occasion.title}</h1>
      <div class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
        <span>📅 {range}</span>
        {#if occasion.organization}
          <span>🏢 {occasion.organization.name}{occasion.allMembers ? ' · tous les membres invités' : ''}</span>
        {/if}
        {#if occasion.editDeadline}
          <span>✏️ Édition jusqu'au {fmtDateTime(occasion.editDeadline)}</span>
        {/if}
      </div>
      </div>
    </div>
    <div class="flex w-full flex-col gap-2 lg:w-96">
      {#if !occasion.archived}
        <span class="text-xs font-medium uppercase tracking-wide text-slate-500">Lien de partage</span>
        <CopyLink {slug} />
      {/if}
      {#if canSettings}
        <div class="flex justify-end gap-2">
          {#if !occasion.archived}
            <button class="btn-outline" onclick={() => setArchived(true)}>🗄️ Archiver</button>
            <button class="btn-outline" onclick={() => (settingsOpen = true)}>⚙️ Paramètres</button>
          {:else if occasion.archivedManually}
            <button class="btn-outline" onclick={() => setArchived(false)}>↩️ Désarchiver</button>
          {/if}
          {#if me?.isSiteAdmin}
            <button class="btn-outline text-rose-600" onclick={deleteOccasion} title="Supprimer l'occasion (administrateur)">🗑️ Supprimer</button>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  {#if occasion.description}<p class="mb-6 max-w-3xl whitespace-pre-line text-slate-600">{occasion.description}</p>{/if}

  {#if occasion.isGuest === false}
    <div class="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
      🛡️ Vous consultez cette occasion comme administrateur du site : vous n'en êtes pas invité.
    </div>
  {/if}

  {#if occasion.archived}
    <div class="mb-4 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-600">
      🗄️ {occasion.archivedManually ? 'Cette occasion a été archivée par son créateur' : 'Cette occasion est terminée et archivée'} :
      les disponibilités sont en lecture seule.
    </div>
  {:else if editClosed}
    <div class="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      🔒 La période d'édition est terminée : les disponibilités ne peuvent plus être modifiées.
    </div>
  {/if}

  <div class="mb-4 flex gap-1 border-b border-slate-200">
    {#each [{ id: 'calendar', label: '🗓️ Calendrier' }, { id: 'report', label: '📊 Rapport' }] as t (t.id)}
      <button
        class="-mb-px border-b-2 px-4 py-2 text-sm font-medium transition {tab.value === t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}"
        onclick={() => (tab.value = t.id)}
      >{t.label}</button>
    {/each}
  </div>

  <div class="grid gap-6 lg:grid-cols-[1fr_18rem]">
    {#if tab.value === 'report'}
      <Report
        {occasion}
        {participants}
        {slots}
        onopenday={async (day) => {
          tab.value = 'calendar';
          await tick();
          calendar?.openDay(day);
        }}
      />
    {:else}
    <Calendar
      bind:this={calendar}
      {occasion}
      {participants}
      {slots}
      {colors}
      me={me}
      {editable}
      editing={othersEditing}
      onadd={addSlot}
      onupdate={updateSlot}
      ondelete={deleteSlot}
      onediting={setEditing}
      {focus}
      highlight={hovered}
    />
    {/if}
    <GuestList
      {participants}
      {colors}
      {slots}
      {presence}
      {me}
      creatorId={occasion.creatorId}
      canManage={occasion.canManageGuests && !occasion.archived}
      onremove={removeGuest}
      ontransfer={(p) => (transferTo = p)}
      onaddguests={() => (addingGuests = true)}
      {focus}
      onhover={(id) => (hovered = id)}
      ontoggle={toggleFocus}
      onclearfocus={() => (focus = new Set())}
    />
  </div>
{/if}

{#if notice}
  <div class="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-[#0f172a] px-4 py-2.5 text-sm text-white shadow-lg ring-1 ring-white/10">{notice}</div>
{/if}

{#if addingGuests}
  <AddGuests {occasion} onclose={() => (addingGuests = false)} onadded={(list) => (participants = list)} />
{/if}

{#if transferTo}
  <TransferOwner
    {occasion}
    person={transferTo}
    iAmOwner={occasion.isCreator}
    onclose={() => (transferTo = null)}
    ondone={ownerTransferred}
  />
{/if}

{#if settingsOpen}
  <OccasionSettings
    {occasion}
    {slots}
    onclose={() => (settingsOpen = false)}
    onsaved={(o) => { keepOpenDays(o); occasion = { ...o, canManageGuests: occasion.canManageGuests, isGuest: occasion.isGuest }; settingsOpen = false; }}
  />
{/if}
