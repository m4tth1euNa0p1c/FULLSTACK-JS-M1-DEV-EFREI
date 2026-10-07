import { test, expect } from '@playwright/test';
import { createTask, register, waitForList } from './helpers.js';

test.describe('Bonus B1 : priorité, filtres, compteurs', () => {
  test.beforeEach(async ({ page }) => {
    await register(page);
  });

  test('priorité haute visible dans la liste et le détail, compteurs présents', async ({ page }) => {
    await createTask(page, { title: 'Urgente', status: 'todo', priority: 'high' });
    await waitForList(page);
    await expect(page.locator('.task-item .badge--priority-high')).toHaveText('Priorité haute');
    await expect(page.locator('.stats .stat')).toHaveCount(5);
    await expect(page.locator('.stats .stat__value').first()).toHaveText('1');

    await page.locator('.task-item__title').click();
    await page.locator('.detail-grid').waitFor();
    await expect(page.locator('.detail-grid .badge--priority-high')).toHaveText('Priorité haute');
  });

  test('les filtres pilotent la liste et l’URL, la date locale est envoyée à l’API', async ({ page }) => {
    await createTask(page, { title: 'Terminée', status: 'done', priority: 'low' });
    await createTask(page, { title: 'À faire', status: 'todo', priority: 'high' });
    await waitForList(page);
    await expect(page.locator('.task-item')).toHaveCount(2);

    await page.getByLabel('Statut').selectOption('done');
    await expect(page).toHaveURL(/status=done/);
    await expect(page.locator('.task-item')).toHaveCount(1);
    await expect(page.locator('.task-item__title')).toHaveText('Terminée');

    await page.getByLabel('Priorité').selectOption('high');
    await expect(page.locator('.empty-state h2')).toHaveText('Aucune tâche ne correspond à ces filtres');

    const dueRequest = page.waitForRequest((req) => req.url().includes('/api/tasks?') && req.url().includes('due=overdue'));
    await page.getByLabel('Échéance').selectOption('overdue');
    expect((await dueRequest).url()).toMatch(/today=\d{4}-\d{2}-\d{2}/);

    await page.getByRole('button', { name: 'Réinitialiser' }).click();
    await expect(page).toHaveURL(/\/tasks$/);
    await expect(page.locator('.task-item')).toHaveCount(2);
  });
});

test.describe('Bonus B4 : statistiques hebdomadaires', () => {
  test('page Statistiques : chiffres clés, graphique, tableau, période', async ({ page }) => {
    await register(page);
    await createTask(page, { title: 'Faite', status: 'done' });
    await createTask(page, { title: 'En cours', status: 'doing' });

    await page.getByRole('link', { name: 'Statistiques' }).click();
    await page.waitForURL('**/stats');
    await page.locator('.chart__bars .bar').first().waitFor();

    await expect(page.locator('.chart__bars .bar')).toHaveCount(8);
    await expect(page.locator('.stats .stat__value').first()).toHaveText(/50\s?%/);
    await expect(page.locator('.bar--current .bar__hit')).toHaveAttribute('aria-label', /Semaine du .* : 50 %, 1 terminée sur 2 ouvertes, 2 créées/);
    await expect(page.locator('.table tbody tr')).toHaveCount(8);

    await page.getByLabel('Période affichée').selectOption('4');
    await expect(page).toHaveURL(/weeks=4/);
    await expect(page.locator('.chart__bars .bar')).toHaveCount(4);
  });

  test('le détail d’une tâche terminée affiche « Terminée le »', async ({ page }) => {
    await register(page);
    await createTask(page, { title: 'Clôturée', status: 'done' });
    await waitForList(page);
    await page.locator('.task-item__title').click();
    await expect(page.locator('.detail-grid')).toContainText('Terminée le');
  });
});
