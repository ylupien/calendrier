<script>
  import { t } from '../lib/i18n.svelte.js';
  let { slug, compact = false } = $props();
  let copied = $state(false);
  const url = $derived(`${location.origin}/o/${slug}`);

  async function copy(e) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API needs HTTPS (or localhost); fall back to a prompt.
      window.prompt(t('CopyLink.prompt'), url);
    }
    copied = true;
    setTimeout(() => (copied = false), 1800);
  }
</script>

{#if compact}
  <button class="btn-ghost px-2 py-1 text-xs" onclick={copy} title={url}>
    {copied ? `✓ ${t('CopyLink.copied')}` : `🔗 ${t('CopyLink.copyLink')}`}
  </button>
{:else}
  <div class="flex items-center gap-2">
    <input class="input min-w-0 flex-1 bg-slate-50 text-slate-600" readonly value={url} onfocus={(e) => e.currentTarget.select()} />
    <button class="btn-primary shrink-0" onclick={copy}>{copied ? `✓ ${t('CopyLink.copied')}` : t('CopyLink.copy')}</button>
  </div>
{/if}
