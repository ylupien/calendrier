// Generic logos: an emblem (public/logos-generiques/*.svg) with the organization's name beside it, in the
// format of the hand-made logos (emblem on the left, name in a bold serif on the right, transparent background).
// The browser composes the PNG, then it is uploaded like any logo.
import { asset } from './assets.js';

/**
 * color: the name on a light background; darkColor: on a dark background.
 * keywords: searched in both languages (the label comes from the locale files: LogoGallery.items.<id>).
 */
export const EMBLEMS = [
  {
    id: 'famille', color: '#9a3412', darkColor: '#fdba74',
    keywords: ['famille', 'maison', 'foyer', 'parents', 'enfants', 'cousins', 'family', 'home', 'house', 'kids'],
  },
  {
    id: 'amis', color: '#0f766e', darkColor: '#5eead4',
    keywords: ['amis', 'amies', 'amitié', 'social', 'discussion', 'groupe', 'friends', 'friendship', 'chat', 'group'],
  },
  {
    id: 'plein-air', color: '#166534', darkColor: '#86efac',
    keywords: ['plein air', 'nature', 'montagne', 'randonnée', 'sport', 'club', 'camping', 'ski', 'outdoor', 'mountain', 'hiking'],
  },
  {
    id: 'equipe', color: '#3730a3', darkColor: '#a5b4fc',
    keywords: ['équipe', 'travail', 'bureau', 'collègues', 'comité', 'association', 'team', 'work', 'office', 'colleagues', 'committee'],
  },
  {
    id: 'trophee', color: '#92400e', darkColor: '#fcd34d',
    keywords: ['trophée', 'sport', 'ligue', 'tournoi', 'compétition', 'championnat', 'hockey', 'soccer', 'trophy', 'league', 'tournament', 'competition'],
  },
  {
    id: 'musique', color: '#6d28d9', darkColor: '#d8b4fe',
    keywords: ['musique', 'chorale', 'chant', 'orchestre', 'groupe', 'band', 'concert', 'pratique', 'music', 'choir', 'singing', 'rehearsal'],
  },
  {
    id: 'lecture', color: '#1e40af', darkColor: '#93c5fd',
    keywords: ['lecture', 'livre', 'club de lecture', 'bibliothèque', 'étude', 'cours', 'book', 'reading', 'book club', 'library', 'study'],
  },
  {
    id: 'repas', color: '#991b1b', darkColor: '#fca5a5',
    keywords: ['repas', 'souper', 'dîner', 'déjeuner', 'brunch', 'resto', 'restaurant', 'cuisine', 'potluck', 'dinner', 'lunch', 'food'],
  },
  {
    id: 'fete', color: '#be185d', darkColor: '#f9a8d4',
    keywords: ['fête', 'anniversaire', 'party', 'célébration', 'mariage', 'noël', 'ballons', 'birthday', 'celebration', 'wedding', 'christmas'],
  },
  {
    id: 'voyage', color: '#075985', darkColor: '#7dd3fc',
    keywords: ['voyage', 'vacances', 'avion', 'chalet', 'excursion', 'sortie', 'travel', 'trip', 'vacation', 'holiday', 'plane'],
  },
  {
    id: 'jeux', color: '#9f1239', darkColor: '#fda4af',
    keywords: ['jeux', 'jeux de société', 'soirée jeux', 'dés', 'cartes', 'gaming', 'games', 'board games', 'game night', 'dice', 'cards'],
  },
  {
    id: 'cafe', color: '#78350f', darkColor: '#fbbf77',
    keywords: ['café', 'rencontre', 'pause', 'jasette', 'thé', 'coffee', 'meetup', 'break', 'tea'],
  },
  {
    id: 'velo', color: '#134e4a', darkColor: '#5eead4',
    keywords: ['vélo', 'cyclisme', 'sport', 'randonnée', 'bicyclette', 'bike', 'cycling', 'bicycle', 'ride'],
  },
  {
    id: 'ecole', color: '#1e3a8a', darkColor: '#93c5fd',
    keywords: ['école', 'classe', 'parents', 'élèves', 'étudiants', 'cégep', 'université', 'finissants', 'school', 'class', 'students', 'graduation', 'alumni'],
  },
];

/**
 * Fonts of the name (public/fonts, SIL Open Font License). size: relative size, so that the name has about the
 * same visual weight in every font. Label: LogoGallery.fonts.<id>.
 */
