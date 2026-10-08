import { Link } from 'react-router-dom';
import { BarChart3, Lock, SlidersHorizontal } from 'lucide-react';
import PriorityBadge from '../components/PriorityBadge';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/useAuth';

// Aperçu statique de la liste, avec les mêmes composants que l'application.
const PREVIEW = [
  { id: 'p1', title: 'Relire le README avant la soutenance', status: 'todo', priority: 'high', due: '10/10/2026' },
  { id: 'p2', title: 'Préparer la démo des comptes A et B', status: 'doing', priority: 'medium', due: '09/10/2026' },
  { id: 'p3', title: 'Vérifier le build de production', status: 'done', priority: 'low', due: null },
];

const FEATURES = [
  {
    icon: Lock,
    title: 'Privé par conception',
    text: "Chaque compte ne voit que ses tâches. L'API vérifie le propriétaire à chaque requête, pas seulement l'interface.",
  },
  {
    icon: SlidersHorizontal,
    title: 'Priorités et filtres',
    text: 'Trois niveaux de priorité, des filtres par statut et par échéance, et des compteurs pour savoir où vous en êtes.',
  },
  {
    icon: BarChart3,
    title: 'Statistiques hebdomadaires',
    text: 'Le taux de complétion semaine par semaine, dans votre fuseau horaire, avec la tendance par rapport à la précédente.',
  },
];

function CheckGlyph() {
  return (
    <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
      <path
        d="M3.5 8.5l2.8 2.8L12.5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function HomePage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="home">
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

      <section className="preview" aria-labelledby="preview-title">
        <h2 id="preview-title">Aperçu de la liste</h2>
        <ul className="task-list task-list--preview">
          {PREVIEW.map((task) => (
            <li key={task.id} className="task-item">
              <span className={`check${task.status === 'done' ? ' check--done' : ''}`} aria-hidden="true">
                <CheckGlyph />
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
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="feature">
            <Icon size={18} aria-hidden="true" />
            <div>
              <h2>{title}</h2>
              <p>{text}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
