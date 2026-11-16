import { addDays, isWeekday } from './dates.js';

/**
 * Calcolo della domenica di Pasqua (calendario gregoriano) con algoritmo di Meeus/Jones/Butcher.
 * Restituisce una data a mezzanotte UTC.
 */
export function getEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = marzo, 4 = aprile
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const pad = (n) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

const holidaysCache = new Map();

/**
 * Restituisce una mappa (day -> nome della festività) per le 15 festività ufficiali del Cantone Ticino.
 */
export function getTicinoHolidays(year) {
  if (holidaysCache.has(year)) return holidaysCache.get(year);

  const easterDay = getEasterSunday(year);

  // Festività fisse
  const holidays = {
    [`${year}-01-01`]: 'Capodanno',
    [`${year}-01-06`]: 'Epifania',
    [`${year}-03-19`]: 'San Giuseppe',
    [`${year}-05-01`]: 'Festa del Lavoro',
    [`${year}-06-29`]: 'Santi Pietro e Paolo',
    [`${year}-08-01`]: 'Festa Nazionale Svizzera',
    [`${year}-08-15`]: 'Assunzione',
    [`${year}-11-01`]: 'Ognissanti',
    [`${year}-12-08`]: 'Immacolata Concezione',
    [`${year}-12-25`]: 'Natale',
    [`${year}-12-26`]: 'Santo Stefano',
  };

  // Festività mobili basate sulla Pasqua
  holidays[addDays(easterDay, 1)] = 'Lunedì di Pasqua';
  holidays[addDays(easterDay, 39)] = 'Ascensione';
  holidays[addDays(easterDay, 50)] = 'Lunedì di Pentecoste';
  holidays[addDays(easterDay, 60)] = 'Corpus Domini';

  holidaysCache.set(year, holidays);
  return holidays;
}

/** Verifica se una data ('yyyy-MM-dd') è un giorno festivo ufficiale nel Cantone Ticino. */
export function isTicinoHoliday(day) {
  if (!day) return false;
  const year = Number(day.slice(0, 4));
  const holidays = getTicinoHolidays(year);
  return Boolean(holidays[day]);
}

/**
 * Un giorno è lavorativo se non è sabato né domenica e non è festivo nel Cantone Ticino.
 */
export function isWorkingDay(day) {
  return isWeekday(day) && !isTicinoHoliday(day);
}

/**
 * Restituisce i limiti del trimestre che contiene `day`:
 *  - start ('yyyy-MM-dd')
 *  - end ('yyyy-MM-dd')
 *  - quarter (1..4)
 *  - year (es. 2026)
 */
export function getQuarterBounds(day) {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  const quarter = Math.floor((month - 1) / 3) + 1;

  switch (quarter) {
    case 1:
      return { start: `${year}-01-01`, end: `${year}-03-31`, startDay: `${year}-01-01`, endDay: `${year}-03-31`, quarter: 1, year };
    case 2:
      return { start: `${year}-04-01`, end: `${year}-06-30`, startDay: `${year}-04-01`, endDay: `${year}-06-30`, quarter: 2, year };
    case 3:
      return { start: `${year}-07-01`, end: `${year}-09-30`, startDay: `${year}-07-01`, endDay: `${year}-09-30`, quarter: 3, year };
    case 4:
    default:
      return { start: `${year}-10-01`, end: `${year}-12-31`, startDay: `${year}-10-01`, endDay: `${year}-12-31`, quarter: 4, year };
  }
}

/**
 * Conta il numero di giorni lavorativi compresi tra startDay ed endDay inclusi.
 */
export function countWorkingDays(startDay, endDay) {
  if (!startDay || !endDay || startDay > endDay) return 0;
  let count = 0;
  let current = startDay;
  while (current <= endDay) {
    if (isWorkingDay(current)) count++;
    current = addDays(current, 1);
  }
  return count;
}

/**
 * Restituisce gli ultimi `count` giorni lavorativi strettamente precedenti a `targetDay`.
 */
export function getPreviousWorkingDays(targetDay, count) {
  const result = [];
  let current = addDays(targetDay, -1);
  while (result.length < count) {
    if (isWorkingDay(current)) {
      result.push(current);
    }
    current = addDays(current, -1);
  }
  return result;
}
