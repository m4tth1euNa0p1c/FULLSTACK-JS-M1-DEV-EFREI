import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

/**
 * Redirige vers /login si aucune session n'est ouverte.
 * Ce garde améliore l'expérience utilisateur ; la vraie protection reste
 * côté API (middleware requireAuth), qui refuse tout appel sans JWT valide.
 */
export default function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
