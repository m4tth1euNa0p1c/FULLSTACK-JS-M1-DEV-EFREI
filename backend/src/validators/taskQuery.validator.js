const { invalidInput } = require('../utils/errors');
const { isCivilDate, todayCivilDate } = require('../utils/civilDate');
const { TASK_STATUSES, TASK_PRIORITIES } = require('../models/Task');

/**
 * Bonus B1 : paramètres de requête de GET /api/tasks et GET /api/tasks/stats.
 * Même philosophie que pour les corps JSON : liste blanche, valeurs énumérées,
 * tout écart donne 400 INVALID_INPUT. Sans paramètre, le comportement du MVP est inchangé.
 */
const DUE_FILTERS = ['overdue', 'today', 'upcoming', 'none'];
const LIST_PARAMS = ['status', 'priority', 'due', 'today'];
const STATS_PARAMS = ['today'];

function checkParams(query, allowed) {
  const unknown = Object.keys(query).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw invalidInput(`Paramètres de requête inconnus : ${unknown.join(', ')}`);
  }
}

function oneOf(query, name, values) {
  const value = query[name];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !values.includes(value)) {
    throw invalidInput(`Le paramètre ${name} doit valoir ${values.join(', ')}`);
  }
  return value;
}

/**
 * Date de référence pour "en retard", "aujourd'hui" et "à venir".
 * Le client peut l'imposer (sa date locale) ; sinon on prend la date UTC du serveur.
 */
function referenceDate(query) {
  if (query.today === undefined) return todayCivilDate();
  if (!isCivilDate(query.today)) {
    throw invalidInput('Le paramètre today doit être une date réelle au format YYYY-MM-DD');
  }
  return query.today;
}

function validateTaskListQuery(query = {}) {
  checkParams(query, LIST_PARAMS);
  return {
    status: oneOf(query, 'status', TASK_STATUSES),
    priority: oneOf(query, 'priority', TASK_PRIORITIES),
    due: oneOf(query, 'due', DUE_FILTERS),
    today: referenceDate(query),
  };
}

function validateStatsQuery(query = {}) {
  checkParams(query, STATS_PARAMS);
  return { today: referenceDate(query) };
}

module.exports = { validateTaskListQuery, validateStatsQuery, DUE_FILTERS };
