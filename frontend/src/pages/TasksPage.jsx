import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Alert from '../components/Alert';
import PriorityBadge from '../components/PriorityBadge';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/useAuth';
import { formatCivilDate, localCivilDate } from '../utils/dates';
import { DUE_FILTER_LABELS, PRIORITY_LABELS, STATUS_LABELS } from '../utils/taskStatus';

// Bonus B1 : les filtres vivent dans l'URL (?status=todo&priority=high&due=overdue)
// pour survivre au rechargement et au bouton Retour.
const FILTER_KEYS = ['status', 'priority', 'due'];

function readFilters(searchParams) {
  const filters = {};
  for (const key of FILTER_KEYS) {
    const value = searchParams.get(key);
    if (value) filters[key] = value;
  }
  return filters;
}

/** Construit la chaîne de requête envoyée à l'API, avec la date locale comme référence. */
function toQueryString(filters) {
  const params = new URLSearchParams(filters);
  if (filters.due && filters.due !== 'none') params.set('today', localCivilDate());
  const query = params.toString();
  return query ? `?${query}` : '';
}

export default function TasksPage() {
  const { request } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readFilters(searchParams);
  const queryString = toQueryString(filters);
  const hasFilters = Object.keys(filters).length > 0;

  // Résultat de la dernière requête de liste : tant que sa clé diffère de la
  // requête courante, on est en chargement (pas de setState synchrone dans l'effet).
  const [result, setResult] = useState({ query: null, items: [], error: null });
  const [stats, setStats] = useState(null);
  // Message transmis par la page précédente (création, suppression...)
  const [flash, setFlash] = useState(location.state?.flash ?? null);

  const loading = result.query !== queryString;

  useEffect(() => {
    // On efface le message de l'historique pour qu'il ne réapparaisse pas au rechargement.
    if (location.state?.flash) {
      navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    }
  }, [location, navigate]);

  useEffect(() => {
    let cancelled = false;
    request(`/tasks${queryString}`)
      .then((data) => {
        if (!cancelled) setResult({ query: queryString, items: data.items, error: null });
      })
      .catch((err) => {
        if (!cancelled) setResult({ query: queryString, items: [], error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [request, queryString]);

  // Compteurs du compte (indépendants des filtres).
  useEffect(() => {
    let cancelled = false;
    request(`/tasks/stats?today=${localCivilDate()}`)
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      });
    return () => {
      cancelled = true;
    };
  }, [request]);

  const updateFilter = (key) => (event) => {
    const next = { ...filters };
    if (event.target.value) next[key] = event.target.value;
    else delete next[key];
    setSearchParams(next, { replace: true });
  };

  const { items, error } = result;

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

      {stats && (
        <ul className="stats" aria-label="Compteurs de tâches">
          <li className="stat">
            <span className="stat__value">{stats.total}</span>
            <span className="stat__label">au total</span>
          </li>
          <li className="stat">
            <span className="stat__value">{stats.byStatus.todo}</span>
            <span className="stat__label">à faire</span>
          </li>
          <li className="stat">
            <span className="stat__value">{stats.byStatus.doing}</span>
            <span className="stat__label">en cours</span>
          </li>
          <li className="stat">
            <span className="stat__value">{stats.byStatus.done}</span>
            <span className="stat__label">terminées</span>
          </li>
          <li className={`stat${stats.overdue > 0 ? ' stat--alert' : ''}`}>
            <span className="stat__value">{stats.overdue}</span>
            <span className="stat__label">en retard</span>
          </li>
        </ul>
      )}

      <form className="filters card" aria-label="Filtres" onSubmit={(e) => e.preventDefault()}>
        <div className="field">
          <label htmlFor="filter-status">Statut</label>
          <select id="filter-status" value={filters.status ?? ''} onChange={updateFilter('status')}>
            <option value="">Tous</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-priority">Priorité</label>
          <select id="filter-priority" value={filters.priority ?? ''} onChange={updateFilter('priority')}>
            <option value="">Toutes</option>
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-due">Échéance</label>
          <select id="filter-due" value={filters.due ?? ''} onChange={updateFilter('due')}>
            <option value="">Toutes</option>
            {Object.entries(DUE_FILTER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="filters__actions">
          <button
            type="button"
            className="btn"
            onClick={() => setSearchParams({}, { replace: true })}
            disabled={!hasFilters}
          >
            Réinitialiser
          </button>
        </div>
      </form>

      {loading && (
        <p className="muted" role="status">
          Chargement des tâches…
        </p>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="card empty-state">
          {hasFilters ? (
            <>
              <h2>Aucune tâche ne correspond à ces filtres</h2>
              <button type="button" className="btn" onClick={() => setSearchParams({}, { replace: true })}>
                Afficher toutes les tâches
              </button>
            </>
          ) : (
            <>
              <h2>Aucune tâche pour l’instant</h2>
              <p className="muted">Commencez par créer votre première tâche.</p>
              <Link to="/tasks/new" className="btn btn--primary">
                Créer une tâche
              </Link>
            </>
          )}
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          <p className="muted" role="status">
            {items.length} tâche{items.length > 1 ? 's' : ''}
            {hasFilters ? ' correspondant aux filtres' : ''}
          </p>
          <ul className="task-list" aria-label="Liste des tâches">
            {items.map((task) => (
              <li key={task.id} className="task-item">
                <Link to={`/tasks/${task.id}`} className="task-item__title">
                  {task.title}
                </Link>
                <div className="task-item__meta">
                  <StatusBadge status={task.status} />
                  <PriorityBadge priority={task.priority} />
                  <span>{task.dueDate ? `Échéance : ${formatCivilDate(task.dueDate)}` : 'Sans échéance'}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
