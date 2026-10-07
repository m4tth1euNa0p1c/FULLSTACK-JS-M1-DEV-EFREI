import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function Layout() {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <>
      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>
      <header className="site-header">
        <div className="site-header__inner">
          <Link to="/" className="brand">
            TaskFlow
          </Link>
          <nav className="site-nav" aria-label="Navigation principale">
            {isAuthenticated ? (
              <>
                <NavLink to="/tasks" end>
                  Mes tâches
                </NavLink>
                <NavLink to="/tasks/new">Nouvelle tâche</NavLink>
                <NavLink to="/stats">Statistiques</NavLink>
                <span className="user-email">{user.email}</span>
                <button type="button" className="btn" onClick={() => logout('manual')}>
                  Se déconnecter
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login">Connexion</NavLink>
                <NavLink to="/register">Inscription</NavLink>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="contenu">
        <Outlet />
      </main>
    </>
  );
}
