import { STATUS_LABELS } from './taskStatus';

export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 1000;

export const EMPTY_TASK = { title: '', status: 'todo', description: '', dueDate: '' };

/**
 * Validation côté client : aide l'utilisateur avant l'envoi, mais ne remplace
 * jamais la validation de l'API (un client HTTP peut contourner ce formulaire).
 */
export function validateTaskForm(values) {
  const errors = {};
  const title = values.title.trim();
  if (!title) errors.title = 'Le titre est obligatoire.';
  else if (title.length > TITLE_MAX) errors.title = `Le titre ne peut pas dépasser ${TITLE_MAX} caractères.`;
  if (!Object.keys(STATUS_LABELS).includes(values.status)) errors.status = 'Statut invalide.';
  if (values.description.length > DESCRIPTION_MAX) {
    errors.description = `La description ne peut pas dépasser ${DESCRIPTION_MAX} caractères.`;
  }
  if (values.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(values.dueDate)) {
    errors.dueDate = 'Format attendu : AAAA-MM-JJ.';
  }
  return errors;
}

/** Transforme les valeurs du formulaire en corps JSON conforme au contrat API. */
export function toApiPayload(values) {
  return {
    title: values.title.trim(),
    status: values.status,
    description: values.description,
    dueDate: values.dueDate ? values.dueDate : null,
  };
}

/** Valeurs de formulaire à partir d'une tâche renvoyée par l'API. */
export function fromTask(task) {
  return {
    title: task.title ?? '',
    status: task.status ?? 'todo',
    description: task.description ?? '',
    dueDate: task.dueDate ?? '',
  };
}
