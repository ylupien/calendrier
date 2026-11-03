// Translations (i18next): French (default) and English.
//
// Texts live in src/locales/<lang>/<Name>.json, one file per component or page (plus common.json);
// each file is the namespace of its keys: t('GuestList.title'), t('common.cancel').
// The chosen language is remembered per browser and sent to the server (error messages, emails).
import i18next from 'i18next';

export const LANGS = ['fr', 'en'];
const FALLBACK = 'fr';
const KEY = 'lang';

// { fr: { translation: { common: {...}, GuestList: {...} } }, en: {...} }
const files = import.meta.glob('../locales/*/*.json', { eager: true, import: 'default' });
const resources = {};
for (const [path, content] of Object.entries(files)) {
  const [, lang, name] = path.match(/locales\/([^/]+)\/([^/]+)\.json$/);
  ((resources[lang] ??= { translation: {} }).translation)[name] = content;
}

function detect() {
  try {
    const saved = localStorage.getItem(KEY);
    if (LANGS.includes(saved)) return saved;
  } catch {
    // storage unavailable
  }
  for (const l of navigator.languages ?? [navigator.language]) {
    const base = String(l).slice(0, 2).toLowerCase();
    if (LANGS.includes(base)) return base;
  }
  return FALLBACK;
}

i18next.init({
  resources,
  lng: detect(),
  fallbackLng: FALLBACK,
  supportedLngs: LANGS,
  // Svelte escapes what it displays; th() below escapes the values of HTML translations.
  interpolation: { escapeValue: false },
  returnNull: false,
  initAsync: false,
  showSupportNotice: false, // no promotional message in the console
});

/** Current language; reading it (through t) makes a template update when the language changes. */
export const i18n = $state({ lang: i18next.language });
document.documentElement.lang = i18n.lang;

/** Translated text: t('GuestList.title'), t('GuestList.days', { count: 3 }). */
export function t(key, options) {
  i18n.lang; // dependency for Svelte
  return i18next.t(key, options);
}

/**
 * Translation containing HTML (e.g. "Bonjour <strong>{{name}}</strong>"), for {@html th(...)}:
 * the interpolated values are escaped. Only for texts written in the locale files, never for user data.
 */
export function th(key, options) {
  i18n.lang;
  return i18next.t(key, { ...options, interpolation: { escapeValue: true } });
}

/** BCP 47 locale for dates and numbers (Intl). */
export const locale = () => (i18n.lang === 'en' ? 'en-CA' : 'fr-CA');

export function setLang(lang) {
  if (!LANGS.includes(lang)) return;
  i18next.changeLanguage(lang);
  i18n.lang = lang;
  document.documentElement.lang = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // the choice lasts until the page is reloaded
  }
}

export const otherLang = () => (i18n.lang === 'fr' ? 'en' : 'fr');
