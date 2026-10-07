/**
 * Bonus B4 : statistiques hebdomadaires, calcul pur (aucun accès à la base).
 *
 * Définitions (documentées aussi dans le README) :
 *  - Une semaine va du lundi au dimanche (semaine ISO). La dernière semaine de la
 *    série est celle qui contient la date de référence `today`.
 *  - Chaque instant (createdAt, completedAt) est rattaché à une date civile dans le
 *    fuseau de l'utilisateur, décrit par `tzOffset` en minutes avec la convention de
 *    JavaScript `Date.prototype.getTimezoneOffset()` (UTC − heure locale ; Paris en
 *    été = -120). Sans fuseau fourni, les dates sont lues en UTC.
 *  - Pour une semaine S :
 *      created   = tâches créées pendant S ;
 *      completed = tâches passées à done pendant S (date de completedAt) ;
 *      open      = tâches « à traiter » pendant S : créées au plus tard le dernier jour
 *                  de S et non terminées avant le premier jour de S ;
 *      completionRate = completed / open, arrondi à 4 décimales, ou null si open = 0.
 *    Une tâche terminée pendant S était forcément ouverte pendant S, donc le taux
 *    est toujours compris entre 0 et 1.
 *  - overall.completionRate = tâches done / toutes les tâches du compte (null si aucune).
 *  - trend.delta = taux de la semaine courante − taux de la semaine précédente (null si
 *    l'un des deux est indisponible).
 */
const DAY_MS = 86_400_000;

function toCivilDate(instant, tzOffsetMinutes = 0) {
  return new Date(instant.getTime() - tzOffsetMinutes * 60_000).toISOString().slice(0, 10);
}

function parseCivil(civil) {
  const [year, month, day] = civil.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function formatCivil(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function addDays(civil, days) {
  return formatCivil(parseCivil(civil) + days * DAY_MS);
}

/** Lundi de la semaine ISO contenant la date civile donnée. */
function weekStartOf(civil) {
  const ms = parseCivil(civil);
  const daysSinceMonday = (new Date(ms).getUTCDay() + 6) % 7;
  return formatCivil(ms - daysSinceMonday * DAY_MS);
}

function round4(value) {
  return Math.round(value * 10_000) / 10_000;
}

function rate(numerator, denominator) {
  return denominator > 0 ? round4(numerator / denominator) : null;
}

/**
 * @param {Array<{status: string, createdAt: Date, completedAt: Date|null}>} tasks
 * @param {{weeks: number, today: string, tzOffset?: number}} options
 */
function computeWeeklyStats(tasks, { weeks, today, tzOffset = 0 }) {
  const civilTasks = tasks.map((task) => ({
    status: task.status,
    createdDay: toCivilDate(task.createdAt, tzOffset),
    completedDay: task.completedAt ? toCivilDate(task.completedAt, tzOffset) : null,
  }));

  const currentWeekStart = weekStartOf(today);
  const series = [];
  for (let offset = weeks - 1; offset >= 0; offset -= 1) {
    const weekStart = addDays(currentWeekStart, -7 * offset);
    const weekEnd = addDays(weekStart, 6);
    let created = 0;
    let completed = 0;
    let open = 0;
    for (const task of civilTasks) {
      if (task.createdDay >= weekStart && task.createdDay <= weekEnd) created += 1;
      if (task.completedDay !== null && task.completedDay >= weekStart && task.completedDay <= weekEnd) {
        completed += 1;
      }
      if (task.createdDay <= weekEnd && (task.completedDay === null || task.completedDay >= weekStart)) {
        open += 1;
      }
    }
    series.push({ weekStart, weekEnd, created, completed, open, completionRate: rate(completed, open) });
  }

  const total = tasks.length;
  const done = tasks.filter((task) => task.status === 'done').length;
  const overall = { total, done, completionRate: rate(done, total) };

  const current = series[series.length - 1];
  const previous = series.length > 1 ? series[series.length - 2] : null;
  const trend = {
    currentRate: current.completionRate,
    previousRate: previous ? previous.completionRate : null,
    delta:
      current.completionRate !== null && previous && previous.completionRate !== null
        ? round4(current.completionRate - previous.completionRate)
        : null,
  };

  return { weeks, today, tzOffset, series, overall, trend };
}

module.exports = { toCivilDate, addDays, weekStartOf, computeWeeklyStats };
