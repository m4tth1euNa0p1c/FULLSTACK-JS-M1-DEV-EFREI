/**
 * Client HTTP minimal autour de fetch.
 * - Préfixe toutes les routes par /api (relayé par Vite en dev, ou VITE_API_URL).
 * - Sérialise le corps en JSON et ajoute l'en-tête Authorization: Bearer <jwt>.
 * - Transforme les erreurs contractuelles {"error":{"code","message"}} en ApiError.
 */
const API_BASE = `${import.meta.env.VITE_API_URL ?? ''}/api`;

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest(path, { method = 'GET', body, token } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', "Impossible de joindre l'API. Vérifiez que le serveur est démarré.");
  }

  // 204 : succès sans corps (DELETE)
  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = data?.error ?? {};
    throw new ApiError(
      response.status,
      error.code ?? 'UNKNOWN_ERROR',
      error.message ?? `Erreur ${response.status}`,
    );
  }
  return data;
}
