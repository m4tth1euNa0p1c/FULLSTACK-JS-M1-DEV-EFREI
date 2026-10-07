#!/usr/bin/env node
/**
 * Recette automatisée du contrat API (partie 7 du livret), à lancer contre une API démarrée :
 *   node scripts/recette.js            (API sur http://localhost:3000)
 *   API_URL=http://localhost:4000/api node scripts/recette.js
 *
 * Le script utilise deux comptes fixes A et B (recette.a@example.test, recette.b@example.test),
 * remet leurs tâches à zéro, puis vérifie chaque point : codes HTTP, enveloppes JSON, validation,
 * isolation A/B. Il laisse volontairement une tâche en base et affiche la commande curl à rejouer
 * après un redémarrage de l'API pour constater la persistance.
 */
const API = process.env.API_URL || 'http://localhost:3000/api';
const PASSWORD = 'MotDePasse123!';
const results = [];

function report(label, ok, detail = '') {
  results.push({ label, ok });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${detail ? `  (${detail})` : ''}`);
}

async function call(method, path, { body, token, raw } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, text, json, contentType: res.headers.get('content-type') || '' };
}

function isError(res, status, code) {
  return (
    res.status === status &&
    res.json &&
    res.json.error &&
    res.json.error.code === code &&
    typeof res.json.error.message === 'string' &&
    res.json.error.message.length > 0
  );
}

async function session(email) {
  let res = await call('POST', '/auth/register', { body: { email, password: PASSWORD } });
  if (res.status === 409) res = await call('POST', '/auth/login', { body: { email, password: PASSWORD } });
  if (!res.json?.token) throw new Error(`Impossible d'ouvrir une session pour ${email} : ${res.status} ${res.text}`);
  return res.json.token;
}

async function resetTasks(token) {
  const list = await call('GET', '/tasks', { token });
  for (const task of list.json?.items ?? []) {
    await call('DELETE', `/tasks/${task.id}`, { token });
  }
}

