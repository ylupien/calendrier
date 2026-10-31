// Color theme: 'system' (follows the device), 'light' or 'dark'. Remembered per browser.
// index.html applies it before the first paint to avoid a flash; this module keeps it up to date.
const KEY = 'theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

function read() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export const theme = $state({ mode: read() });

function apply() {
  const dark = theme.mode === 'dark' || (theme.mode === 'system' && media.matches);
  document.documentElement.classList.toggle('dark', dark);
}

media.addEventListener('change', apply);
apply();

const ORDER = ['system', 'light', 'dark'];
export const THEME_LABELS = { system: 'Thème du système', light: 'Thème clair', dark: 'Thème sombre' };
export const THEME_ICONS = { system: '🖥️', light: '☀️', dark: '🌙' };

/** Cycles system → light → dark. */
export function nextTheme() {
  theme.mode = ORDER[(ORDER.indexOf(theme.mode) + 1) % ORDER.length];
  try {
    if (theme.mode === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme.mode);
  } catch {
    // storage unavailable: the choice lasts until the page is reloaded
  }
  apply();
}
