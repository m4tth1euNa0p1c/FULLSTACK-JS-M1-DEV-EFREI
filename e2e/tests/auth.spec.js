import { test, expect } from '@playwright/test';
import { PASSWORD, login, register, uniqueEmail } from './helpers.js';

test.describe('Inscription, connexion, session', () => {
  test('inscription puis arrivée sur une liste vide avec message de bienvenue', async ({ page }) => {
    const { email } = await register(page);
    await expect(page.locator('.alert--success')).toContainText('Bienvenue');
    await expect(page.locator('.empty-state h2')).toHaveText('Aucune tâche pour l’instant');
    await expect(page.locator('.user-email')).toHaveText(email);
  });

  test('un mot de passe trop court est bloqué avant envoi', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('Email').fill(uniqueEmail());
    await page.getByLabel('Mot de passe').fill('court');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(page).toHaveURL(/\/register$/);
    const message = await page.getByLabel('Mot de passe').evaluate((input) => input.validationMessage);
    expect(message.length).toBeGreaterThan(0);
  });

  test('un email déjà utilisé affiche une erreur lisible (409)', async ({ page, browser }) => {
    const { email } = await register(page);
    const other = await browser.newContext();
    const page2 = await other.newPage();
    await page2.goto('/register');
    await page2.getByLabel('Email').fill(email.toUpperCase());
    await page2.getByLabel('Mot de passe').fill(PASSWORD);
    await page2.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(page2.getByRole('alert')).toContainText('déjà utilisé');
    await other.close();
  });

  test('de mauvais identifiants affichent une erreur sans révéler lequel est faux', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(uniqueEmail('inconnu'));
    await page.getByLabel('Mot de passe').fill('MauvaisMotDePasse');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.getByRole('alert')).toContainText('Email ou mot de passe incorrect');
  });

  test('déconnexion : message, session effacée, pages protégées inaccessibles', async ({ page }) => {
    await register(page);
    await page.getByRole('button', { name: 'Se déconnecter' }).click();
    await page.waitForURL('**/login');
    await expect(page.locator('.alert--info')).toContainText('déconnecté');
    expect(await page.evaluate(() => localStorage.getItem('taskflow.session'))).toBeNull();
    await page.goto('/tasks');
    await page.waitForURL('**/login');
  });

  test('reconnexion avec le même compte', async ({ page }) => {
    const { email, password } = await register(page);
    await page.getByRole('button', { name: 'Se déconnecter' }).click();
    await page.waitForURL('**/login');
    await login(page, email, password);
    await expect(page.locator('.user-email')).toHaveText(email);
  });

  test('un jeton altéré provoque une déconnexion avec le message « session expirée »', async ({ page }) => {
    await register(page);
    await page.evaluate(() => {
      const session = JSON.parse(localStorage.getItem('taskflow.session'));
      const [header, payload] = session.token.split('.');
      localStorage.setItem('taskflow.session', JSON.stringify({ ...session, token: `${header}.${payload}.signaturefalsifiee` }));
    });
    await page.goto('/tasks');
    await page.waitForURL('**/login');
    await expect(page.locator('.alert--info')).toContainText('expiré');
  });
});
