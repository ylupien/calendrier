// How a logo is shown, by its background setting:
// 'theme' follows the application's mode (gallery logos then have an image for each mode),
// 'light' is always on white, 'dark' always on the dark blue.
import { shown } from './theme.svelte.js';

export const BACKGROUNDS = ['theme', 'light', 'dark'];
const PLATE = { light: 'bg-white', dark: 'bg-[#0f172a]' };

/** { src, plateClass } of a logo: { url, darkUrl?, background }. plateClass is '' when it follows the theme. */
export function logoView({ url, darkUrl = null, background = 'theme' }) {
  return {
    src: background === 'theme' && shown.dark && darkUrl ? darkUrl : url,
    plateClass: PLATE[background] ?? '',
  };
}

/** Text of the gallery logo is pale on a dark background: is the background dark for this setting? */
export const darkFor = (background) => background === 'dark' || (background === 'theme' && shown.dark);
