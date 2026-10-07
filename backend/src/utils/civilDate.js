const CIVIL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Vérifie qu'une chaîne est une date civile réelle au format YYYY-MM-DD.
 * "2026-02-30" a le bon format mais n'existe pas : on reconstruit la date en UTC
 * et on vérifie que JavaScript n'a pas "débordé" sur le mois suivant.
 */
function isCivilDate(value) {
  if (typeof value !== 'string') return false;
  const match = CIVIL_DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Date civile du jour côté serveur (UTC), au format YYYY-MM-DD. */
function todayCivilDate() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = { isCivilDate, todayCivilDate };
