<script>
  import { link } from '../lib/router.svelte.js';
  import { session } from '../lib/session.svelte.js';
  import { t, th } from '../lib/i18n.svelte.js';

  const contact = $derived(session.me?.legal ?? {});
  // Rows of the cookies and storage table: name → translated type, use, duration.
  const STORAGE = [
    { name: 'rc_uid', key: 'cookie' },
    { name: 'theme', key: 'theme' },
    { name: 'lang', key: 'lang' },
    { name: 'occasions.orgFilter', key: 'orgFilter' },
  ];
</script>

{#snippet contactBlock()}
  {#if contact.contactEmail}
    <p>
      <strong>{contact.contactName ?? t('Privacy.officer')}</strong><br />
      {t('Privacy.officer')}<br />
      <a class="text-link" href="mailto:{contact.contactEmail}">{contact.contactEmail}</a>
    </p>
  {:else}
    <p class="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
      {t('Privacy.noContact')}
    </p>
  {/if}
{/snippet}

<article class="legal">
  <a href="/" onclick={link} class="text-link text-sm font-medium">← {t('common.myOccasions')}</a>
  <h1>{t('Privacy.title')}</h1>
  <p class="updated">{t('Privacy.updated')}</p>

  <p>{@html th('Privacy.intro')}</p>

  <h2>{t('Privacy.summary.title')}</h2>
  <ul>
    <li>{@html th('Privacy.summary.cookie')}</li>
    <li>{@html th('Privacy.summary.noTracking')}</li>
    <li>{t('Privacy.summary.noSale')}</li>
    <li>{t('Privacy.summary.noAccount')}</li>
  </ul>

  <h2>{t('Privacy.storage.title')}</h2>
  <div class="table-wrap">
    <table>
      <thead><tr><th>{t('Privacy.storage.name')}</th><th>{t('Privacy.storage.type')}</th><th>{t('Privacy.storage.use')}</th><th>{t('Privacy.storage.duration')}</th></tr></thead>
      <tbody>
        {#each STORAGE as row (row.name)}
          <tr>
            <td data-label={t('Privacy.storage.name')}><code>{row.name}</code></td>
            <td data-label={t('Privacy.storage.type')}>{t(`Privacy.storage.rows.${row.key}.type`)}</td>
            <td data-label={t('Privacy.storage.use')}>{t(`Privacy.storage.rows.${row.key}.use`)}</td>
            <td data-label={t('Privacy.storage.duration')}>{t(`Privacy.storage.rows.${row.key}.duration`)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <p>{t('Privacy.storage.noBanner')}</p>

  <h2>{t('Privacy.collected.title')}</h2>
  <ul>
    <li>{@html th('Privacy.collected.identity')}</li>
    <li>{@html th('Privacy.collected.slots')}</li>
    <li>{t('Privacy.collected.created')}</li>
    <li>{t('Privacy.collected.technical')}</li>
  </ul>

  <h2>{t('Privacy.why.title')}</h2>
  <p>{t('Privacy.why.text')}</p>

  <h2>{t('Privacy.who.title')}</h2>
  <ul>
    <li>{@html th('Privacy.who.participants')}</li>
    <li>{@html th('Privacy.who.organizations')}</li>
    <li>{@html th('Privacy.who.operator')}</li>
  </ul>

  <h2>{t('Privacy.hosting.title')}</h2>
  <p>{@html th('Privacy.hosting.text')}</p>

  <h2>{t('Privacy.retention.title')}</h2>
  <p>{t('Privacy.retention.text')}</p>

  <h2>{t('Privacy.security.title')}</h2>
  <p>{@html th('Privacy.security.text')}</p>

  <h2>{t('Privacy.rights.title')}</h2>
  <p>{t('Privacy.rights.intro')}</p>
  <ul>
    <li>{@html th('Privacy.rights.correct')}</li>
    <li>{@html th('Privacy.rights.access')}</li>
    <li>{@html th('Privacy.rights.delete')}</li>
    <li>{t('Privacy.rights.complaintBefore')}
      <a class="text-link" href="https://www.cai.gouv.qc.ca" target="_blank" rel="noopener">{t('Privacy.rights.complaintLink')}</a>{t('Privacy.rights.complaintAfter')}</li>
  </ul>
  <p>{t('Privacy.rights.write')}</p>
  {@render contactBlock()}

  <h2>{t('Privacy.changes.title')}</h2>
  <p>{t('Privacy.changes.text')}</p>

  <p class="note">
    {t('Privacy.seeAlsoBefore')} <a href="/conditions" onclick={link} class="text-link">{t('Privacy.seeAlsoLink')}</a>{t('Privacy.seeAlsoAfter')}
  </p>
</article>
