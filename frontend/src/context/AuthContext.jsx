import { createContext, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { isTokenExpired } from '../api/jwt';

/**
 * Stratégie de session : le JWT et l'utilisateur sont conservés dans localStorage
 * pour survivre à un rechargement de page, puis envoyés en Bearer à chaque appel.
 * Compromis : localStorage est lisible par tout script de la page (risque XSS),
 * mais évite la complexité des cookies httpOnly + protection CSRF. Le jeton
 * expire côté serveur (JWT_EXPIRES_IN) : une réponse 401 déconnecte l'utilisateur.
 */
const STORAGE_KEY = 'taskflow.session';

function readStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session?.token || !session?.user || isTokenExpired(session.token)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [session, setSession] = useState(readStoredSession);
  // Message affiché sur la page de connexion (session expirée, déconnexion).
  const [notice, setNotice] = useState(null);

  const saveSession = useCallback((data) => {
    const next = { token: data.token, user: data.user };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSession(next);
    setNotice(null);
  }, []);

  const logout = useCallback(
    (reason = 'manual') => {
      localStorage.removeItem(STORAGE_KEY);
      setSession(null);
      setNotice(
        reason === 'expired'
          ? 'Votre session a expiré. Merci de vous reconnecter.'
          : 'Vous êtes déconnecté.',
      );
      navigate('/login', { replace: true });
    },
    [navigate],
  );

  const register = useCallback(
    async (credentials) => {
      const data = await apiRequest('/auth/register', { method: 'POST', body: credentials });
      saveSession(data);
    },
    [saveSession],
  );

  const login = useCallback(
    async (credentials) => {
      const data = await apiRequest('/auth/login', { method: 'POST', body: credentials });
      saveSession(data);
    },
    [saveSession],
  );

  /**
   * Appel API authentifié. Un 401 alors qu'une session existe signifie
   * que le jeton est expiré ou invalide : on déconnecte proprement.
   */
  const request = useCallback(
    async (path, options = {}) => {
      try {
        return await apiRequest(path, { ...options, token: session?.token });
      } catch (err) {
        if (err.status === 401 && session) {
          logout('expired');
        }
        throw err;
      }
    },
    [session, logout],
  );

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      isAuthenticated: Boolean(session),
      register,
      login,
      logout,
      request,
      notice,
      clearNotice: () => setNotice(null),
    }),
    [session, register, login, logout, request, notice],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
