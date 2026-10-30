import { ADMIN, NEXT_DAY, expect, login, openDay, rpc, test } from './helpers.js';

const cardOf = (modal, name) => modal.locator('.booking-card', { hasText: name });
const changeStatus = (modal, name, status) => cardOf(modal, name).locator('.admin-status-select').selectOption(status);

async function openAdminDay(page) {
  await login(page, ADMIN);
  const modal = await openDay(page, NEXT_DAY);
  await modal.locator('.admin-panel-toggle').click();
  return modal;
}

test('da in attesa ad assegnata con logica automatica: prende il primo posto libero', async ({ page }) => {
  const modal = await openAdminDay(page);
  await changeStatus(modal, 'Mario Rossi', 'assigned');
  await page.locator('.confirm-btn.logic').click();

  await expect(cardOf(modal, 'Mario Rossi')).toHaveClass(/status-assigned/);
  await expect(cardOf(modal, 'Mario Rossi')).toContainText('P1');
});

test('posti esauriti: la logica automatica rifiuta e lo stato non cambia', async ({ page, request }) => {
  await rpc(request, 'adminManuallyAssignForDate', { date: NEXT_DAY });
  const messages = [];
  page.on('dialog', (dialog) => messages.push(dialog.message()));

  const modal = await openAdminDay(page);
  await changeStatus(modal, 'Mario Rossi', 'assigned');
  await page.locator('.confirm-btn.logic').click();

  await expect.poll(() => messages.join()).toContain('Nessun posto disponibile');
  await expect(cardOf(modal, 'Mario Rossi')).toHaveClass(/status-not_assigned/);
});

test('forzatura: overbooking senza un posto reale', async ({ page, request }) => {
  await rpc(request, 'adminManuallyAssignForDate', { date: NEXT_DAY });

  const modal = await openAdminDay(page);
  await changeStatus(modal, 'Mario Rossi', 'assigned');
  await page.locator('.confirm-btn.force').click();

  await expect(cardOf(modal, 'Mario Rossi')).toHaveClass(/status-assigned/);
  await expect(cardOf(modal, 'Mario Rossi')).toContainText('Forzato');
  await expect(modal.locator('.booking-card.status-assigned')).toHaveCount(4);
});

test('togliere un posto con logica automatica lo riassegna al primo in attesa', async ({ page, request }) => {
  await rpc(request, 'adminManuallyAssignForDate', { date: NEXT_DAY });

  const modal = await openAdminDay(page);
  await changeStatus(modal, 'Luca Verdi', 'not_assigned');
  await page.locator('.confirm-btn.logic').click();

  await expect(cardOf(modal, 'Luca Verdi')).toHaveClass(/status-not_assigned/);
  await expect(cardOf(modal, 'Giulia Bianchi')).toHaveClass(/status-assigned/);
  await expect(modal.locator('.booking-card.status-assigned')).toHaveCount(3);
});

test('togliere un posto forzando il cambio stato non lo riassegna', async ({ page, request }) => {
  await rpc(request, 'adminManuallyAssignForDate', { date: NEXT_DAY });

  const modal = await openAdminDay(page);
  await changeStatus(modal, 'Luca Verdi', 'not_assigned');
  await page.locator('.confirm-btn.force').click();

  await expect(cardOf(modal, 'Luca Verdi')).toHaveClass(/status-not_assigned/);
  await expect(modal.locator('.booking-card.status-assigned')).toHaveCount(2);
  await expect(cardOf(modal, 'Giulia Bianchi')).toHaveClass(/status-not_assigned/);
});

test('annullando la conferma lo stato resta quello di prima', async ({ page }) => {
  const modal = await openAdminDay(page);
  await changeStatus(modal, 'Mario Rossi', 'assigned');
  await page.locator('.cancel-btn.block-btn').click();

  await expect(page.locator('.confirm-btn.logic')).toHaveCount(0);
  await expect(cardOf(modal, 'Mario Rossi')).toHaveClass(/status-pending/);
  await expect(cardOf(modal, 'Mario Rossi').locator('.admin-status-select')).toHaveValue('pending');
});

test('da in attesa a non assegnata: basta la conferma semplice', async ({ page }) => {
  const modal = await openAdminDay(page);
  await changeStatus(modal, 'Sara Neri', 'not_assigned');
  await expect(cardOf(modal, 'Sara Neri')).toHaveClass(/status-not_assigned/);
});
