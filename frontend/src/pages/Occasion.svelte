<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { api } from '../lib/api.js';
  import { getSocket } from '../lib/socket.js';
  import { link } from '../lib/router.svelte.js';
  import { session, askProfile } from '../lib/session.svelte.js';
  import { fmtMedium, fmtShort, fmtDateTime, pad } from '../lib/dates.js';
  import { colorMap } from '../lib/colors.js';
  import Calendar from '../components/Calendar.svelte';
  import GuestList from '../components/GuestList.svelte';
  import CopyLink from '../components/CopyLink.svelte';
  import OccasionSettings from '../components/OccasionSettings.svelte';
  import Report from '../components/Report.svelte';
  import AddGuests from '../components/AddGuests.svelte';

  let { slug } = $props();

  let occasion = $state(null);
  let participants = $state([]);
  let slots = $state([]);
  let presence = $state({ online: [], editing: [] });
  let error = $state('');
  let notice = $state('');
  let settingsOpen = $state(false);
  let addingGuests = $state(false);
  let tab = $state('calendar'); // 'calendar' | 'report'
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
  const editable = $derived(!!occasion && !occasion.archived && !editClosed && !!me?.name);
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

  function onOccasionUpdated(o) {
    // Broadcasts carry no per-user flags: keep isCreator / canManageGuests computed for me.
    occasion = { ...o, isCreator: o.creatorId === me?.id, canManageGuests: occasion?.canManageGuests };
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
    if (!me?.name && !occasion.archived) askProfile({ required: true, then: () => upsertParticipant(session.me) });

    socket.on('slots:day', applyDay);
    socket.on('participant:upsert', upsertParticipant);
    socket.on('occasion:updated', onOccasionUpdated);
    socket.on('participant:removed', onParticipantRemoved);
    socket.on('presence', (p) => (presence = p));
    socket.on('connect', onReconnect);
    if (socket.connected) join();
  });

  const timer = setInterval(() => (nowLocal = localNow()), 30_000);

  // The header shows the logo of the occasion's organization.
  $effect(() => {
    session.branding = occasion?.organization ?? null;
  });

  onDestroy(() => {
    session.branding = null;
    clearInterval(timer);
    socket.emit('occasion:leave');
    socket.off('slots:day', applyDay);
    socket.off('participant:upsert', upsertParticipant);
    socket.off('occasion:updated', onOccasionUpdated);
    socket.off('participant:removed', onParticipantRemoved);
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
      occasion = { ...(await api.archiveOccasion(slug, archived)), canManageGuests: occasion.canManageGuests };
    } catch (e) {
      flash(e.message);
    }
  }

  function setEditing(state) {
    socket.emit('editing', state);
  }

  const range = $derived(
    occasion && (occasion.startDate === occasion.endDate ? fmtMedium(occasion.startDate) : `${fmtShort(occasion.startDate)} → ${fmtMedium(occasion.endDate)}`),
  );
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
  <div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
    <div class="min-w-0">
      <a href="/" onclick={link} class="text-sm text-slate-500 hover:text-indigo-600">← Mes occasions</a>
      <h1 class="mt-1 text-2xl font-bold text-slate-900">{occasion.title}</h1>
      <div class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
        <span>📅 {range}</span>
        {#if occasion.organization}
          <span>🏢 {occasion.organization.name}{occasion.allMembers ? ' · tous les membres invités' : ''}</span>
        {/if}
        {#if occasion.editDeadline}
          <span>✏️ Édition jusqu'au {fmtDateTime(occasion.editDeadline)}</span>
        {/if}
      </div>
      {#if occasion.description}<p class="mt-3 max-w-3xl whitespace-pre-line text-slate-600">{occasion.description}</p>{/if}
    </div>
    <div class="flex w-full flex-col gap-2 lg:w-96">
      {#if !occasion.archived}
        <span class="text-xs font-medium uppercase tracking-wide text-slate-500">Lien de partage</span>
        <CopyLink {slug} />
      {/if}
      {#if occasion.isCreator}
        <div class="flex justify-end gap-2">
          {#if !occasion.archived}
            <button class="btn-outline" onclick={() => setArchived(true)}>🗄️ Archiver</button>
            <button class="btn-outline" onclick={() => (settingsOpen = true)}>⚙️ Paramètres</button>
          {:else if occasion.archivedManually}
            <button class="btn-outline" onclick={() => setArchived(false)}>↩️ Désarchiver</button>
          {/if}
        </div>
      {/if}
    </div>
  </div>

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
        class="-mb-px border-b-2 px-4 py-2 text-sm font-medium transition {tab === t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}"
        onclick={() => (tab = t.id)}
      >{t.label}</button>
    {/each}
  </div>

  <div class="grid gap-6 lg:grid-cols-[1fr_18rem]">
    {#if tab === 'report'}
      <Report
        {occasion}
        {participants}
        {slots}
        onopenday={async (day) => {
          tab = 'calendar';
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
      onaddguests={() => (addingGuests = true)}
    />
  </div>
{/if}

{#if notice}
  <div class="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg">{notice}</div>
{/if}

{#if addingGuests}
  <AddGuests {occasion} onclose={() => (addingGuests = false)} onadded={(list) => (participants = list)} />
{/if}

{#if settingsOpen}
  <OccasionSettings {occasion} onclose={() => (settingsOpen = false)} onsaved={(o) => { occasion = { ...o, canManageGuests: occasion.canManageGuests }; settingsOpen = false; }} />
{/if}
