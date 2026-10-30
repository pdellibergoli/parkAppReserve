import { ADMIN, NEXT_DAY, expect, goTo, login, returnToTabAfter, rpc, shown, test } from './helpers.js';

const rows = (page) => page.locator('.bookings-list > li');
const pager = (page) => page.locator('.pagination');

async function openMyRequests(page) {
  await login(page, ADMIN);
  await goTo(page, 'Le mie richieste');
  await expect(pager(page)).toBeVisible();
}

test('mostra 20 richieste per pagina, dalla più recente', async ({ page }) => {
  await openMyRequests(page);
  await expect(rows(page)).toHaveCount(20);
  await expect(pager(page)).toContainText('Pagina 1 di 2 (21 richieste)');
  await expect(page.locator('.booking-date').first()).toHaveText(shown(NEXT_DAY));
  await expect(page.getByRole('button', { name: 'Precedente' })).toBeDisabled();
});

test('la pagina successiva è già pronta e non richiede chiamate', async ({ page }) => {
  await openMyRequests(page);
  // Attende il caricamento anticipato prima di iniziare a contare
  await page.waitForLoadState('networkidle');

  const calls = [];
  page.on('request', (request) => { if (request.url().includes('/api/rpc')) calls.push(request.postData()); });
  await page.getByRole('button', { name: 'Successiva' }).click();

  await expect(rows(page)).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Successiva' })).toBeDisabled();
  expect(calls).toEqual([]);
});

test('non scarica mai lo storico intero', async ({ page }) => {
  const actions = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/rpc')) actions.push(JSON.parse(request.postData()).action);
  });
  await openMyRequests(page);
  await page.waitForLoadState('networkidle');
  expect(actions).toContain('getRequestsPage');
  expect(actions).not.toContain('getRequests');
});

test('cambiare pagina azzera la selezione', async ({ page }) => {
  await openMyRequests(page);
  await page.locator('.bookings-list input[type=checkbox]').first().check({ force: true });
  await expect(page.locator('.delete-selected-btn')).toContainText('(1)');

  await page.getByRole('button', { name: 'Successiva' }).click();
  await expect(page.locator('.delete-selected-btn')).toContainText('(0)');
  await expect(page.locator('.delete-selected-btn')).toBeDisabled();
});

test('se l\'ultima pagina sparisce si torna a quella valida', async ({ page, request }) => {
  await openMyRequests(page);
  await page.getByRole('button', { name: 'Successiva' }).click();
  await expect(rows(page)).toHaveCount(1);

  await rpc(request, 'cancelMultipleRequests', { requestIds: ['req_seed_next_user_admin'] });
  await returnToTabAfter(page, 61);

  await expect(rows(page)).toHaveCount(20);
  await expect(pager(page)).toHaveCount(0);
});

test('cancellare una richiesta aggiorna lista e totale', async ({ page }) => {
  await openMyRequests(page);
  await page.locator('.delete-btn').first().click();

  // Ne sale una dalla seconda pagina: 20 righe, ma le richieste ora stanno in una pagina sola
  await expect(pager(page)).toHaveCount(0);
  await expect(rows(page)).toHaveCount(20);
  await expect(page.locator('.booking-date').first()).not.toHaveText(shown(NEXT_DAY));
});
