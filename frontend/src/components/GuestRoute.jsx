import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

/**
 * Pages réservées aux visiteurs (connexion, inscription).
 * La décision est prise une seule fois, au montage : un utilisateur déjà connecté
 * est renvoyé vers ses tâches. Pendant une connexion en cours, c'est la page
 * elle-même qui navigue (avec son message de bienvenue), pas ce garde : sinon la
 * redirection automatique écraserait la navigation portant le message.
 */
export default function GuestRoute() {
  const { isAuthenticated } = useAuth();
  const [redirectToTasks] = useState(isAuthenticated);

  if (redirectToTasks) return <Navigate to="/tasks" replace />;
  return <Outlet />;
}
