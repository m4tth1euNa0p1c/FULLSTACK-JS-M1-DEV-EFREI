import { defineConfig, devices } from '@playwright/test';

/**
 * Tests de bout en bout TaskFlow.
 *
 * Cible : l'URL de base est fournie par E2E_BASE_URL.
 *   - Intégration (compose, CI) : http://localhost:8080
 *   - Développement local       : http://localhost:5173 (Vite + API sur :3000)
 *   - Production                : URL du service web déployé, avec --grep @smoke
 *
 * En local, le navigateur s'ouvre (mode visible, Chrome installé, léger ralenti pour
 * suivre le scénario) ; dans GitHub Actions (CI=true) tout tourne en headless sur Chromium.
 *   E2E_HEADLESS=1          force le mode headless en local
 *   E2E_BROWSER_CHANNEL=    chrome (défaut local) | msedge | chromium (vide)
 *   E2E_SLOWMO=             millisecondes entre deux actions (défaut 80 en local, 0 en CI)
 *
 * Les tests @smoke ne créent aucune donnée : ils peuvent tourner contre la production.
 * Les autres tests créent des comptes jetables (e2e.<horodatage>@example.test).
 */
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173';
const isCI = Boolean(process.env.CI);
const headless = isCI || process.env.E2E_HEADLESS === '1';
const channel = isCI ? undefined : process.env.E2E_BROWSER_CHANNEL ?? 'chrome';
const slowMo = Number(process.env.E2E_SLOWMO ?? (isCI ? 0 : 80));

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
    headless,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { slowMo },
    ...(channel ? { channel } : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
