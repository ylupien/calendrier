<script>
  import { onMount } from 'svelte';
  import { EMBLEMS, FONTS, fontById, emblemById, composeLogo, logoFile, loadFont, cssFamily } from '../lib/logoGallery.js';
  import { t } from '../lib/i18n.svelte.js';
  import { darkFor } from '../lib/logoDisplay.svelte.js';
  import Modal from './Modal.svelte';
  import BackgroundPicker from './BackgroundPicker.svelte';

  // Makes a gallery logo: a generic symbol with an editable text, in a chosen font, on a background that follows
  // the theme or is always light / dark. oncreate({ file, darkFile, emblem, font, caption, background }) saves it.
  // initial: a logo to edit (its choices fill the form), otherwise a new one.
  let { initial = null, defaultCaption = '', busy = false, oncreate, onclose } = $props();

  // svelte-ignore state_referenced_locally
  let caption = $state(initial?.caption ?? defaultCaption);
  // svelte-ignore state_referenced_locally
  let font = $state(fontById(initial?.font));
  // svelte-ignore state_referenced_locally
  let background = $state(initial?.background ?? 'theme');
  let query = $state('');
  // svelte-ignore state_referenced_locally
  let chosen = $state(emblemById(initial?.emblem));
  let previews = $state({}); // emblem id → data URL with the current text, font and background
  let fontsLoaded = $state(false);
  // The previews are made like the logo will be seen now (with 'theme': in the application's current mode).
  const dark = $derived(darkFor(background));

  onMount(async () => {
    await Promise.all(FONTS.map(loadFont));
    fontsLoaded = true;
  });

  const normalize = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const results = $derived.by(() => {
    const q = normalize(query.trim());
    if (!q) return EMBLEMS;
    return EMBLEMS.filter((e) =>
      [t(`LogoGallery.items.${e.id}`), ...e.keywords].some((k) => normalize(k).includes(q)),
    );
  });

  // Previews follow the text (a short pause while typing), the font and the background.
  $effect(() => {
    const options = { font, dark };
    const text = caption;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const list = await Promise.all(
        EMBLEMS.map(async (e) => [e.id, (await composeLogo(e, text, options)).toDataURL('image/png')]),
      );
      if (!cancelled) previews = Object.fromEntries(list);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  });

  async function create() {
    if (!chosen || !caption.trim()) return;
    const text = caption.trim();
    // 'dark': pale text; 'light': dark text; 'theme': both images, the one for a dark background apart.
    const file = await logoFile(chosen, text, { font, dark: background === 'dark' });
    const darkFile = background === 'theme' ? await logoFile(chosen, text, { font, dark: true }) : null;
    oncreate({ file, darkFile, emblem: chosen.id, font: font.id, caption: text, background });
  }

  // Previews on the background of the setting: white, dark blue, or the page's own colour ('theme').
  const PLATES = { light: 'bg-white border-[#e2e8f0]', dark: 'bg-[#0f172a] border-transparent', theme: 'bg-surface border-slate-200' };
</script>

<Modal {onclose} size="max-w-2xl" topOnPhone>
  <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
    <h2 class="text-lg font-semibold text-slate-900">🎨 {initial ? t('LogoGallery.editTitle') : t('LogoGallery.createTitle')}</h2>
    <button class="btn-ghost px-2 text-lg leading-none" onclick={onclose} aria-label={t('common.close')}>×</button>
  </div>

  <div class="space-y-4 p-6 sm:flex-1 sm:overflow-visible max-sm:flex-1 max-sm:overflow-y-auto">
    <div>
      <label class="label" for="lc-caption">{t('LogoGallery.caption')}</label>
      <!-- svelte-ignore a11y_autofocus -->
      <input id="lc-caption" class="input" bind:value={caption} maxlength="150" autofocus />
      <p class="mt-1 text-xs text-slate-400">{t('LogoGallery.captionHint')}</p>
    </div>

    <BackgroundPicker value={background} onchange={(b) => (background = b)} />

    <div>
      <span class="label">{t('LogoGallery.font')}</span>
      <div class="flex flex-wrap gap-2" role="radiogroup" aria-label={t('LogoGallery.font')}>
        {#each FONTS as f (f.id)}
          <button
            type="button"
            role="radio"
            aria-checked={font.id === f.id}
            title={t(`LogoGallery.fonts.${f.id}`)}
            class="rounded-lg border px-3 py-1.5 text-lg leading-tight transition
              {font.id === f.id ? 'border-indigo-500 bg-indigo-50 text-indigo-800 ring-2 ring-indigo-200' : 'border-slate-200 text-slate-700 hover:border-slate-300'}"
            style={fontsLoaded ? `font-family:${cssFamily(f)};font-weight:${f.weight}` : ''}
            onclick={() => (font = f)}
          >{t(`LogoGallery.fonts.${f.id}`)}</button>
        {/each}
      </div>
    </div>

    <div>
      <span class="label">{t('LogoGallery.symbol')}</span>
      <input
        type="search"
        class="input"
        bind:value={query}
        placeholder={t('LogoGallery.search')}
        aria-label={t('LogoGallery.search')}
      />
      <p class="mt-1 text-xs text-slate-400">{t('LogoGallery.count', { count: results.length })}</p>
    </div>

    {#if results.length}
      <ul class="grid gap-2 sm:grid-cols-2">
        {#each results as e (e.id)}
          <li>
            <button
              type="button"
              class="flex w-full flex-col items-center gap-1.5 rounded-xl border p-3 transition {PLATES[background]}
                {chosen?.id === e.id ? '!border-indigo-500 ring-2 ring-indigo-300' : 'hover:!border-slate-300'}"
              aria-pressed={chosen?.id === e.id}
              onclick={() => (chosen = e)}
            >
              <span class="flex h-14 w-full items-center justify-center">
                {#if previews[e.id]}
                  <img src={previews[e.id]} alt="" class="h-full w-auto max-w-full object-contain" />
                {/if}
              </span>
              <span class="text-xs font-medium {background === 'theme' ? 'text-slate-600' : dark ? 'text-[#cbd5e1]' : 'text-[#475569]'}">{t(`LogoGallery.items.${e.id}`)}</span>
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="py-3 text-center text-sm text-slate-500">{t('LogoGallery.none')}</p>
    {/if}
  </div>

  <div class="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-surface px-6 py-4">
    <button type="button" class="btn-ghost" onclick={onclose}>{t('common.cancel')}</button>
    <button type="button" class="btn-primary" disabled={!chosen || !caption.trim() || busy} onclick={create}>
      {busy ? t('LogoGallery.applying') : initial ? t('common.save') : t('LogoGallery.create')}
    </button>
  </div>
</Modal>
