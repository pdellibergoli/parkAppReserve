import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');

const PORT = 4173;
export const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.js',
  // Un solo database condiviso, azzerato prima di ogni test: i test non possono sovrapporsi
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    // Stesso fuso e lingua degli utenti, a prescindere dalla macchina che esegue i test
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    // Sempre sulla build di produzione: alcuni errori (es. l'ordine dei pacchetti) esistono solo lì
    command: 'npx vite build && node tests/e2e/server.js',
    url: `${BASE_URL}/login`,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      PORT: String(PORT),
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? '',
      APP_BASE_URL: `${BASE_URL}/`,
      CRON_SECRET: 'e2e-cron-secret',
    },
  },
});
