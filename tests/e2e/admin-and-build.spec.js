import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { ADMIN, DAY_AFTER, USER, expect, goTo, login, pickDay, rpc, test } from './helpers.js';

const spaceRow = (page, name) => page.locator('.space-item', { hasText: name });

test('gestione parcheggi: aggiunge, rinomina, cambia tipo ed elimina', async ({ page, request }) => {
  await login(page, ADMIN);
  await goTo(page, 'Parcheggi');
  await expect(page.locator('.space-item')).toHaveCount(3);

  await page.locator('.add-space-form .space-input').fill('P9');
  await page.locator('.add-space-form button[type=submit]').click();
  await expect(spaceRow(page, 'P9')).toBeVisible();

  await spaceRow(page, 'P9').locator('.modify-space-btn').click();
  await page.locator('.space-item .space-input').fill('P10');
  await page.getByTitle('Salva nome').click();
  await expect(spaceRow(page, 'P10')).toBeVisible();

  await spaceRow(page, 'P10').locator('input[type=checkbox]').check({ force: true });
  await expect.poll(async () => {
    const spaces = await rpc(request, 'getParkingSpaces');
    return spaces.find((space) => space.number === 'P10')?.isFixed;
  }).toBe(true);

  await spaceRow(page, 'P10').locator('.delete-space-btn').click();
  await expect(spaceRow(page, 'P10')).toHaveCount(0);
  expect((await rpc(request, 'getParkingSpaces')).map((space) => space.number)).toEqual(['P1', 'P2', 'P3']);
});

test('disponibilità temporanea di un posto non fisso', async ({ page, request }) => {
  await login(page, ADMIN);
  await goTo(page, 'Parcheggi');

  await page.getByTitle('Gestisci disponibilità per P3').click();
  await pickDay(page, DAY_AFTER);
  await page.locator('.modal-content button[type=submit]').click();
  await expect(page.locator('.modal-content')).toHaveCount(0);

  const entries = await rpc(request, 'getTemporaryAvailabilities', { spaceId: 'space_p3' });
  expect(entries).toHaveLength(2);
});

test('statistiche: priorità ordinate e storico del singolo utente', async ({ page }) => {
  await login(page, ADMIN);
  await goTo(page, 'Statistiche');

  const cards = page.locator('.user-stat-card');
  await expect(cards).toHaveCount(5);
  // Tasso di successo più basso in cima; Mario, con 16 assegnazioni su 21 richieste, è ultimo
  await expect(cards.last()).toContainText('Mario Rossi');

  await cards.last().click();
  await expect(page.locator('.modal-content')).toContainText('Mario Rossi');
  await expect(page.locator('.modal-content')).toContainText('Assegnato');
});

test('profilo: il tema scelto viene salvato sul server', async ({ page, request }) => {
  await login(page, USER);
  await page.goto('/profile');
  // La casella è nascosta: si clicca l'interruttore grafico che la contiene, come un utente
  await page.locator('.profile-card input[type=checkbox]').first().locator('xpath=..').click();

  await expect.poll(async () => {
    const users = await rpc(request, 'getUsers');
    return users.find((user) => user.mail === USER).preferredTheme;
  }).toBe('dark');
});

test('nessuna pagina invia segreti al browser: API senza hash, bundle senza codice del server', async ({ request }) => {
  const { users } = await rpc(request, 'getReferenceData');
  const payload = JSON.stringify(users);
  for (const secret of ['password', 'salt', 'verificationToken', 'resetToken']) {
    expect(payload).not.toContain(secret);
  }

  const assets = path.resolve('dist', 'assets');
  const bundle = readdirSync(assets)
    .filter((file) => file.endsWith('.js'))
    .map((file) => readFileSync(path.join(assets, file), 'utf8'))
    .join('\n');
  for (const serverCode of ['DATABASE_URL', 'SMTP_HOST', 'pg_advisory', 'CRON_SECRET']) {
    expect(bundle).not.toContain(serverCode);
  }
});
