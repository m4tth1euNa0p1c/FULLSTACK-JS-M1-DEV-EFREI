import { test, expect } from '@playwright/test';

/**
 * Tests de fumée (@smoke) : aucune donnée créée, jouables contre la production.
 */
test.describe('Santé de la plateforme @smoke', () => {
  test('GET /api/health répond 200 avec exactement {"status":"ok"}', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/json');
    expect(await res.text()).toBe('{"status":"ok"}');
  });

  test('une route métier sans JWT répond 401 au format contractuel', async ({ request }) => {
    const res = await request.get('/api/tasks');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(typeof body.error.message).toBe('string');
  });

  test('la documentation OpenAPI est servie', async ({ request }) => {
    const res = await request.get('/api/docs.json');
    expect(res.status()).toBe(200);
    const doc = await res.json();
    expect(doc.openapi).toMatch(/^3\./);
    expect(doc.paths).toHaveProperty('/tasks');
  });

  test('un visiteur non connecté est redirigé vers la page de connexion', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('**/login');
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Mot de passe')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
  });
});
