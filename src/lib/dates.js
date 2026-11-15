import { TZ } from '../config.js';

const pad = (n) => String(n).padStart(2, '0');
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Today in Brisbane as YYYY-MM-DD (the family's clock, wherever the phone is). */
export function todayISO(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now);
}
const toUTC = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const daysBetween = (aISO, bISO) => Math.round((toUTC(bISO) - toUTC(aISO)) / 86400000);

function clampDay(y, m, d) {
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); // 29 Feb in a non-leap year -> 28 Feb
  return `${y}-${pad(m)}-${pad(Math.min(d, last))}`;
}

/** Next birthday for a person: { iso, days, turning } or null if no birthday saved. */
export function nextBirthday(p, today = todayISO()) {
  if (!p?.birth_month || !p?.birth_day) return null;
  const y = Number(today.slice(0, 4));
  let iso = clampDay(y, p.birth_month, p.birth_day);
  if (iso < today) iso = clampDay(y + 1, p.birth_month, p.birth_day);
  const turning = p.birth_year ? Number(iso.slice(0, 4)) - p.birth_year : null;
  return { iso, days: daysBetween(today, iso), turning };
}

export function nextChristmas(today = todayISO()) {
  const y = Number(today.slice(0, 4));
  const iso = `${y}-12-25`;
  const use = iso < today ? `${y + 1}-12-25` : iso;
  return { iso: use, days: daysBetween(today, use) };
}

export function fmtDay(iso) {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}
export function fmtBirthday(p) {
  return p?.birth_month ? `${p.birth_day} ${MONTHS[p.birth_month - 1]}` : null;
}
export function inDays(n) {
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  return `${n} days`;
}
export const firstName = (p) => (p?.full_name || '').split(' ')[0];
export const initials = (p) => (p?.full_name || '?').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