(async () => {
  console.log(`Recette TaskFlow contre ${API}\n`);

  // --- Installation et démarrage ---
  const health = await call('GET', '/health');
  report('GET /api/health → 200 et corps exact {"status":"ok"}', health.status === 200 && health.text === '{"status":"ok"}', health.text);
  report('Réponses en application/json', /application\/json/.test(health.contentType), health.contentType);

  // --- Authentification et droits ---
  const emailA = 'recette.a@example.test';
  const emailB = 'recette.b@example.test';
  const tokenA = await session(emailA);
  const tokenB = await session(emailB);
  await resetTasks(tokenA);
  await resetTasks(tokenB);

  const dup = await call('POST', '/auth/register', { body: { email: emailA.toUpperCase(), password: PASSWORD } });
  report('Inscription avec un email déjà utilisé (casse différente) → 409 EMAIL_ALREADY_USED', isError(dup, 409, 'EMAIL_ALREADY_USED'), String(dup.status));

  const login = await call('POST', '/auth/login', { body: { email: emailA, password: PASSWORD } });
  const loginOk =
    login.status === 200 &&
    typeof login.json?.token === 'string' &&
    typeof login.json?.user?.id === 'string' &&
    login.json?.user?.email === emailA &&
    !JSON.stringify(login.json).includes('password');
  report('Connexion A → 200, {user:{id,email},token}, sans mot de passe ni hash', loginOk, String(login.status));
  const jwtParts = (login.json?.token || '').split('.');
  report('Le token est un JWT à trois segments', jwtParts.length === 3 && jwtParts.every((p) => p.length > 0));

  const badPwd = await call('POST', '/auth/login', { body: { email: emailA, password: 'MauvaisMotDePasse' } });
  const badEmail = await call('POST', '/auth/login', { body: { email: 'inconnu.recette@example.test', password: PASSWORD } });
  report('Mauvais mot de passe → 401 UNAUTHORIZED', isError(badPwd, 401, 'UNAUTHORIZED'), String(badPwd.status));
  report('Email inconnu → 401 avec le même message (pas de fuite)', isError(badEmail, 401, 'UNAUTHORIZED') && badEmail.json.error.message === badPwd.json?.error?.message);

  const shortPwd = await call('POST', '/auth/register', { body: { email: 'court.recette@example.test', password: '1234567' } });
  const invalidEmail = await call('POST', '/auth/register', { body: { email: 'pas-un-email', password: PASSWORD } });
  report('Mot de passe trop court → 400 INVALID_INPUT', isError(shortPwd, 400, 'INVALID_INPUT'), String(shortPwd.status));
  report('Email invalide → 400 INVALID_INPUT', isError(invalidEmail, 400, 'INVALID_INPUT'), String(invalidEmail.status));

  const noJwt = await call('GET', '/tasks');
  const forged = await call('GET', '/tasks', { token: `${jwtParts[0]}.${jwtParts[1]}.signaturefalsifiee` });
  const garbage = await call('GET', '/tasks', { token: 'pas-un-jwt' });
  report('Sans JWT → 401 UNAUTHORIZED', isError(noJwt, 401, 'UNAUTHORIZED'), String(noJwt.status));
  report('JWT falsifié (signature modifiée) → 401 UNAUTHORIZED', isError(forged, 401, 'UNAUTHORIZED'), String(forged.status));
  report('Jeton quelconque → 401 UNAUTHORIZED', isError(garbage, 401, 'UNAUTHORIZED'), String(garbage.status));

  // --- CRUD, données et erreurs ---
  const emptyList = await call('GET', '/tasks', { token: tokenA });
  report('GET /api/tasks (compte vide) → 200 et {"items":[]}', emptyList.status === 200 && emptyList.text === '{"items":[]}', emptyList.text);

  const created = await call('POST', '/tasks', {
    token: tokenA,
    body: { title: 'Préparer la démo', status: 'todo', description: 'Plan et données', dueDate: '2026-10-05' },
  });
  const createdOk =
    created.status === 201 &&
    typeof created.json?.id === 'string' &&
    created.json.title === 'Préparer la démo' &&
    created.json.status === 'todo' &&
    created.json.description === 'Plan et données' &&
    created.json.dueDate === '2026-10-05' &&
    created.json._id === undefined &&
    created.json.ownerId === undefined;
  report('POST /api/tasks valide → 201, objet avec id chaîne (ni _id ni ownerId exposés)', createdOk, String(created.status));
  const taskId = created.json?.id;

  const listA = await call('GET', '/tasks', { token: tokenA });
  report('GET /api/tasks → 200 et la tâche créée dans items', listA.status === 200 && listA.json?.items?.some((t) => t.id === taskId));

  const detail = await call('GET', `/tasks/${taskId}`, { token: tokenA });
  report('GET /api/tasks/:id → 200 et objet attendu', detail.status === 200 && detail.json?.id === taskId && detail.json.title === 'Préparer la démo');

  const patched = await call('PATCH', `/tasks/${taskId}`, { token: tokenA, body: { status: 'done' } });
  report('PATCH partiel {status:"done"} → 200, autres champs conservés', patched.status === 200 && patched.json?.status === 'done' && patched.json.title === 'Préparer la démo' && patched.json.dueDate === '2026-10-05');

  const invalidCases = [
    ['PATCH vide {}', 'PATCH', `/tasks/${taskId}`, {}],
    ['PATCH champ inconnu', 'PATCH', `/tasks/${taskId}`, { tags: ['urgent'] }],
    ['PATCH ownerId', 'PATCH', `/tasks/${taskId}`, { ownerId: '507f1f77bcf86cd799439011' }],
    ['PATCH id', 'PATCH', `/tasks/${taskId}`, { id: '507f1f77bcf86cd799439011' }],
    ['PATCH statut invalide', 'PATCH', `/tasks/${taskId}`, { status: 'archived' }],
    ['POST status "archived"', 'POST', '/tasks', { title: 'Préparer', status: 'archived' }],
    ['POST titre vide après trim', 'POST', '/tasks', { title: '   ', status: 'todo' }],
    ['POST titre de 121 caractères', 'POST', '/tasks', { title: 'a'.repeat(121), status: 'todo' }],
    ['POST description de 1001 caractères', 'POST', '/tasks', { title: 'x', status: 'todo', description: 'd'.repeat(1001) }],
    ['POST date impossible 2026-02-30', 'POST', '/tasks', { title: 'x', status: 'todo', dueDate: '2026-02-30' }],
    ['POST date mal formatée 05/10/2026', 'POST', '/tasks', { title: 'x', status: 'todo', dueDate: '05/10/2026' }],
    ['POST id fourni par le client', 'POST', '/tasks', { title: 'x', status: 'todo', id: '507f1f77bcf86cd799439011' }],
    ['POST ownerId fourni par le client', 'POST', '/tasks', { title: 'x', status: 'todo', ownerId: '507f1f77bcf86cd799439011' }],
    ['POST titre manquant', 'POST', '/tasks', { status: 'todo' }],
  ];
  for (const [label, method, path, body] of invalidCases) {
    const res = await call(method, path, { token: tokenA, body });
    report(`${label} → 400 INVALID_INPUT`, isError(res, 400, 'INVALID_INPUT'), String(res.status));
  }
  const badJson = await call('POST', '/tasks', { token: tokenA, raw: '{"title": "cassé"' });
  report('JSON mal formé → 400 INVALID_INPUT', isError(badJson, 400, 'INVALID_INPUT'), String(badJson.status));

  const malformed = await call('GET', '/tasks/abc', { token: tokenA });
  const missing = await call('GET', '/tasks/507f1f77bcf86cd799439011', { token: tokenA });
  report('id malformé → 400 INVALID_INPUT', isError(malformed, 400, 'INVALID_INPUT'), String(malformed.status));
  report('id valide mais absent → 404 NOT_FOUND', isError(missing, 404, 'NOT_FOUND'), String(missing.status));

  // --- Isolation A/B ---
  const listB = await call('GET', '/tasks', { token: tokenB });
  report('La liste de B ne contient aucune tâche de A', listB.status === 200 && !listB.json.items.some((t) => t.id === taskId));
  const getB = await call('GET', `/tasks/${taskId}`, { token: tokenB });
  const patchB = await call('PATCH', `/tasks/${taskId}`, { token: tokenB, body: { title: 'Piratée' } });
  const deleteB = await call('DELETE', `/tasks/${taskId}`, { token: tokenB });
  report('B sur une tâche de A : GET → 404 NOT_FOUND', isError(getB, 404, 'NOT_FOUND'), String(getB.status));
  report('B sur une tâche de A : PATCH → 404 NOT_FOUND', isError(patchB, 404, 'NOT_FOUND'), String(patchB.status));
  report('B sur une tâche de A : DELETE → 404 NOT_FOUND', isError(deleteB, 404, 'NOT_FOUND'), String(deleteB.status));
  const stillA = await call('GET', `/tasks/${taskId}`, { token: tokenA });
  report('La tâche de A est intacte après les tentatives de B', stillA.status === 200 && stillA.json?.title === 'Préparer la démo' && stillA.json.status === 'done');

  // --- Suppression ---
  const toDelete = await call('POST', '/tasks', { token: tokenA, body: { title: 'À supprimer', status: 'todo' } });
  const del = await call('DELETE', `/tasks/${toDelete.json.id}`, { token: tokenA });
  report('DELETE → 204 sans corps', del.status === 204 && del.text === '', `${del.status} "${del.text}"`);
  const afterDel = await call('GET', `/tasks/${toDelete.json.id}`, { token: tokenA });
  report('GET après DELETE → 404 NOT_FOUND', isError(afterDel, 404, 'NOT_FOUND'), String(afterDel.status));

  const unknownRoute = await call('GET', '/inconnue');
  report('Route inconnue → 404 au format {"error":{"code","message"}}', isError(unknownRoute, 404, 'NOT_FOUND'), String(unknownRoute.status));

  // --- Bonus B1 : priorité, filtres, compteurs ---
  report('B1 : priority vaut medium par défaut sur la tâche créée', created.json?.priority === 'medium', String(created.json?.priority));
  const highTask = await call('POST', '/tasks', { token: tokenA, body: { title: 'Urgente', status: 'todo', priority: 'high', dueDate: '2000-01-01' } });
  report('B1 : POST avec priority "high" → 201', highTask.status === 201 && highTask.json?.priority === 'high', String(highTask.status));
  const badPriority = await call('POST', '/tasks', { token: tokenA, body: { title: 'x', status: 'todo', priority: 'urgent' } });
  report('B1 : priority "urgent" → 400 INVALID_INPUT', isError(badPriority, 400, 'INVALID_INPUT'), String(badPriority.status));
  const filterDone = await call('GET', '/tasks?status=done', { token: tokenA });
  report('B1 : ?status=done ne renvoie que des tâches done', filterDone.status === 200 && filterDone.json.items.length > 0 && filterDone.json.items.every((t) => t.status === 'done'));
  const filterHigh = await call('GET', '/tasks?priority=high', { token: tokenA });
  report('B1 : ?priority=high renvoie la tâche urgente uniquement', filterHigh.status === 200 && filterHigh.json.items.map((t) => t.id).join() === highTask.json.id);
  const overdue = await call('GET', '/tasks?due=overdue', { token: tokenA });
  report('B1 : ?due=overdue contient la tâche échue en 2000 et pas la tâche terminée', overdue.status === 200 && overdue.json.items.some((t) => t.id === highTask.json.id) && !overdue.json.items.some((t) => t.id === taskId));
  const badFilter = await call('GET', '/tasks?due=yesterday', { token: tokenA });
  const unknownParam = await call('GET', '/tasks?page=1', { token: tokenA });
  report('B1 : filtre hors liste → 400 INVALID_INPUT', isError(badFilter, 400, 'INVALID_INPUT'), String(badFilter.status));
  report('B1 : paramètre inconnu → 400 INVALID_INPUT', isError(unknownParam, 400, 'INVALID_INPUT'), String(unknownParam.status));
  const stats = await call('GET', '/tasks/stats', { token: tokenA });
  const statsOk = stats.status === 200 && stats.json?.total === 2 && stats.json.byStatus?.done === 1 && stats.json.byPriority?.high === 1 && stats.json.overdue === 1;
  report('B1 : GET /tasks/stats → total 2, done 1, high 1, overdue 1', statsOk, JSON.stringify(stats.json));
  const statsB = await call('GET', '/tasks/stats', { token: tokenB });
  report('B1 : les compteurs de B ne voient pas les tâches de A', statsB.status === 200 && statsB.json?.total === 0, JSON.stringify(statsB.json));
  await call('DELETE', `/tasks/${highTask.json.id}`, { token: tokenA });

  // --- Bonus B4 : completedAt et statistiques hebdomadaires ---
  const doneTask = await call('GET', `/tasks/${taskId}`, { token: tokenA });
  report('B4 : une tâche passée à done porte un completedAt', typeof doneTask.json?.completedAt === 'string', String(doneTask.json?.completedAt));
  const reopened = await call('PATCH', `/tasks/${taskId}`, { token: tokenA, body: { status: 'todo' } });
  report('B4 : rouvrir la tâche remet completedAt à null', reopened.status === 200 && reopened.json?.completedAt === null, String(reopened.json?.completedAt));
  const redone = await call('PATCH', `/tasks/${taskId}`, { token: tokenA, body: { status: 'done' } });
  report('B4 : repasser à done pose un nouveau completedAt', redone.status === 200 && typeof redone.json?.completedAt === 'string');
  const cheat = await call('PATCH', `/tasks/${taskId}`, { token: tokenA, body: { completedAt: '2020-01-01T00:00:00Z' } });
  report('B4 : completedAt fourni par le client → 400 INVALID_INPUT', isError(cheat, 400, 'INVALID_INPUT'), String(cheat.status));
  const weeklyRes = await call('GET', '/tasks/stats/weekly?weeks=4', { token: tokenA });
  const weeklyOk =
    weeklyRes.status === 200 &&
    Array.isArray(weeklyRes.json?.series) &&
    weeklyRes.json.series.length === 4 &&
    weeklyRes.json.overall?.total === 1 &&
    weeklyRes.json.overall?.done === 1 &&
    weeklyRes.json.overall?.completionRate === 1 &&
    weeklyRes.json.series[3].completed >= 1;
  report('B4 : GET /tasks/stats/weekly?weeks=4 → 4 semaines, taux global 1, tâche comptée cette semaine', weeklyOk, JSON.stringify(weeklyRes.json?.overall));
  const weeklyB = await call('GET', '/tasks/stats/weekly?weeks=4', { token: tokenB });
  report('B4 : les statistiques de B ne voient pas les tâches de A', weeklyB.status === 200 && weeklyB.json?.overall?.total === 0 && weeklyB.json.overall.completionRate === null);
  const badWeeks = await call('GET', '/tasks/stats/weekly?weeks=0', { token: tokenA });
  const badParam = await call('GET', '/tasks/stats/weekly?weeks=4&from=2026', { token: tokenA });
  report('B4 : weeks=0 → 400 INVALID_INPUT', isError(badWeeks, 400, 'INVALID_INPUT'), String(badWeeks.status));
  report('B4 : paramètre inconnu → 400 INVALID_INPUT', isError(badParam, 400, 'INVALID_INPUT'), String(badParam.status));

  // --- Bilan ---
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} points OK`);
  console.log('\nPersistance après redémarrage : la tâche suivante est conservée en base.');
  console.log(`  id    : ${taskId}`);
  console.log('  Arrêtez l\'API (Ctrl+C), relancez-la, puis exécutez :');
  console.log(`  curl -s -H "Authorization: Bearer ${tokenA}" ${API}/tasks/${taskId}`);
  console.log('  → attendu : HTTP 200 et la même tâche (title "Préparer la démo", status "done").');
  process.exit(failed.length ? 1 : 0);
})().catch((err) => {
  console.error('\nRecette interrompue :', err.message);
  console.error("Vérifiez que l'API est démarrée (npm run dev dans backend/) et que MongoDB répond.");
  process.exit(1);
});
