<script>
  import { link } from '../lib/router.svelte.js';
  import { session } from '../lib/session.svelte.js';
  import { REPO_URL } from '../lib/project.js';
  import { t, th } from '../lib/i18n.svelte.js';

  const contact = $derived(session.me?.legal ?? {});
</script>

<article class="legal">
  <a href="/" onclick={link} class="text-link text-sm font-medium">← {t('common.myOccasions')}</a>
  <h1>{t('Terms.title')}</h1>
  <p class="updated">{t('Terms.updated')}</p>

  <p>{@html th('Terms.intro')}</p>

  <h2>{t('Terms.service.title')}</h2>
  <p>
    {@html th('Terms.service.text')}
    <a href="/confidentialite" onclick={link} class="text-link">{t('Terms.privacyLink')}</a>).
  </p>

  <h2>{t('Terms.access.title')}</h2>
  <ul>
    <li>{t('Terms.access.anyone')}</li>
    <li>{t('Terms.access.managers')}</li>
    <li>{t('Terms.access.qr')}</li>
  </ul>

  <h2>{t('Terms.content.title')}</h2>
  <p>{t('Terms.content.intro')}</p>
  <ul>
    <li>{t('Terms.content.illegal')}</li>
    <li>{t('Terms.content.sensitive')}</li>
    <li>{t('Terms.content.impersonate')}</li>
    <li>{t('Terms.content.disrupt')}</li>
  </ul>
  <p>{t('Terms.content.removal')}</p>

  <h2>{t('Terms.availability.title')}</h2>
  <p>{t('Terms.availability.text')}</p>

  <h2>{t('Terms.liability.title')}</h2>
  <p>{t('Terms.liability.text')}</p>

  <h2>{t('Terms.personal.title')}</h2>
  <p>
    {t('Terms.personal.before')}
    <a href="/confidentialite" onclick={link} class="text-link">{t('Terms.privacyLink')}</a>{t('Terms.personal.after')}
  </p>

  <h2>{t('Terms.source.title')}</h2>
  <p>
    {@html th('Terms.source.before')}
    (<a class="text-link" href="{REPO_URL}/blob/main/LICENSE" target="_blank" rel="noopener">Unlicense</a>){t('Terms.source.colon')}
    <a class="text-link" href={REPO_URL} target="_blank" rel="noopener">{REPO_URL.replace('https://', '')}</a>.
    {t('Terms.source.after')}
  </p>

  <h2>{t('Terms.changes.title')}</h2>
  <p>{t('Terms.changes.text')}</p>

  <h2>{t('Terms.law.title')}</h2>
  <p>{t('Terms.law.text')}</p>

  <h2>{t('Terms.contact.title')}</h2>
  {#if contact.contactEmail}
    <p>
      {contact.contactName ?? t('Terms.contact.operator')} —
      <a class="text-link" href="mailto:{contact.contactEmail}">{contact.contactEmail}</a>
    </p>
  {:else}
    <p class="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">{t('Terms.contact.none')}</p>
  {/if}
</article>
