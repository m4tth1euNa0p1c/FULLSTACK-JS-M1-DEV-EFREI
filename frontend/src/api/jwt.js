/**
 * Lit la date d'expiration (claim "exp") d'un JWT sans le vérifier.
 * Le navigateur ne connaît pas la clé de signature : seule l'API fait foi.
 * On s'en sert uniquement pour ne pas démarrer avec un jeton déjà périmé.
 */
export function isTokenExpired(token) {
  try {
    const payloadBase64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(payloadBase64));
    if (typeof payload.exp !== 'number') return false;
    return payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}
