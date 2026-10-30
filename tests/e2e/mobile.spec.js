import { devices } from '@playwright/test';
import { ADMIN, DAY_AFTER, NEXT_DAY, USER, expect, login, openDay, pickDay, shown, test } from './helpers.js';

test.use({ ...devices['Pixel 7'] });

const horizontalOverflow = (page) => page.evaluate(() => (
  document.documentElement.scrollWidth - document.documentElement.clientWidth
));

async function openFromMenu(page, label) {
  await page.locator('.mobile-menu-toggle').click();
  await page.locator('.main-nav.mobile-active a', { hasText: label }).click();
}

test('il menu si apre, porta alle pagine e si richiude', async ({ page }) => {
  await login(page, USER);
  await expect(page.locator('.main-nav.mobile-active')).toHaveCount(0);

  await openFromMenu(page, 'Le mie richieste');
  await expect(page).toHaveURL(/\/my-requests$/);
  await expect(page.locator('.main-nav.mobile-active')).toHaveCount(0);

  await openFromMenu(page, 'Statistiche');
  await expect(page.locator('.user-stat-card').first()).toBeVisible();
});

test('nessuna pagina scorre di lato', async ({ page }) => {
  await login(page, ADMIN);
  await expect(page.locator('.rbc-month-view')).toBeVisible();
  expect(await horizontalOverflow(page), 'calendario').toBeLessThanOrEqual(1);

  for (const [label, url, ready] of [
    ['Le mie richieste', /my-requests/, '.bookings-list'],
    ['Parcheggi', /parking-spaces/, '.spaces-list'],
    ['Statistiche', /stats/, '.user-stat-card'],
  ]) {
    await openFromMenu(page, label);
    await expect(page).toHaveURL(url);
    await expect(page.locator(ready).first()).toBeVisible();
    expect(await horizontalOverflow(page), label).toBeLessThanOrEqual(1);
  }

  await page.goto('/profile');
  await expect(page.locator('.profile-card').first()).toBeVisible();
  expect(await horizontalOverflow(page), 'profilo').toBeLessThanOrEqual(1);
});

test('la modale del giorno resta dentro lo schermo', async ({ page }) => {
  await login(page, USER);
  const modal = await openDay(page, NEXT_DAY);
  await expect(modal.locator('.booking-card')).toHaveCount(5);

  const box = await modal.boundingBox();
  const viewport = page.viewportSize();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
});

test('si può inviare una richiesta dal telefono', async ({ page }) => {
  await login(page, USER);
  await page.locator('.add-booking-btn-alt').click();
  await pickDay(page, DAY_AFTER);
  await page.locator('.modal-content button[type=submit]').click();
  await expect(page.locator('.modal-content .success-message')).toBeVisible();
  await page.locator('.modal-content .submit-btn').click();

  await openFromMenu(page, 'Le mie richieste');
  await expect(page.locator('.booking-date').first()).toHaveText(shown(DAY_AFTER));
});

test('la paginazione è utilizzabile dal telefono', async ({ page }) => {
  await login(page, ADMIN);
  await openFromMenu(page, 'Le mie richieste');
  const next = page.getByRole('button', { name: 'Successiva' });
  await next.scrollIntoViewIfNeeded();
  await next.click();
  await expect(page.locator('.pagination')).toContainText('Pagina 2 di 2');
});