export const FONTS = [
  { id: 'dm-serif', family: 'DM Serif Display', file: 'dm-serif-display-400.woff2', weight: 400, size: 1 },
  { id: 'playfair', family: 'Playfair Display', file: 'playfair-display-700.woff2', weight: 700, size: 0.95 },
  { id: 'montserrat', family: 'Montserrat', file: 'montserrat-800.woff2', weight: 800, size: 0.82 },
  { id: 'fredoka', family: 'Fredoka', file: 'fredoka-600.woff2', weight: 600, size: 0.95 },
  { id: 'pacifico', family: 'Pacifico', file: 'pacifico-400.woff2', weight: 400, size: 0.85 },
];
export const DEFAULT_FONT = FONTS[0];
export const fontById = (id) => FONTS.find((f) => f.id === id) ?? DEFAULT_FONT;
export const emblemById = (id) => EMBLEMS.find((e) => e.id === id) ?? null;

export const emblemUrl = (id) => asset(`/logos-generiques/${id}.svg`);

// Family names of their own, so that they never mix with fonts installed on the computer.
const familyOf = (font) => `Disponibilites ${font.id}`;
const fontsReady = new Map();

/** Loads a font of the logos once (falls back to the browser's serif if it cannot). */
export function loadFont(font) {
  if (!fontsReady.has(font.id)) {
    fontsReady.set(
      font.id,
      new FontFace(familyOf(font), `url(/fonts/${font.file})`, { weight: String(font.weight) })
        .load()
        .then((face) => document.fonts.add(face))
        .catch(() => null),
    );
  }
  return fontsReady.get(font.id);
}

/** CSS font-family of a font (for the font picker's samples, once loadFont() is done). */
export const cssFamily = (font) => `"${familyOf(font)}", Georgia, serif`;

const images = new Map();
function loadImage(url) {
  if (!images.has(url)) {
    images.set(
      url,
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      }),
    );
  }
  return images.get(url);
}

// Same proportions as the hand-made logos (1475 × 587).
const HEIGHT = 587;
const EMBLEM = 500;
const PAD = 44;
const TEXT_X = PAD + EMBLEM + 40;
const MAX_TEXT = 900;

/** The name on one line, or on two lines balanced at a space ("Se faire des amies / au Québec"). */
function layout(ctx, name, face) {
  const font = (size) => `${face.weight} ${size}px ${cssFamily(face)}`;
  const words = name.split(/\s+/).filter(Boolean);
  const candidates = [[name]];
  for (let i = 1; i < words.length; i++) candidates.push([words.slice(0, i).join(' '), words.slice(i).join(' ')]);
  let best = null;
  for (const lines of candidates) {
    // Largest size (≤ 230 px, ≤ 2 lines in the height) at which the widest line fits.
    const maxSize = Math.round((lines.length === 1 ? 230 : 200) * face.size);
    ctx.font = font(100);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const size = Math.min(maxSize, Math.floor((MAX_TEXT / widest) * 100));
    if (!best || size > best.size * 1.15) best = { lines, size };
  }
  best.size = Math.max(best.size, 60);
  ctx.font = font(best.size);
  best.width = Math.max(...best.lines.map((l) => ctx.measureText(l).width));
  best.font = font(best.size);
  return best;
}

/**
 * Canvas of the logo: the emblem and the organization's name.
 * font: one of FONTS; dark: made for a dark background (lighter name).
 */
export async function composeLogo(emblem, name, { font = DEFAULT_FONT, dark = false } = {}) {
  await loadFont(font);
  const img = await loadImage(emblemUrl(emblem.id));
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const text = layout(ctx, name.trim() || '…', font);
  canvas.width = Math.ceil(TEXT_X + text.width + PAD);
  canvas.height = HEIGHT;
  ctx.drawImage(img, PAD, (HEIGHT - EMBLEM) / 2, EMBLEM, EMBLEM);
  ctx.font = text.font;
  ctx.fillStyle = dark ? emblem.darkColor : emblem.color;
  ctx.textBaseline = 'alphabetic';
  const lineHeight = text.size * 1.08;
  const block = lineHeight * text.lines.length;
  // Baselines centred on the emblem (cap height ≈ 0.7 of the size).
  let y = (HEIGHT - block) / 2 + text.size * 0.82;
  for (const line of text.lines) {
    ctx.fillText(line, TEXT_X, y);
    y += lineHeight;
  }
  return canvas;
}

/** The logo as a PNG file, ready to upload. */
export async function logoFile(emblem, name, options) {
  const canvas = await composeLogo(emblem, name, options);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  return new File([blob], `logo-${emblem.id}.png`, { type: 'image/png' });
}
