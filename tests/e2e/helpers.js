import './fake-clock.js';
import { expect, test as base } from '@playwright/test';
import pg from 'pg';
import { DEMO_PASSWORD, nextWeekday, seedDemoData } from '../../scripts/lib/seed.js';
import { addDays, today } from '../../server/dates.js';

export { expect, nextWeekday, DEMO_PASSWORD };

export const ADMIN = 'admin@parkapp.local';
export const USER = 'mario@parkapp.local';
const MAILPIT = 'http://localhost:8025';

export const NEXT_DAY = nextWeekday(today());
export const DAY_AFTER = nextWeekday(NEXT_DAY);

// 'yyyy-MM-dd' -> 'dd/MM/yyyy', il formato mostrato nell'interfaccia
export const shown = (day) => day.split('-').reverse().join('/');

let pool;

async function resetData() {
  pool ??= new pg.Pool({ connectionString: process.env.E2E_DATABASE_URL });
  await pool.query(`TRUNCATE users, parking_spaces, parking_requests, assignment_history,
    temporary_availability, temporary_unavailability, communications RESTART IDENTITY CASCADE`);
  await seedDemoData(pool);
}

// Come fake-clock.js, ma nel browser: sposta solo la data, i timer della pagina restano veri
function shiftBrowserClock(now) {
  const RealDate = Date;
  const offset = new RealDate(now).getTime() - RealDate.now();
  globalThis.Date = class extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(RealDate.now() + offset);
      else super(...args);
    }

    static now() {
      return RealDate.now() + offset;
    }
  };
}

export const test = base.extend({
  // Ogni test parte dagli stessi dati e fallisce se il browser segnala errori inattesi
  guard: [async ({ page }, use) => {
    await resetData();
    if (process.env.E2E_NOW) await page.addInitScript(shiftBrowserClock, process.env.E2E_NOW);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      // I 400 sono errori di dominio previsti dall'API: li controllano i singoli test
      if (message.type() === 'error' && !/status of 400/.test(message.text())) errors.push(message.text());
    });
    page.on('dialog', (dialog) => dialog.accept());
    await use();
    expect(errors, 'errori nel browser').toEqual([]);
  }, { auto: true }],
});

/** Porta l'orologio del server a un'ora di Roma in un dato giorno, valido con ora legale e solare. */
export async function setServerTime(request, day, hour, minute = 30) {
  const pad = (n) => String(n).padStart(2, '0');
  const now = [hour - 2, hour - 1]
    .map((utcHour) => new Date(`${day}T${pad(utcHour)}:${pad(minute)}:00Z`))
    .find((instant) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: 'numeric' }).format(instant)) === hour);
  await request.get('/__test/clock', { params: { now: now.toISOString() } });
}

export const resetServerTime = (request) => request.get('/__test/clock');

/** Chiamata all'API come farebbe un altro utente, da fuori dalla pagina. */
export async function rpc(request, action, payload = {}) {
  const response = await request.post('/api/rpc', { data: { action, payload } });
  const body = await response.json();
  if (body.status !== 'success') throw new Error(`${action}: ${body.message}`);
  return body.data;
}

export async function login(page, mail, password = DEMO_PASSWORD) {
  await page.goto('/login');
  await page.fill('input[type=email]', mail);
  await page.fill('input[type=password]', password);
  await page.click('button[type=submit]');
  await expect(page.locator('.main-header')).toBeVisible();
}

export const goTo = (page, label) => page.locator('.main-nav a', { hasText: label }).click();

const dayToUtc = (day) => new Date(`${day}T00:00:00Z`);

/** Porta il calendario sul mese del giorno indicato e ne restituisce la cella. */
export async function calendarCell(page, day) {
  const target = dayToUtc(day);
  const now = dayToUtc(today());
  const monthsAhead = (target.getUTCFullYear() - now.getUTCFullYear()) * 12 + target.getUTCMonth() - now.getUTCMonth();
  for (let i = 0; i < monthsAhead; i++) await page.getByRole('button', { name: 'Succ' }).click();

  const firstOfMonth = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), 1));
  const leadingDays = (firstOfMonth.getUTCDay() + 6) % 7; // la settimana inizia di lunedì
  const index = leadingDays + target.getUTCDate() - 1;
  return page.locator('.rbc-day-bg').nth(index);
}

export async function openDay(page, day) {
  const cell = await calendarCell(page, day);
  await cell.locator('.booking-count-badge').click({ force: true });
  await expect(page.getByRole('heading', { name: `Richieste del ${shown(day)}` })).toBeVisible();
  return page.locator('.modal-content');
}

/** Seleziona un giorno nel selettore delle modali, cambiando mese se serve. */
export async function pickDay(page, day) {
  // La modale si carica su richiesta: prima di cercare il giorno il selettore deve esserci
  await page.locator('.rdp-month').first().waitFor();
  const cell = page.locator(`[data-day="${day}"]:not([data-outside="true"])`);
  if ((await cell.count()) === 0) await page.locator('.rdp-button_next').click();
  await cell.locator('button').click();
}

/** Simula il tempo passato su un'altra scheda: i dati in cache sono scaduti e l'utente torna. */
export async function returnToTabAfter(page, seconds) {
  await page.evaluate((ms) => {
    const realNow = Date.now;
    Date.now = () => realNow() + ms;
    document.dispatchEvent(new Event('visibilitychange'));
  }, seconds * 1000);
}

/** Attende l'email arrivata in Mailpit per il destinatario e ne restituisce il testo. */
export async function readLastEmail(request, to) {
  let id;
  await expect.poll(async () => {
    const response = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:"${to}"` } });
    id = (await response.json()).messages?.[0]?.ID;
    return id;
  }, { message: `email per ${to}`, timeout: 10000 }).toBeTruthy();
  const message = await (await request.get(`${MAILPIT}/api/v1/message/${id}`)).json();
  return { subject: message.Subject, text: message.Text };
}

/** Destinatario mai usato: Mailpit conserva le email fra un'esecuzione e l'altra. */
export const uniqueMail = (name) => `${name}.${Date.now()}@parkapp.local`;

export const daysFromToday = (amount) => addDays(today(), amount);
