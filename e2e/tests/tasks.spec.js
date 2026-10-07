import { test, expect } from '@playwright/test';
import { createTask, register, waitForList } from './helpers.js';

test.describe('Parcours CRUD depuis le navigateur', () => {
  test.beforeEach(async ({ page }) => {
    await register(page);
  });

  test('créer, consulter, modifier, recharger puis supprimer une tâche', async ({ page }) => {
    await createTask(page, {
      title: 'Préparer la démo',
      status: 'doing',
      description: 'Plan et données de test',
      dueDate: '2026-10-05',
    });

    // Liste
    const item = page.locator('.task-item').first();
    await expect(item.locator('.task-item__title')).toHaveText('Préparer la démo');
    await expect(item.locator('.badge--doing')).toHaveText('En cours');
    await expect(item).toContainText('Échéance : 05/10/2026');

    // Détail
    await item.locator('.task-item__title').click();
    await page.waitForURL(/\/tasks\/[0-9a-f]{24}$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Préparer la démo');
    await expect(page.locator('.detail-grid')).toContainText('05/10/2026');
    await expect(page.locator('.detail-grid')).toContainText('Plan et données de test');
    const taskUrl = page.url();

    // Modification partielle
    await page.getByRole('button', { name: 'Modifier' }).click();
    await page.getByLabel(/^Titre/).fill('Préparer la démo (v2)');
    await page.getByLabel(/^Statut/).selectOption('done');
    await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
    await expect(page.locator('.alert--success')).toContainText('mise à jour');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Préparer la démo (v2)');
    await expect(page.locator('.detail-grid .badge--done')).toHaveText('Terminée');

    // Rechargement : la donnée vient du serveur
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Préparer la démo (v2)');

    // Suppression : annulation puis confirmation
    await page.getByRole('button', { name: 'Supprimer' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('Supprimer définitivement');
    await dialog.getByRole('button', { name: 'Annuler' }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole('button', { name: 'Supprimer' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Oui, supprimer' }).click();
    await page.waitForURL('**/tasks');
    await expect(page.locator('.alert--success')).toContainText('supprimée');
    await waitForList(page);
    await expect(page.locator('.empty-state')).toBeVisible();

    // La tâche supprimée n'est plus accessible
    await page.goto(taskUrl);
    await expect(page.getByRole('heading', { name: 'Tâche introuvable' })).toBeVisible();
  });

  test('le formulaire refuse un titre vide côté client', async ({ page }) => {
    await page.goto('/tasks/new');
    await page.getByLabel(/^Titre/).fill('   ');
    await page.getByRole('button', { name: 'Créer la tâche' }).click();
    await expect(page.locator('.field__error')).toContainText('obligatoire');
    await expect(page).toHaveURL(/\/tasks\/new$/);
  });

  test('navigation au clavier : Tab atteint « Nouvelle tâche », le focus est visible, Entrée ouvre la page', async ({ page }) => {
    await page.goto('/tasks');
    await waitForList(page);
    let focused = '';
    for (let i = 0; i < 8 && focused !== 'Nouvelle tâche'; i += 1) {
      await page.keyboard.press('Tab');
      focused = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
    }
    expect(focused).toBe('Nouvelle tâche');
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
    expect(outline).not.toBe('none');
    await page.keyboard.press('Enter');
    await page.waitForURL('**/tasks/new');
  });
});

test.describe('Affichage mobile', () => {
  test.use({ viewport: { width: 375, height: 740 } });

  test('la liste tient dans 375 px sans défilement horizontal', async ({ page }) => {
    await register(page);
    await createTask(page, { title: 'Tâche mobile avec un titre assez long pour tester le retour à la ligne' });
    await waitForList(page);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(375);
  });
});
