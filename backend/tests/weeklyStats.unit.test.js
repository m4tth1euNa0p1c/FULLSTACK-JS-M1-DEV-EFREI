const { toCivilDate, addDays, weekStartOf, computeWeeklyStats } = require('../src/utils/weeklyStats');

/**
 * Bonus B4 : tests unitaires du calcul (aucune base de données).
 * Les règles testées ici sont celles documentées en tête de utils/weeklyStats.js.
 */
const at = (iso) => new Date(iso);

describe('toCivilDate : rattachement d’un instant à une date civile', () => {
  it('lit la date en UTC sans décalage', () => {
    expect(toCivilDate(at('2026-10-04T22:30:00Z'))).toBe('2026-10-04');
  });

  it('applique le décalage du client (Paris en été : -120 minutes → UTC+2)', () => {
    expect(toCivilDate(at('2026-10-04T22:30:00Z'), -120)).toBe('2026-10-05');
  });

  it('applique un décalage négatif (UTC-5 → +300 minutes)', () => {
    expect(toCivilDate(at('2026-10-05T03:00:00Z'), 300)).toBe('2026-10-04');
  });
});

describe('weekStartOf et addDays', () => {
  it.each([
    ['2026-10-07', '2026-10-05'], // mercredi → lundi
    ['2026-10-05', '2026-10-05'], // lundi → lui-même
    ['2026-10-11', '2026-10-05'], // dimanche → lundi précédent
    ['2026-01-01', '2025-12-29'], // changement d’année
    ['2028-02-29', '2028-02-28'], // année bissextile
  ])('weekStartOf(%s) = %s', (civil, expected) => {
    expect(weekStartOf(civil)).toBe(expected);
  });

  it('addDays traverse les mois et les années', () => {
    expect(addDays('2026-10-05', 6)).toBe('2026-10-11');
    expect(addDays('2026-10-05', -7)).toBe('2026-09-28');
    expect(addDays('2026-12-29', 6)).toBe('2027-01-04');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('computeWeeklyStats', () => {
  const TODAY = '2026-10-07';
  const tasks = [
    // créée puis terminée dans la semaine 1 (21 → 27 sept.)
    { status: 'done', createdAt: at('2026-09-22T09:00:00Z'), completedAt: at('2026-09-25T17:00:00Z') },
    // créée semaine 1, terminée semaine 2 (28 sept. → 4 oct.)
    { status: 'done', createdAt: at('2026-09-23T09:00:00Z'), completedAt: at('2026-10-01T10:00:00Z') },
    // créée semaine 2, toujours ouverte
    { status: 'doing', createdAt: at('2026-09-30T09:00:00Z'), completedAt: null },
    // créée et terminée semaine 3 (5 → 11 oct.)
    { status: 'done', createdAt: at('2026-10-06T08:00:00Z'), completedAt: at('2026-10-06T12:00:00Z') },
    // créée semaine 3, ouverte
    { status: 'todo', createdAt: at('2026-10-07T08:00:00Z'), completedAt: null },
  ];

  it('produit une série du lundi au dimanche, la dernière semaine contenant today', () => {
    const { series } = computeWeeklyStats(tasks, { weeks: 3, today: TODAY });
    expect(series.map((week) => [week.weekStart, week.weekEnd])).toEqual([
      ['2026-09-21', '2026-09-27'],
      ['2026-09-28', '2026-10-04'],
      ['2026-10-05', '2026-10-11'],
    ]);
  });

  it('compte created, completed et open selon les définitions documentées', () => {
    const { series } = computeWeeklyStats(tasks, { weeks: 3, today: TODAY });
    expect(series[0]).toMatchObject({ created: 2, completed: 1, open: 2, completionRate: 0.5 });
    expect(series[1]).toMatchObject({ created: 1, completed: 1, open: 2, completionRate: 0.5 });
    expect(series[2]).toMatchObject({ created: 2, completed: 1, open: 3, completionRate: 0.3333 });
  });

  it('calcule le taux global et la tendance entre les deux dernières semaines', () => {
    const { overall, trend } = computeWeeklyStats(tasks, { weeks: 3, today: TODAY });
    expect(overall).toEqual({ total: 5, done: 3, completionRate: 0.6 });
    expect(trend).toEqual({ currentRate: 0.3333, previousRate: 0.5, delta: -0.1667 });
  });

  it('le taux hebdomadaire reste entre 0 et 1 (une tâche terminée était forcément ouverte)', () => {
    const { series } = computeWeeklyStats(tasks, { weeks: 6, today: TODAY });
    for (const week of series) {
      if (week.completionRate !== null) {
        expect(week.completionRate).toBeGreaterThanOrEqual(0);
        expect(week.completionRate).toBeLessThanOrEqual(1);
        expect(week.completed).toBeLessThanOrEqual(week.open);
      }
    }
  });

  it('renvoie null plutôt que 0 pour une semaine ou un compte sans donnée', () => {
    const empty = computeWeeklyStats([], { weeks: 2, today: TODAY });
    expect(empty.series).toEqual([
      { weekStart: '2026-09-28', weekEnd: '2026-10-04', created: 0, completed: 0, open: 0, completionRate: null },
      { weekStart: '2026-10-05', weekEnd: '2026-10-11', created: 0, completed: 0, open: 0, completionRate: null },
    ]);
    expect(empty.overall).toEqual({ total: 0, done: 0, completionRate: null });
    expect(empty.trend).toEqual({ currentRate: null, previousRate: null, delta: null });
  });

  it('une tâche rouverte (completedAt remis à null) compte comme ouverte, pas comme terminée', () => {
    const reopened = [{ status: 'todo', createdAt: at('2026-09-22T09:00:00Z'), completedAt: null }];
    const { series, overall } = computeWeeklyStats(reopened, { weeks: 3, today: TODAY });
    expect(series.map((week) => week.completed)).toEqual([0, 0, 0]);
    expect(series.map((week) => week.open)).toEqual([1, 1, 1]);
    expect(overall.done).toBe(0);
  });

  it('le fuseau horaire déplace une tâche terminée le dimanche soir UTC vers le lundi local', () => {
    const lateSunday = [{ status: 'done', createdAt: at('2026-10-01T09:00:00Z'), completedAt: at('2026-10-04T22:30:00Z') }];
    const utc = computeWeeklyStats(lateSunday, { weeks: 2, today: TODAY, tzOffset: 0 });
    const paris = computeWeeklyStats(lateSunday, { weeks: 2, today: TODAY, tzOffset: -120 });
    expect(utc.series.map((week) => week.completed)).toEqual([1, 0]);
    expect(paris.series.map((week) => week.completed)).toEqual([0, 1]);
  });

  it('avec une seule semaine, la tendance n’a pas de semaine précédente', () => {
    const { trend } = computeWeeklyStats(tasks, { weeks: 1, today: TODAY });
    expect(trend).toEqual({ currentRate: 0.3333, previousRate: null, delta: null });
  });
});
