import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function Layout() {
  const { isAuthenticated, user, logout } = useAuth();
  // Menu replié sur mobile ; refermé dès qu'un lien est suivi.
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>

      <header className="site-header">
        <div className="site-header__inner">
          <Link to="/" className="brand">
            <span className="brand__mark" aria-hidden="true" />
            TaskFlow
          </Link>

          <button
            type="button"
            className="nav-toggle"
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="sr-only">{menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}</span>
            <span className="nav-toggle__bar" aria-hidden="true" />
            <span className="nav-toggle__bar" aria-hidden="true" />
            <span className="nav-toggle__bar" aria-hidden="true" />
          </button>

          <nav
            id="site-menu"
            className={`site-nav${menuOpen ? ' site-nav--open' : ''}`}
            aria-label="Navigation principale"
          >
            {isAuthenticated ? (
              <>
                <NavLink to="/tasks" end onClick={closeMenu}>
                  Mes tâches
                </NavLink>
                <NavLink to="/tasks/new" onClick={closeMenu}>
                  Nouvelle tâche
                </NavLink>
                <NavLink to="/stats" onClick={closeMenu}>
                  Statistiques
                </NavLink>
                <div className="site-nav__user">
                  <span className="user-email">{user.email}</span>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      closeMenu();
                      logout('manual');
                    }}
                  >
                    Se déconnecter
                  </button>
                </div>
              </>
            ) : (
              <>
                <NavLink to="/login" onClick={closeMenu}>
                  Connexion
                </NavLink>
                <NavLink to="/register" onClick={closeMenu}>
                  Inscription
                </NavLink>
              </>
            )}
          </nav>
        </div>
      </header>

      <main id="contenu" className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="site-footer__inner">
          <div className="site-footer__brand">
            <span className="brand">
              <span className="brand__mark" aria-hidden="true" />
              TaskFlow
            </span>
            <p className="muted">Vos tâches, rien que les vôtres.</p>
          </div>

          <nav className="site-footer__links" aria-label="Pied de page">
            {isAuthenticated && (
              <div>
                <h2 className="site-footer__title">Application</h2>
                <ul>
                  <li>
                    <Link to="/tasks">Mes tâches</Link>
                  </li>
                  <li>
                    <Link to="/tasks/new">Nouvelle tâche</Link>
                  </li>
                  <li>
                    <Link to="/stats">Statistiques</Link>
                  </li>
                </ul>
              </div>
            )}
            <div>
              <h2 className="site-footer__title">API</h2>
              <ul>
                <li>
                  <a href="/api/docs">Documentation Swagger</a>
                </li>
                <li>
                  <a href="/api/health">État du service</a>
                </li>
              </ul>
            </div>
          </nav>

          <p className="site-footer__legal">Projet Full Stack JS, EFREI Master 1. Version {__APP_VERSION__}.</p>
        </div>
      </footer>
    </>
  );
}
