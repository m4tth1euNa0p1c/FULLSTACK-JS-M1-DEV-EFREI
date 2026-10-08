import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Alert from '../components/Alert';
import { useAuth } from '../context/useAuth';
import { formatPercent, formatShortDate, localCivilDate, tzOffsetMinutes } from '../utils/dates';

/**
 * Bonus B4 : taux de complétion hebdomadaire et évolution par semaine.
 * Le calcul est fait par l'API (GET /api/tasks/stats/weekly) ; cette page
 * l'affiche sous trois formes complémentaires : chiffres clés, graphique
 * en barres (une seule série : le taux par semaine) et tableau détaillé.
 */
const WEEK_OPTIONS = [4, 8, 12, 26];

function readWeeks(searchParams) {
  const value = Number(searchParams.get('weeks'));
  return WEEK_OPTIONS.includes(value) ? value : 8;
}

function describeWeek(week) {
  const rate = week.completionRate === null ? 'sans donnée' : formatPercent(week.completionRate);
  return `Semaine du ${formatShortDate(week.weekStart)} au ${formatShortDate(week.weekEnd)} : ${rate}, ${week.completed} terminée${week.completed > 1 ? 's' : ''} sur ${week.open} ouverte${week.open > 1 ? 's' : ''}, ${week.created} créée${week.created > 1 ? 's' : ''}`;
}

function TrendLabel({ trend }) {
  if (trend.delta === null) {
    return <span className="muted">Pas assez de données pour comparer à la semaine précédente.</span>;
  }
  const points = Math.round(trend.delta * 100);
  if (points === 0) return <span>Stable par rapport à la semaine précédente.</span>;
  const up = points > 0;
  return (
    <span className={up ? 'trend trend--up' : 'trend trend--down'}>
      <span aria-hidden="true">{up ? '▲' : '▼'}</span> {up ? '+' : ''}
      {points} points par rapport à la semaine précédente ({formatPercent(trend.previousRate)}).
    </span>
  );
}

export default function StatsPage() {
  const { request } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const weeks = readWeeks(searchParams);
  const query = `/tasks/stats/weekly?weeks=${weeks}&today=${localCivilDate()}&tzOffset=${tzOffsetMinutes()}`;
  const [result, setResult] = useState({ query: null, data: null, error: null });
  const loading = result.query !== query;

  useEffect(() => {
    let cancelled = false;
    request(query)
      .then((data) => {
        if (!cancelled) setResult({ query, data, error: null });
      })
      .catch((err) => {
        if (!cancelled) setResult({ query, data: null, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [request, query]);

  const { data, error } = result;
  const current = data ? data.series[data.series.length - 1] : null;

  return (
    <section aria-labelledby="stats-title">
      <div className="page-header">
        <h1 id="stats-title">Statistiques</h1>
        <Link to="/tasks" className="btn btn--ghost">
          Retour aux tâches
        </Link>
      </div>

      <Alert type="error">{error}</Alert>

      <form className="filters card" aria-label="Période" onSubmit={(e) => e.preventDefault()}>
        <div className="field">
          <label htmlFor="stats-weeks">Période affichée</label>
          <select
            id="stats-weeks"
            value={weeks}
            onChange={(e) => setSearchParams({ weeks: e.target.value }, { replace: true })}
          >
            {WEEK_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} semaines
              </option>
            ))}
          </select>
        </div>
        <p className="muted filters__note">
          Semaines du lundi au dimanche, dans votre fuseau horaire. Taux = tâches terminées pendant la semaine
          ÷ tâches ouvertes au cours de la semaine.
        </p>
      </form>

      {loading && (
        <p className="muted" role="status">
          Chargement des statistiques…
        </p>
      )}

      {!loading && data && (
        <>
          <ul className="stats" aria-label="Chiffres clés">
            <li className="stat">
              <span className="stat__value">{formatPercent(data.overall.completionRate)}</span>
              <span className="stat__label">
                terminées au total ({data.overall.done} sur {data.overall.total})
              </span>
            </li>
            <li className="stat">
              <span className="stat__value">{formatPercent(current.completionRate)}</span>
              <span className="stat__label">
                cette semaine ({current.completed} sur {current.open} ouverte{current.open > 1 ? 's' : ''})
              </span>
            </li>
            <li className="stat">
              <span className="stat__value">{current.created}</span>
              <span className="stat__label">créée{current.created > 1 ? 's' : ''} cette semaine</span>
            </li>
          </ul>

          <p className="trend-line">
            <TrendLabel trend={data.trend} />
          </p>

          <div className="card chart" aria-labelledby="chart-title">
            <h2 id="chart-title">Taux de complétion par semaine</h2>
            <div className="chart__plot">
              <div className="chart__grid" aria-hidden="true">
                <span>100 %</span>
                <span>50 %</span>
                <span>0 %</span>
              </div>
              <ol className="chart__bars" aria-label="Taux de complétion par semaine">
                {data.series.map((week, index) => {
                  const isCurrent = index === data.series.length - 1;
                  const height = week.completionRate === null ? 0 : Math.round(week.completionRate * 100);
                  return (
                    <li key={week.weekStart} className={`bar${isCurrent ? ' bar--current' : ''}`}>
                      <button type="button" className="bar__hit" aria-label={describeWeek(week)}>
                        {week.completionRate === null ? (
                          <span className="bar__empty" aria-hidden="true" />
                        ) : (
                          <span className="bar__fill" style={{ height: `${Math.max(height, 2)}%` }} aria-hidden="true">
                            {isCurrent && <span className="bar__value">{formatPercent(week.completionRate)}</span>}
                          </span>
                        )}
                        <span className="bar__tooltip" role="tooltip">
                          <strong>{formatPercent(week.completionRate)}</strong>
                          <br />
                          {week.completed} terminée{week.completed > 1 ? 's' : ''} / {week.open} ouverte
                          {week.open > 1 ? 's' : ''}
                          <br />
                          {week.created} créée{week.created > 1 ? 's' : ''}
                        </span>
                      </button>
                      <span className="bar__label" aria-hidden="true">
                        {formatShortDate(week.weekStart)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>

          <div className="card">
            <h2>Détail par semaine</h2>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Semaine</th>
                    <th scope="col">Créées</th>
                    <th scope="col">Terminées</th>
                    <th scope="col">Ouvertes</th>
                    <th scope="col">Taux</th>
                  </tr>
                </thead>
                <tbody>
                  {data.series.map((week, index) => (
                    <tr key={week.weekStart} className={index === data.series.length - 1 ? 'table__current' : ''}>
                      <th scope="row">
                        du {formatShortDate(week.weekStart)} au {formatShortDate(week.weekEnd)}
                      </th>
                      <td>{week.created}</td>
                      <td>{week.completed}</td>
                      <td>{week.open}</td>
                      <td>{formatPercent(week.completionRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
