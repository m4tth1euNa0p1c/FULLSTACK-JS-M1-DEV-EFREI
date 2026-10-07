import { expect } from '@playwright/test';

export const PASSWORD = 'MotDePasse123!';

/** Email jetable unique : chaque test crée son propre compte, aucune dépendance entre tests. */
export function uniqueEmail(prefix = 'e2e') {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.test`;
}

/** Inscription via l'interface ; renvoie les identifiants créés. */
export async function register(page, email = uniqueEmail(), password = PASSWORD) {
  await page.goto('/register');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await page.waitForURL('**/tasks');
  return { email, password };
}

/** Connexion via l'interface. */
export async function login(page, email, password = PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('**/tasks');
}

/** Création d'une tâche via le formulaire ; revient sur la liste. */
export async function createTask(page, { title, status = 'todo', priority, description, dueDate }) {
  await page.goto('/tasks/new');
  await page.getByLabel(/^Titre/).fill(title);
  await page.getByLabel(/^Statut/).selectOption(status);
  if (priority) await page.getByLabel('Priorité').selectOption(priority);
  if (description) await page.getByLabel('Description').fill(description);
  if (dueDate) await page.getByLabel('Échéance').fill(dueDate);
  await page.getByRole('button', { name: 'Créer la tâche' }).click();
  await page.waitForURL('**/tasks');
  await expect(page.locator('.alert--success')).toContainText('créée');
}

/** Attend que la liste ait fini de charger (liste ou état vide affiché). */
export async function waitForList(page) {
  await page.locator('.task-list, .empty-state').first().waitFor();
}
