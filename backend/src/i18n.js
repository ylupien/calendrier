// Translations of what the server sends to people (error messages, emails): French (default) and English.
// Texts: locales/fr.json and locales/en.json (same keys).
import fs from 'node:fs';
import i18next from 'i18next';

export const LANGS = ['fr', 'en'];
const FALLBACK = 'fr';

const load = (lang) => JSON.parse(fs.readFileSync(new URL(`./locales/${lang}.json`, import.meta.url), 'utf8'));

const i18n = i18next.createInstance();
i18n.init({
  resources: Object.fromEntries(LANGS.map((l) => [l, { translation: load(l) }])),
  lng: FALLBACK,
  fallbackLng: FALLBACK,
  supportedLngs: LANGS,
  // JSON answers are not HTML; emails escape what they put in their HTML (see mail.js).
  interpolation: { escapeValue: false },
  initAsync: false,
  showSupportNotice: false, // no promotional message in the logs
});

/** Translation function for a language: tFor('en')('errors.notFound'). */
export const tFor = (lang) => i18n.getFixedT(LANGS.includes(lang) ? lang : FALLBACK);

/**
 * Language chosen in the application: the frontend sends exactly "fr" or "en" in Accept-Language.
 * null for an ordinary browser header ("fr-CA,fr;q=0.9,en;q=0.8").
 */
export function explicitLang(req) {
  const h = String(req.get('accept-language') ?? '').trim().toLowerCase();
  return LANGS.includes(h) ? h : null;
}

/** "fr" or "en": the chosen language, otherwise the first supported one of the browser, otherwise French. */
export function requestLang(req) {
  const explicit = explicitLang(req);
  if (explicit) return explicit;
  for (const part of String(req.get('accept-language') ?? '').split(',')) {
    const base = part.split(';')[0].trim().slice(0, 2).toLowerCase();
    if (LANGS.includes(base)) return base;
  }
  return FALLBACK;
}

/** Express middleware: req.lang and req.t (translation in the request's language). */
export function language(req, _res, next) {
  req.lang = requestLang(req);
  req.t = tFor(req.lang);
  next();
}
