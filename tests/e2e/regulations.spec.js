import { expect, test, USER, ADMIN, DEMO_PASSWORD } from './helpers.js';
import { login } from './helpers.js';
import pg from 'pg';

test.describe('regolamento aziendale', () => {
  test('un utente che non ha accettato vede il banner, accetta il regolamento e il banner scompare', async ({ page }) => {
    // Resetta l'accettazione per l'utente Mario
    const pool = new pg.Pool({ connectionString: process.env.E2E_DATABASE_URL });
    await pool.query("UPDATE users SET accepted_rules_version = NULL, rules_accepted_at = NULL WHERE mail = $1", [USER]);
    await pool.end();

    await login(page, USER, DEMO_PASSWORD);

    // La modale compare automaticamente o l'utente vede il banner
    const modal = page.locator('.rules-modal');
    if (await modal.isVisible()) {
      // Chiude temporaneamente con "Non accetto"
      await page.click('button:has-text("Non accetto")');
      await expect(modal).not.toBeVisible();
    }

    // Il banner è visibile
    const banner = page.locator('.rules-reminder-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Non hai ancora accettato il regolamento aziendale');

    // Clicca su "Leggi e Accetta"
    await banner.locator('button:has-text("Leggi e Accetta")').click();
    await expect(modal).toBeVisible();
    await expect(page.locator('.rules-doc-title')).toContainText('Regolamento');

    // Seleziona la checkbox e accetta
    await page.check('.rules-checkbox-label input[type="checkbox"]');
    await page.click('button:has-text("Accetto il Regolamento")');

    // La modale si chiude e il banner scompare
    await expect(modal).not.toBeVisible();
    await expect(banner).not.toBeVisible();

    // Sul profilo lo stato risulta accettato
    await page.goto('/profile');
    await expect(page.locator('.profile-card', { hasText: 'Regolamento Aziendale' })).toContainText('Accettato ✅');
  });

  test('un utente con regolamento già accettato può consultarlo dal menu utente in sola lettura', async ({ page }) => {
    await login(page, USER, DEMO_PASSWORD);

    // Nessun banner
    await expect(page.locator('.rules-reminder-banner')).not.toBeVisible();

    // Apre il menu utente
    await page.locator('.user-menu').hover();
    await page.click('button:has-text("Regolamento")');

    const modal = page.locator('.rules-modal');
    await expect(modal).toBeVisible();
    await expect(page.locator('button:has-text("Chiudi")')).toBeVisible();
    await page.click('button:has-text("Chiudi")');
    await expect(modal).not.toBeVisible();
  });
});
