import { ADMIN, DEMO_PASSWORD, USER, expect, goTo, login, readLastEmail, rpc, test, uniqueMail } from './helpers.js';

const NEW_PASSWORD = 'NuovaPassword1!';

test('credenziali errate: resta sul login con un messaggio', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[type=email]', ADMIN);
  await page.fill('input[type=password]', 'sbagliata');
  await page.click('button[type=submit]');
  await expect(page.locator('.error-message')).toHaveText('Email o password non corretta.');
  await expect(page).toHaveURL(/\/login$/);
});

test('le pagine protette portano al login', async ({ page }) => {
  await page.goto('/stats');
  await expect(page).toHaveURL(/\/login$/);
});

test('registrazione, conferma via email e primo accesso', async ({ page, request }) => {
  const mail = uniqueMail('nuovo');

  await page.goto('/signup');
  const names = page.locator('input[type=text]');
  await names.nth(0).fill('Nuovo');
  await names.nth(1).fill('Collega');
  await page.fill('input[type=email]', mail);
  const passwords = page.locator('input[type=password]');
  await passwords.nth(0).fill(NEW_PASSWORD);
  await passwords.nth(1).fill(NEW_PASSWORD);
  await page.click('button[type=submit]');
  await expect(page.getByRole('heading', { name: 'Registrazione completata!' })).toBeVisible();

  // Prima della conferma l'accesso non è consentito
  await page.goto('/login');
  await page.fill('input[type=email]', mail);
  await page.fill('input[type=password]', NEW_PASSWORD);
  await page.click('button[type=submit]');
  await expect(page.locator('.error-message')).toContainText('verificare la tua email');

  const { text } = await readLastEmail(request, mail);
  await page.goto(text.match(/http\S+verify-email\?token=[\w-]+/)[0]);
  await expect(page.locator('.success-message')).toHaveText('Email verificata con successo!');

  await login(page, mail, NEW_PASSWORD);
  await expect(page.locator('.user-display-name')).toHaveText('Nuovo Collega');
});

test('recupero password: la vecchia non vale più, la nuova sì', async ({ page, request }) => {
  const mail = uniqueMail('smemorato');
  await rpc(request, 'signup', { firstName: 'Smemorato', lastName: 'Test', mail, password: DEMO_PASSWORD });
  const verification = await readLastEmail(request, mail);
  await rpc(request, 'verifyEmailToken', { token: verification.text.match(/token=([\w-]+)/)[1] });

  await page.goto('/request-reset');
  await page.fill('input[type=email]', mail);
  await page.click('button[type=submit]');
  await expect(page.locator('.success-message')).toBeVisible();

  await expect.poll(async () => (await readLastEmail(request, mail)).subject).toContain('Recupero Password');
  const { text } = await readLastEmail(request, mail);
  await page.goto(text.match(/http\S+reset-password\?token=[\w-]+/)[0]);
  const passwords = page.locator('input[type=password]');
  await passwords.nth(0).fill(NEW_PASSWORD);
  await passwords.nth(1).fill(NEW_PASSWORD);
  await page.click('button[type=submit]');
  await expect(page.locator('.success-message')).toContainText('Password aggiornata');

  await page.goto('/login');
  await page.fill('input[type=email]', mail);
  await page.fill('input[type=password]', DEMO_PASSWORD);
  await page.click('button[type=submit]');
  await expect(page.locator('.error-message')).toHaveText('Email o password non corretta.');

  await login(page, mail, NEW_PASSWORD);
});

test('logout: niente sessione né dati degli utenti restano nel browser', async ({ page }) => {
  await login(page, ADMIN);
  await goTo(page, 'Statistiche');
  await expect(page.locator('.user-stat-card').first()).toBeVisible();

  await page.locator('.user-menu').hover();
  await page.locator('.logout-btn').click();
  await expect(page).toHaveURL(/\/login$/);

  const stored = await page.evaluate(() => JSON.stringify(localStorage));
  expect(stored).not.toContain(ADMIN);
  expect(stored).not.toContain(USER);
  expect(stored).not.toContain('parkingAppUser');
});

test('un utente normale non vede gli strumenti da amministratore', async ({ page }) => {
  await login(page, USER);
  await expect(page.locator('.main-nav a', { hasText: 'Statistiche' })).toBeVisible();
  await expect(page.locator('.main-nav a', { hasText: 'Parcheggi' })).toHaveCount(0);
  await expect(page.locator('.admin-assign-btn')).toHaveCount(0);
  await expect(page.locator('.admin-comm-btn-alt')).toHaveCount(0);
});
