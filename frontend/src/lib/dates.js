import { t, locale } from './i18n.svelte.js';

export const pad = (n) => String(n).padStart(2, '0');

/** "YYYY-MM-DD" -> local Date at midnight. */
export function parseDay(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Date -> "YYYY-MM-DD" (local). */
export function toDay(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const todayStr = () => toDay(new Date());

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function addMonths(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

/** Sunday of the week containing `date` (weeks run Sunday → Saturday). */
export function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return addDays(d, -d.getDay());
}

export function weekDays(date) {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Full weeks (Sun-Sat) covering the month of `date`. */
export function monthGrid(date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const start = startOfWeek(first);
  const days = [];
  for (let d = start; d <= last || days.length % 7 !== 0; d = addDays(d, 1)) days.push(d);
  return days;
}

export const minToTime = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

export const fmtLong = (s) =>
  parseDay(s).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export const fmtMedium = (s) =>
  parseDay(s).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' });

export const fmtShort = (s) => parseDay(s).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });

export const fmtMonth = (date) => date.toLocaleDateString(locale(), { month: 'long', year: 'numeric' });

export const fmtWeekday = (date, style = 'short') => date.toLocaleDateString(locale(), { weekday: style });

/** "YYYY-MM-DDTHH:MM" -> readable. */
export function fmtDateTime(s) {
  const [d, time] = s.split('T');
  return t('dates.dateTime', { date: fmtMedium(d), time: fmtTime(time) });
}

/** "14:30" → "14 h 30" (French) / "2:30 p.m." (English). */
export function fmtTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' });
}

/** Short weekday names, Sunday first: ['dim.', 'lun.', …] / ['Sun', 'Mon', …]. */
export const weekdayNames = () => Array.from({ length: 7 }, (_, i) => fmtWeekday(new Date(2023, 0, 1 + i)));

/** "3 nov. 2026" for a single day, otherwise "3 nov. → 8 nov. 2026 · 3 jours" (translated). */
export function fmtOccasionDays(o) {
  if (!o?.firstDay) return t('dates.noDay');
  const count = o.dayCount ?? o.days?.length ?? 1;
  if (count <= 1) return fmtMedium(o.firstDay);
  return t('dates.range', { from: fmtShort(o.firstDay), to: fmtMedium(o.lastDay), count });
}
