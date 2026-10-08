import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import PriorityBadge from '../components/PriorityBadge';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/useAuth';

/**
 * Fond animé de l'accueil : trois halos flous qui dérivent lentement (CSS) et se
 * décalent au défilement (parallaxe, mise à jour d'une variable CSS sans re-rendu).
 * Entièrement désactivé si l'utilisateur préfère réduire les animations.
 */
function useParallaxBackdrop() {
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        element.style.setProperty('--parallax', `${Math.round(window.scrollY * 0.25)}px`);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return ref;
}

// Aperçu statique de la liste, avec les mêmes composants que l'application.
const PREVIEW = [
  { id: 'p1', title: 'Relire le README avant la soutenance', status: 'todo', priority: 'high', due: '10/10/2026' },
  { id: 'p2', title: 'Préparer la démo des comptes A et B', status: 'doing', priority: 'medium', due: '09/10/2026' },
  { id: 'p3', title: 'Vérifier le build de production', status: 'done', priority: 'low', due: null },
];

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const backdrop = useParallaxBackdrop();

  return (
    <div className="home">
      <div className="home__backdrop" ref={backdrop} aria-hidden="true">
        <span className="blob blob--1" />
        <span className="blob blob--2" />
        <span className="blob blob--3" />
      </div>

      <section className="hero" aria-labelledby="home-title">
        <h1 id="home-title" className="hero__title">
          Vos tâches, rien que les vôtres.
        </h1>
        <p className="hero__lead">
          TaskFlow garde votre liste privée, la trie par priorité et vous montre chaque semaine ce que vous avez
          réellement terminé.
        </p>
        <div className="hero__actions">
          {isAuthenticated ? (
            <Link to="/tasks" className="btn btn--primary">
              Ouvrir mes tâches
            </Link>
          ) : (
            <>
              <Link to="/register" className="btn btn--primary">
                Créer un compte
              </Link>
              <Link to="/login" className="btn">
                Se connecter
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="preview" aria-label="Aperçu de la liste de tâches">
        <ul className="task-list task-list--preview">
          {PREVIEW.map((task) => (
            <li key={task.id} className="task-item">
              <span className={`check${task.status === 'done' ? ' check--done' : ''}`} aria-hidden="true">
                <svg viewBox="0 0 16 16" width="12" height="12" focusable="false">
                  <path d="M3.5 8.5l2.8 2.8L12.5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className={`task-item__title${task.status === 'done' ? ' task-item__title--done' : ''}`}>
                {task.title}
              </span>
              <span className="task-item__meta">
                <StatusBadge status={task.status} />
                <PriorityBadge priority={task.priority} />
                <span>{task.due ? `Échéance : ${task.due}` : 'Sans échéance'}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="features" aria-label="Ce que fait TaskFlow">
        <div className="feature">
          <h2>Privé par conception</h2>
          <p>
            Chaque compte ne voit que ses tâches. L'API vérifie le propriétaire à chaque requête, pas seulement
            l'interface.
          </p>
        </div>
        <div className="feature">
          <h2>Priorités et filtres</h2>
          <p>
            Trois niveaux de priorité, des filtres par statut et par échéance, et des compteurs pour savoir où vous
            en êtes.
          </p>
        </div>
        <div className="feature">
          <h2>Statistiques hebdomadaires</h2>
          <p>Le taux de complétion semaine par semaine, dans votre fuseau horaire, avec la tendance par rapport à la précédente.</p>
        </div>
      </section>
    </div>
  );
}
