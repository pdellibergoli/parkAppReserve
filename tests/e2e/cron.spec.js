import { readFileSync } from 'node:fs';
import { addDays } from '../../server/dates.js';
import { NEXT_DAY, expect, readLastEmail, resetServerTime, rpc, setServerTime, test } from './helpers.js';

const SECRET = 'e2e-cron-secret';
const callCron = (request, token = SECRET) => request.get('/api/cron/assign', {
  headers: token ? { Authorization: `Bearer ${token}` } : {},
});

// Il cron processa "domani": lo si esegue la sera prima del giorno con le richieste in attesa
const eveningBefore = addDays(NEXT_DAY, -1);

test.afterEach(({ request }) => resetServerTime(request));

const pendingCount = async (request) => {
  const { requests } = await rpc(request, 'getMonthData', { targetDate: NEXT_DAY });
  return requests.filter((r) => r.status === 'pending').length;
};

test('senza il secret giusto il cron rifiuta e non assegna nulla', async ({ request }) => {
  await setServerTime(request, eveningBefore, 19);

  expect((await callCron(request, null)).status()).toBe(401);
  expect((await callCron(request, 'sbagliato')).status()).toBe(401);
  expect(await pendingCount(request)).toBe(5);
});

test('fuori dalle 19 di Roma il cron non fa nulla', async ({ request }) => {
  await setServerTime(request, eveningBefore, 18);
  expect(await (await callCron(request)).json()).toEqual({ status: 'skipped' });

  await setServerTime(request, eveningBefore, 20);
  expect(await (await callCron(request)).json()).toEqual({ status: 'skipped' });

  expect(await pendingCount(request)).toBe(5);
});

test('alle 19 di Roma assegna le richieste di domani e invia le email', async ({ request }) => {
  await setServerTime(request, eveningBefore, 19);

  const response = await callCron(request);
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'success', data: { assigned: 3, failed: 2 } });

  const { requests } = await rpc(request, 'getMonthData', { targetDate: NEXT_DAY });
  const statuses = requests
    .filter((r) => r.requestId.startsWith('req_seed_next_'))
    .map((r) => r.status)
    .sort();
  expect(statuses).toEqual(['assigned', 'assigned', 'assigned', 'not_assigned', 'not_assigned']);

  const { subject } = await readLastEmail(request, 'mario@parkapp.local');
  expect(subject).toBe('Esito Richiesta Parcheggio');

  // Una seconda chiamata, come un cron ripetuto da Vercel, non cambia nulla
  expect((await (await callCron(request)).json()).data).toEqual({ assigned: 0, failed: 0 });
});

test('la configurazione Vercel chiama il cron a entrambe le ore UTC e non riscrive le API', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));

  expect(config.crons).toEqual([
    { path: '/api/cron/assign', schedule: '0 17 * * *' }, // 19:00 con l'ora legale
    { path: '/api/cron/assign', schedule: '0 18 * * *' }, // 19:00 con l'ora solare
  ]);

  const rewrite = new RegExp(`^${config.rewrites[0].source}$`);
  expect(rewrite.test('/stats')).toBe(true);
  expect(rewrite.test('/api/rpc')).toBe(false);
  expect(rewrite.test('/api/cron/assign')).toBe(false);
  expect(rewrite.test('/assets/app.js')).toBe(false);
});
