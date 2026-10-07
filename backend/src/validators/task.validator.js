const { invalidInput } = require('../utils/errors');
const { isCivilDate } = require('../utils/civilDate');
const { TASK_STATUSES, TASK_PRIORITIES } = require('../models/Task');

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 1000;
const DEFAULT_PRIORITY = 'medium';

// Seuls ces champs sont pilotables par le client. id et ownerId sont réservés au serveur.
const ALLOWED_FIELDS = ['title', 'status', 'priority', 'description', 'dueDate'];
const FORBIDDEN_FIELDS = ['id', '_id', 'ownerId'];

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function checkFields(body) {
  const keys = Object.keys(body);
  const forbidden = keys.filter((key) => FORBIDDEN_FIELDS.includes(key));
  if (forbidden.length > 0) {
    throw invalidInput(`Champs réservés au serveur : ${forbidden.join(', ')}`);
  }
  const unknown = keys.filter((key) => !ALLOWED_FIELDS.includes(key));
  if (unknown.length > 0) {
    throw invalidInput(`Champs inconnus : ${unknown.join(', ')}`);
  }
  return keys;
}

// Chaque fonction valide un champ et retourne sa valeur normalisée.
const fieldValidators = {
  title(value) {
    if (typeof value !== 'string') throw invalidInput('Le titre doit être une chaîne de caractères');
    const title = value.trim();
    if (title.length < 1) throw invalidInput('Le titre est obligatoire');
    if (title.length > TITLE_MAX) {
      throw invalidInput(`Le titre ne peut pas dépasser ${TITLE_MAX} caractères`);
    }
    return title;
  },
  status(value) {
    if (typeof value !== 'string' || !TASK_STATUSES.includes(value)) {
      throw invalidInput(`Le statut doit valoir ${TASK_STATUSES.join(', ')}`);
    }
    return value;
  },
  // Bonus B1 : priorité facultative, parmi low, medium, high.
  priority(value) {
    if (typeof value !== 'string' || !TASK_PRIORITIES.includes(value)) {
      throw invalidInput(`La priorité doit valoir ${TASK_PRIORITIES.join(', ')}`);
    }
    return value;
  },
  description(value) {
    if (typeof value !== 'string') {
      throw invalidInput('La description doit être une chaîne de caractères');
    }
    if (value.length > DESCRIPTION_MAX) {
      throw invalidInput(`La description ne peut pas dépasser ${DESCRIPTION_MAX} caractères`);
    }
    return value;
  },
  dueDate(value) {
    if (value === null) return null;
    if (!isCivilDate(value)) {
      throw invalidInput("L'échéance doit être une date réelle au format YYYY-MM-DD, ou null");
    }
    return value;
  },
};

/** Corps d'un POST /api/tasks : title et status obligatoires ; priority, description et dueDate facultatifs. */
function validateTaskCreate(body) {
  if (!isPlainObject(body)) throw invalidInput('Le corps de la requête doit être un objet JSON');
  checkFields(body);
  if (body.title === undefined) throw invalidInput('Le titre est obligatoire');
  if (body.status === undefined) throw invalidInput('Le statut est obligatoire');

  return {
    title: fieldValidators.title(body.title),
    status: fieldValidators.status(body.status),
    priority: body.priority === undefined ? DEFAULT_PRIORITY : fieldValidators.priority(body.priority),
    description: body.description === undefined ? '' : fieldValidators.description(body.description),
    dueDate: body.dueDate === undefined ? null : fieldValidators.dueDate(body.dueDate),
  };
}

/** Corps d'un PATCH /api/tasks/:id : partiel, non vide, champs métier uniquement. */
function validateTaskPatch(body) {
  if (!isPlainObject(body)) throw invalidInput('Le corps de la requête doit être un objet JSON');
  const keys = checkFields(body);
  if (keys.length === 0) throw invalidInput('Le PATCH doit contenir au moins un champ à modifier');

  const changes = {};
  for (const key of keys) {
    changes[key] = fieldValidators[key](body[key]);
  }
  return changes;
}

module.exports = {
  validateTaskCreate,
  validateTaskPatch,
  ALLOWED_FIELDS,
  TITLE_MAX,
  DESCRIPTION_MAX,
  DEFAULT_PRIORITY,
};
