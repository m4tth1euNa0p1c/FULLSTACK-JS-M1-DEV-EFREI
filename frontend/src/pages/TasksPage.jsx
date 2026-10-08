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

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" focusable="false" aria-hidden="true">
      <path
        d="M3.5 8.5l2.8 2.8L12.5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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
  // "version" force un rechargement après un ajout rapide ou un changement de statut.
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState({ key: null, items: [], error: null });
  const [stats, setStats] = useState(null);
  // Message transmis par la page précédente (création, suppression...)
  const [flash, setFlash] = useState(location.state?.flash ?? null);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickError, setQuickError] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  const listKey = `${queryString}#${version}`;
  const loading = result.key !== listKey;

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
        if (!cancelled) setResult({ key: listKey, items: data.items, error: null });
      })
      .catch((err) => {
        if (!cancelled) setResult({ key: listKey, items: [], error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [request, queryString, listKey]);

  // Compteurs du compte (indépendants des filtres, rafraîchis à chaque modification).
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
  }, [request, version]);

  const updateFilter = (key) => (event) => {
    const next = { ...filters };
    if (event.target.value) next[key] = event.target.value;
    else delete next[key];
    setSearchParams(next, { replace: true });
  };

  /** Ajout rapide : titre seul, statut « à faire », priorité moyenne. */
  const handleQuickAdd = async (event) => {
    event.preventDefault();
    const title = quickTitle.trim();
    if (!title) return;
    setQuickError(null);
    setQuickBusy(true);
    try {
      const created = await request('/tasks', { method: 'POST', body: { title, status: 'todo' } });
      setQuickTitle('');
      setFlash(`Tâche « ${created.title} » ajoutée.`);
      setVersion((v) => v + 1);
    } catch (err) {
      setQuickError(err.message);
    } finally {
      setQuickBusy(false);
    }
  };

  /** Case circulaire : termine la tâche, ou la rouvre si elle était terminée. */
  const toggleDone = async (task) => {
    const status = task.status === 'done' ? 'todo' : 'done';
    setTogglingId(task.id);
    try {
      const updated = await request(`/tasks/${task.id}`, { method: 'PATCH', body: { status } });
      setResult((current) => ({
        ...current,
        items: current.items.map((item) => (item.id === updated.id ? updated : item)),
      }));
      setVersion((v) => v + 1);
    } catch (err) {
      setResult((current) => ({ ...current, error: err.message }));
    } finally {
      setTogglingId(null);
    }
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

      <form className="quick-add" onSubmit={handleQuickAdd}>
        <label htmlFor="quick-add-title" className="sr-only">
          Ajouter une tâche
        </label>
        <input
          id="quick-add-title"
          type="text"
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="Ajouter une tâche, puis Entrée"
          maxLength={120}
          autoComplete="off"
          disabled={quickBusy}
        />
        <button type="submit" className="btn btn--primary" disabled={quickBusy || !quickTitle.trim()}>
          {quickBusy ? 'Ajout…' : 'Ajouter'}
        </button>
      </form>
      {quickError && (
        <p className="field__error" role="alert">
          {quickError}
        </p>
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
              <p className="muted">Ajoutez votre première tâche ci-dessus, ou détaillez-la avec le formulaire.</p>
              <Link to="/tasks/new" className="btn btn--primary">
                Créer une tâche
              </Link>
            </>
          )}
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          <p className="muted list-count" role="status">
            {items.length} tâche{items.length > 1 ? 's' : ''}
            {hasFilters ? ' correspondant aux filtres' : ''}
          </p>
          <ul className="task-list" aria-label="Liste des tâches">
            {items.map((task) => (
              <li key={task.id} className="task-item">
                <button
                  type="button"
                  className={`check${task.status === 'done' ? ' check--done' : ''}`}
                  aria-label={task.status === 'done' ? `Rouvrir « ${task.title} »` : `Terminer « ${task.title} »`}
                  aria-pressed={task.status === 'done'}
                  onClick={() => toggleDone(task)}
                  disabled={togglingId === task.id}
                >
                  <CheckIcon />
                </button>
                <Link
                  to={`/tasks/${task.id}`}
                  className={`task-item__title${task.status === 'done' ? ' task-item__title--done' : ''}`}
                >
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
