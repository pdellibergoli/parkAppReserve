import {
  ADMIN, DAY_AFTER, NEXT_DAY, USER, calendarCell, daysFromToday, expect, goTo, login, openDay, pickDay, readLastEmail,
  returnToTabAfter, rpc, shown, test,
} from './helpers.js';

test('il calendario mostra richieste, stato personale e comunicazioni', async ({ page }) => {
  await login(page, USER);
  await expect(page.locator('.communication-banner')).toContainText('Ambiente di sviluppo');

  const cell = await calendarCell(page, NEXT_DAY);
  await expect(cell.locator('.booking-count-badge')).toHaveText('5');
  await expect(cell.locator('.my-request-icon.status-pending')).toBeVisible();
});

test('una nuova richiesta dalla modale compare nel calendario e nelle mie richieste', async ({ page }) => {
  await login(page, USER);
  await page.locator('.add-booking-btn-alt').click();
  await pickDay(page, DAY_AFTER);
  await page.locator('.modal-content button[type=submit]').click();
  await expect(page.locator('.modal-content .success-message')).toBeVisible();
  await page.locator('.modal-content .submit-btn').click();

  const cell = await calendarCell(page, DAY_AFTER);
  await expect(cell.locator('.booking-count-badge')).toHaveText('1');

  await goTo(page, 'Le mie richieste');
  await expect(page.locator('.booking-date').first()).toHaveText(shown(DAY_AFTER));
});

test('assegnazione: va a chi ha avuto meno posti, e chi rinuncia lascia il posto al primo in attesa', async ({ page, request }) => {
  await rpc(request, 'adminManuallyAssignForDate', { date: NEXT_DAY });

  await login(page, ADMIN);
  const modal = await openDay(page, NEXT_DAY);
  const card = (name) => modal.locator('.booking-card', { hasText: name });

  // Tre posti e tasso di successo: Anna 0,20, Sara 0,20, Luca 0,30, Giulia 0,50, Mario 0,80
  await expect(card('Anna Admin')).toHaveClass(/status-assigned/);
  await expect(card('Sara Neri')).toHaveClass(/status-assigned/);
  await expect(card('Luca Verdi')).toHaveClass(/status-assigned/);
  await expect(card('Giulia Bianchi')).toHaveClass(/status-not_assigned/);
  await expect(card('Mario Rossi')).toHaveClass(/status-not_assigned/);

  // La riassegnazione la decide il server: la modale aperta deve mostrarla senza ricaricare
  await card('Anna Admin').locator('.delete-btn').click();
  await expect(card('Anna Admin')).toHaveCount(0);
  await expect(card('Giulia Bianchi')).toHaveClass(/status-assigned/);
  await expect(card('Mario Rossi')).toHaveClass(/status-not_assigned/);

  const { subject } = await readLastEmail(request, 'giulia@parkapp.local');
  expect(subject).toBe('Conferma Assegnazione Parcheggio');
});

test('admin: reset delle assegnazioni del giorno', async ({ page, request }) => {
  await rpc(request, 'adminManuallyAssignForDate', { date: NEXT_DAY });

  await login(page, ADMIN);
  const modal = await openDay(page, NEXT_DAY);
  await modal.locator('.admin-panel-toggle').click();
  await modal.locator('.admin-action-btn.reset').click();

  await expect(modal.locator('.booking-card.status-assigned')).toHaveCount(0);
  await expect(modal.locator('.booking-card.status-pending')).toHaveCount(5);
});

test('admin: assegnazione manuale di un posto a un utente', async ({ page, request }) => {
  await login(page, ADMIN);
  await page.locator('.admin-assign-btn').click();
  await page.locator('.modal-content select').first().selectOption('user_sara');
  await page.locator('.modal-content select').nth(1).selectOption('space_p1');
  await pickDay(page, DAY_AFTER);
  await page.locator('.modal-content button[type=submit]').click();
  await expect(page.locator('.modal-content')).toContainText('completata con successo');

  const requests = await rpc(request, 'getRequests', { userId: 'user_sara', fromDate: DAY_AFTER });
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ status: 'assigned', assignedParkingSpaceNumber: 'P1' });
});

test('una scheda rimasta aperta vede le modifiche degli altri quando l\'utente torna', async ({ page, request }) => {
  await login(page, ADMIN);
  const cell = await calendarCell(page, DAY_AFTER);
  await expect(page.locator('.rbc-toolbar-label')).toBeVisible();
  await expect(cell.locator('.booking-count-badge')).toHaveCount(0);

  await rpc(request, 'createBatchRequests', { userId: 'user_luca', dates: [DAY_AFTER] });
  await returnToTabAfter(page, 61);

  await expect(cell.locator('.booking-count-badge')).toHaveText('1');
});

test('comunicazione admin: banner visibile, email inviata, banner eliminabile', async ({ page, request }) => {
  await login(page, ADMIN);
  await page.locator('.admin-comm-btn-alt').click();
  const modal = page.locator('.modal-content');
  const text = `Manutenzione ${Date.now()}`;
  await modal.locator('textarea').fill(text);
  await modal.locator('input[type=checkbox]').check();
  await modal.locator('input[type=date]').nth(0).fill(daysFromToday(0));
  await modal.locator('input[type=date]').nth(1).fill(DAY_AFTER);
  await modal.locator('button[type=submit]').click();

  const banner = page.locator('.communication-banner', { hasText: text });
  await expect(banner).toBeVisible();
  await expect.poll(async () => (await readLastEmail(request, USER)).text).toContain(text);

  const closeModal = modal.locator('.modal-close-btn');
  if (await closeModal.isVisible()) await closeModal.click();
  await banner.locator('.banner-close-btn').click();
  await expect(banner).toHaveCount(0);
});
