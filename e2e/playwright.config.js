import { defineConfig, devices } from '@playwright/test';

/**
 * Tests de bout en bout TaskFlow.
 *
 * Cible : l'URL de base est fournie par E2E_BASE_URL.
 *   - Intégration (compose, CI) : http://localhost:8080
 *   - Développement local       : http://localhost:5173 (Vite + API sur :3000)
 *   - Production                : URL du service web déployé, avec --grep @smoke
 *
 * Les tests @smoke ne créent aucune donnée : ils peuvent tourner contre la production.
 * Les autres tests créent des comptes jetables (e2e.<horodatage>@example.test).
 */
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173';
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: isCI ? 1 : 0,
  forbidOnly: isCI,
  reporter: isCI
    ? [['list'], ['github'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // En local, E2E_BROWSER_CHANNEL=chrome utilise le Chrome installé (pas de téléchargement).
    ...(process.env.E2E_BROWSER_CHANNEL ? { channel: process.env.E2E_BROWSER_CHANNEL } : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
