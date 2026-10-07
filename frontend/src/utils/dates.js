/**
 * Date civile locale du navigateur au format YYYY-MM-DD.
 * Envoyée à l'API comme date de référence (paramètre "today") pour que
 * "en retard" et "aujourd'hui" suivent le fuseau horaire de l'utilisateur,
 * et non la date UTC du serveur.
 */
export function localCivilDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Décalage du navigateur en minutes (convention JavaScript : UTC − heure locale,
 * Paris en été = -120). Transmis à l'API (paramètre "tzOffset") pour rattacher
 * les instants aux bonnes semaines dans les statistiques (bonus B4).
 */
export function tzOffsetMinutes(date = new Date()) {
  return date.getTimezoneOffset();
}

/** "2026-10-05" → "05/10/2026" ; null → texte de repli. */
export function formatCivilDate(isoDate, fallback = 'Aucune') {
  if (!isoDate) return fallback;
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

/** "2026-10-05" → "05/10" (libellé court d'axe). */
export function formatShortDate(isoDate) {
  const [, month, day] = isoDate.split('-');
  return `${day}/${month}`;
}

/** Instant ISO → "5 oct. 2026, 14:30" dans la locale française. */
export function formatDateTime(isoInstant) {
  if (!isoInstant) return '';
  return new Date(isoInstant).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

/** 0.3333 → "33 %" ; null → "—". */
export function formatPercent(rate) {
  if (rate === null || rate === undefined) return '—';
  return `${Math.round(rate * 100)} %`;
}
