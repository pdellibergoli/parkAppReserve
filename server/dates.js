import { CONFIG } from './config.js';
import { AppError } from './errors.js';

// Internamente un giorno è sempre una stringa 'yyyy-MM-dd': è il formato delle colonne DATE
// (vedi db.js), si confronta con < e > e non dipende dal fuso del server.

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CONFIG.TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CONFIG.TIME_ZONE, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric', second: 'numeric',
});

const zonedParts = (instant) => Object.fromEntries(
  partsFormatter.formatToParts(instant).map(({ type, value }) => [type, Number(value)])
);

const pad = (n) => String(n).padStart(2, '0');

const dayToUtc = (day) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

const utcToDay = (utc) => `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;

/** Accetta 'yyyy-MM-dd' o un istante ISO/Date (interpretato nel fuso di business). */
export function toDay(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    if (utcToDay(dayToUtc(value)) !== value) throw new AppError('Data non valida.');
    return value;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new AppError('Data non valida.');
  return dayFormatter.format(date);
}

export const today = () => dayFormatter.format(new Date());

export const currentHour = () => zonedParts(new Date()).hour;

export function addDays(day, amount) {
  const utc = dayToUtc(day);
  utc.setUTCDate(utc.getUTCDate() + amount);
  return utcToDay(utc);
}

export function isWeekday(day) {
  const dayOfWeek = dayToUtc(day).getUTCDay();
  return dayOfWeek !== 0 && dayOfWeek !== 6;
}

export function formatDay(day) {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}

/** Primo e ultimo giorno del mese che contiene `day`. */
export function monthBounds(day) {
  const [y, m] = day.split('-').map(Number);
  return { start: utcToDay(new Date(Date.UTC(y, m - 1, 1))), end: utcToDay(new Date(Date.UTC(y, m, 0))) };
}

/**
 * Mezzanotte di quel giorno nel fuso di business, come istante ISO.
 * È il formato con cui il frontend ha sempre ricevuto le date: `new Date(valore)` nel
 * browser restituisce l'inizio del giorno, e i confronti con startOfToday() restano esatti.
 */
export function dayToIso(day) {
  if (!day) return '';
  const guess = dayToUtc(day);
  const p = zonedParts(guess);
  const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - guess.getTime();
  return new Date(guess.getTime() - offset).toISOString();
}

/** Giorno di inizio della finestra di priorità: N giorni lavorativi fa. */
export function windowStartDay() {
  let day = today();
  let businessDays = 0;
  while (businessDays < CONFIG.LOOK_BACK_DAYS) {
    day = addDays(day, -1);
    if (isWeekday(day)) businessDays++;
  }
  return day;
}
