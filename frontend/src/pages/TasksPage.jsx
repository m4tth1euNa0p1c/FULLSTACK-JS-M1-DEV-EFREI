import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Alert from '../components/Alert';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/useAuth';

function formatDate(isoDate) {
  if (!isoDate) return 'Sans échéance';
  const [year, month, day] = isoDate.split('-');
  return `Échéance : ${day}/${month}/${year}`;
}

export default function TasksPage() {
  const { request } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Message transmis par la page précédente (création, suppression...)
  const [flash, setFlash] = useState(location.state?.flash ?? null);

  useEffect(() => {
    // On efface le message de l'historique pour qu'il ne réapparaisse pas au rechargement.
    if (location.state?.flash) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);

  useEffect(() => {
    let cancelled = false;
    request('/tasks')
      .then((data) => {
        if (!cancelled) setTasks(data.items);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [request]);

  return (
    <section aria-labelledby="tasks-title">
      <div className="page-header">
        <h1 id="tasks-title">Mes tâches</h1>
        <Link to="/tasks/new" className="btn btn--primary">
          Nouvelle tâche
        </Link>
      </div>

      <Alert type="success">
        {flash && (
          <>
            {flash}{' '}
            <button type="button" className="btn btn--link" onClick={() => setFlash(null)}>
              Fermer
            </button>
          </>
        )}
      </Alert>
      <Alert type="error">{error}</Alert>

      {loading && (
        <p className="muted" role="status">
          Chargement des tâches…
        </p>
      )}

      {!loading && !error && tasks.length === 0 && (
        <div className="card empty-state">
          <h2>Aucune tâche pour l’instant</h2>
          <p className="muted">Commencez par créer votre première tâche.</p>
          <Link to="/tasks/new" className="btn btn--primary">
            Créer une tâche
          </Link>
        </div>
      )}

      {!loading && tasks.length > 0 && (
        <ul className="task-list" aria-label="Liste des tâches">
          {tasks.map((task) => (
            <li key={task.id} className="card task-item">
              <Link to={`/tasks/${task.id}`} className="task-item__title">
                {task.title}
              </Link>
              <div className="task-item__meta">
                <StatusBadge status={task.status} />
                <span>{formatDate(task.dueDate)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
