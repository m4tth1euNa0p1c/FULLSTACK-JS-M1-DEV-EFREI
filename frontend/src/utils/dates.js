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

/** "2026-10-05" → "05/10/2026" ; null → texte de repli. */
export function formatCivilDate(isoDate, fallback = 'Aucune') {
  if (!isoDate) return fallback;
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}
