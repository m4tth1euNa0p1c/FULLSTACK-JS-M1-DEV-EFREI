import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { BarChart3, ListTodo, LogIn, Plus, UserPlus } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { cn } from '../lib/cn';

function Brand({ onClick }) {
  return (
    <Link to="/" className="brand" onClick={onClick}>
      <span className="brand__mark" aria-hidden="true">
        T
      </span>
      TaskFlow
    </Link>
  );
}

export default function Layout() {
  const { isAuthenticated, user, logout } = useAuth();
  // Sur mobile, la barre latérale devient un tiroir ; il se referme dès qu'un lien est suivi.
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="app">
      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>

      <header className="topbar">
        <Brand onClick={closeMenu} />
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
      </header>

      {menuOpen && <div className="sidebar-backdrop" onClick={closeMenu} aria-hidden="true" />}

      <aside className={cn('sidebar', menuOpen && 'sidebar--open')}>
        <Brand onClick={closeMenu} />
        <nav
          id="site-menu"
          className={cn('site-nav', menuOpen && 'site-nav--open')}
          aria-label="Navigation principale"
        >
          {isAuthenticated ? (
            <>
              <NavLink to="/tasks" end className="nav-item" onClick={closeMenu}>
                <ListTodo size={16} aria-hidden="true" />
                Mes tâches
              </NavLink>
              <NavLink to="/tasks/new" className="nav-item" onClick={closeMenu}>
                <Plus size={16} aria-hidden="true" />
                Nouvelle tâche
              </NavLink>
              <NavLink to="/stats" className="nav-item" onClick={closeMenu}>
                <BarChart3 size={16} aria-hidden="true" />
                Statistiques
              </NavLink>
              <div className="site-nav__section">
                <span className="user-email">{user.email}</span>
                <button
                  type="button"
                  className="btn btn--ghost"
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
              <NavLink to="/login" className="nav-item" onClick={closeMenu}>
                <LogIn size={16} aria-hidden="true" />
                Connexion
              </NavLink>
              <NavLink to="/register" className="nav-item" onClick={closeMenu}>
                <UserPlus size={16} aria-hidden="true" />
                Inscription
              </NavLink>
            </>
          )}
        </nav>
      </aside>

      <div className="content">
        <main id="contenu" className="site-main">
          <Outlet />
        </main>

        <footer className="site-footer">
          <span>TaskFlow, projet Full Stack JS, EFREI Master 1. Version {__APP_VERSION__}.</span>
          <nav className="site-footer__links" aria-label="Pied de page">
            <a href="/api/docs">Documentation Swagger</a>
            <a href="/api/health">État du service</a>
          </nav>
        </footer>
      </div>
    </div>
  );
}
