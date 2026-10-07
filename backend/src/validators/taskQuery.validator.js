const { invalidInput } = require('../utils/errors');
const { isCivilDate, todayCivilDate } = require('../utils/civilDate');
const { TASK_STATUSES, TASK_PRIORITIES } = require('../models/Task');

/**
 * Paramètres de requête des routes de liste et de statistiques (bonus B1 et B4).
 * Même philosophie que pour les corps JSON : liste blanche, valeurs énumérées,
 * tout écart donne 400 INVALID_INPUT. Sans paramètre, le comportement du MVP est inchangé.
 */
const DUE_FILTERS = ['overdue', 'today', 'upcoming', 'none'];
const LIST_PARAMS = ['status', 'priority', 'due', 'today'];
const STATS_PARAMS = ['today'];
const WEEKLY_PARAMS = ['weeks', 'today', 'tzOffset'];

const WEEKS_DEFAULT = 8;
const WEEKS_MAX = 26;
// Décalage horaire maximal existant : 14 h (UTC+14 / UTC-12), en minutes.
const TZ_OFFSET_MAX = 14 * 60;

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

function integerParam(query, name, { min, max, defaultValue }) {
  const value = query[name];
  if (value === undefined) return defaultValue;
  if (typeof value !== 'string' || !/^-?\d+$/.test(value)) {
    throw invalidInput(`Le paramètre ${name} doit être un entier`);
  }
  const number = Number(value);
  if (number < min || number > max) {
    throw invalidInput(`Le paramètre ${name} doit être compris entre ${min} et ${max}`);
  }
  return number;
}

/**
 * Date de référence pour "en retard", "aujourd'hui", "à venir" et la semaine courante.
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

/** Bonus B4 : nombre de semaines, date de référence et décalage horaire du client. */
function validateWeeklyStatsQuery(query = {}) {
  checkParams(query, WEEKLY_PARAMS);
  return {
    weeks: integerParam(query, 'weeks', { min: 1, max: WEEKS_MAX, defaultValue: WEEKS_DEFAULT }),
    today: referenceDate(query),
    tzOffset: integerParam(query, 'tzOffset', { min: -TZ_OFFSET_MAX, max: TZ_OFFSET_MAX, defaultValue: 0 }),
  };
}

module.exports = {
  validateTaskListQuery,
  validateStatsQuery,
  validateWeeklyStatsQuery,
  DUE_FILTERS,
  WEEKS_DEFAULT,
  WEEKS_MAX,
};
