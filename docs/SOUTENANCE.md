# Préparation de la soutenance (10 minutes + questions)

## Avant de commencer

- Terminal 1 : `docker compose up -d` puis `npm run dev:backend` (attendre `MongoDB connecté`).
- Terminal 2 : `npm run dev:frontend`.
- Onglets ouverts : http://localhost:5173 (compte A déjà créé, un compte B prêt dans une fenêtre privée), http://localhost:3000/api/docs, VS Code sur `backend/src`.
- Terminal 3 : `node scripts/recette.js` (à lancer pendant la partie sécurité) et `npm test --prefix backend`.
- Avoir le SHA du rendu sous la main : `git rev-list -n 1 rendu-v1`.

## Déroulé minuté

### 1 min — Sujet et objectif

« TaskFlow, sujet A du livret : une application où chaque utilisateur gère ses tâches personnelles (titre, statut à faire / en cours / terminée, description, échéance). Objectif du MVP : inscription et connexion avec JWT, CRUD complet depuis le navigateur, persistance MongoDB, isolation stricte entre comptes, validation serveur, tests et documentation. Tout le socle obligatoire est réalisé ; je n'ai pas ajouté de bonus. »

### 2 min — Architecture et chemin d'une requête

Montrer l'arborescence `backend/src` puis dérouler **PATCH /api/tasks/:id** :

1. Le navigateur (React) appelle `request('/tasks/<id>', { method: 'PATCH', body: { status: 'done' } })` : `api/client.js` ajoute `Authorization: Bearer <jwt>` et sérialise le JSON. En dev, Vite relaie `/api` vers Express.
2. `routes/task.routes.js` : `requireAuth` vérifie le JWT (signature + expiration) et pose `req.user.id` ; `validateObjectId` vérifie le format de l'id.
3. `controllers/task.controller.js` : appelle `validateTaskPatch` (règles du contrat) puis le service, fixe le code HTTP.
4. `services/task.service.js` : `findOneAndUpdate({ _id, ownerId }, …)` : la seule couche qui parle à Mongoose, et elle filtre toujours par propriétaire.
5. `models/Task.js` : schéma Mongoose et `toJSON` qui expose `id` et cache `_id` / `ownerId`.
6. Toute erreur remonte à `middlewares/errorHandler.js` : une seule forme `{"error":{"code","message"}}`.

Phrase clé : « routes → contrôleur → validateur → service → modèle ; les contrôleurs sont minces, la règle métier est dans les validateurs et les services, donc testable. »

### 3 min — Démonstration

1. Inscription d'un nouveau compte (ou connexion A) : montrer l'arrivée sur la liste vide.
2. Créer une tâche avec description et échéance → message de succès, badge de statut.
3. Ouvrir le détail, modifier le statut → « Tâche mise à jour ». Recharger la page : la donnée vient du serveur.
4. Supprimer : montrer la confirmation, annuler, puis confirmer → liste vide.
5. Dans la fenêtre privée, compte B : sa liste ne voit pas les tâches de A. Coller l'URL d'une tâche de A → « Tâche introuvable » (404 côté API).
6. Montrer Swagger : `GET /api/tasks` avec le token de B → `{"items":[]}`.

Si le temps manque : sauter l'étape 6.

### 2 min — Sécurité : JWT, bcrypt, validation, isolation

- **bcrypt** (`services/auth.service.js`) : `bcrypt.hash` avec un coût de 10 ; seul le hash salé est stocké ; `bcrypt.compare` à la connexion. Montrer dans Mongo que `users` ne contient que `passwordHash`.
- **JWT** : `jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '1h' })`. La clé vient de `.env` (jamais versionnée). Le serveur ne stocke pas de session : la signature prouve l'authenticité. `requireAuth` → 401 si absent, invalide, falsifié, expiré.
- **Expiration et stockage** : jeton d'une heure ; stocké en `localStorage` pour survivre au rechargement et être envoyé en en-tête (pas de CSRF), au prix d'une exposition en cas de XSS. Alternative connue : cookie `httpOnly`. Un 401 déconnecte avec « session expirée ».
- **Validation** (`validators/task.validator.js`) : liste blanche de champs, `id`/`ownerId` refusés, dates civiles réelles (`2026-02-30` refusé), PATCH non vide. Lancer `node scripts/recette.js` : 42 points verts, dont les cas invalides.
- **Isolation A/B** (`services/task.service.js`) : `ownerId` vient du JWT, jamais du client ; chaque requête Mongo filtre sur `ownerId` ; une tâche d'autrui → 404 comme si elle n'existait pas (on ne révèle rien). « Masquer un bouton dans React n'est pas une autorisation : la règle est dans Express. »

### 1 min — Tests, Swagger, README

- `npm test` : 7 fichiers, 108 tests Jest + Supertest, base MongoDB en mémoire isolée du développement. Montrer `tests/tasks.isolation.test.js` : B reçoit 404 **et** la tâche de A est intacte en base. « Si je retire le filtre `ownerId` du service, 6 tests échouent. »
- Swagger sur `/api/docs` : Bearer, les 8 routes, schémas, erreurs 400/401/404/409.
- README : installation, `.env.example`, MongoDB, lancement, tests/lint/build, architecture, sécurité, limites. CI GitHub Actions : lint + tests + build à chaque push.

### 1 min — Limites et améliorations

Pas de révocation de JWT ni de refresh token ; jeton en `localStorage` ; pas de limitation de débit sur la connexion ; pas de pagination ; pas de tests automatisés du front (parcours vérifié manuellement) ; déploiement non réalisé faute de modalité confirmée. Pistes : cookie `httpOnly` + CSRF, rate limiting, bonus B1 (priorité et filtres) avec tests dédiés.

## Questions probables et éléments de réponse

| Question | Réponse courte |
| --- | --- |
| Pourquoi 404 et non 403 quand B accède à une tâche de A ? | Le contrat l'impose, et cela ne révèle pas l'existence de la ressource : pour B, la tâche n'existe pas. |
| Différence entre 401 et 404 ? | 401 : la requête n'est pas authentifiée (JWT absent/invalide/expiré). 404 : authentifié, mais la ressource n'existe pas pour ce compte. |
| Que se passe-t-il au redémarrage de l'API ? | Rien n'est perdu : les documents sont dans MongoDB. Le JWT reste valide car sa vérification ne dépend que de `JWT_SECRET`. `tests/persistence.test.js` le vérifie. |
| Comment le serveur connaît-il le propriétaire ? | `requireAuth` vérifie le JWT et lit le claim `sub` ; le service l'utilise comme `ownerId`. Le corps de la requête ne peut pas le fournir (400). |
| Pourquoi valider côté serveur si React valide déjà ? | Un client HTTP (curl, Postman) contourne le formulaire. Le serveur est la seule barrière fiable. |
| Comment `2026-02-30` est-il refusé ? | `utils/civilDate.js` : format `YYYY-MM-DD`, puis reconstruction en UTC et comparaison année/mois/jour : JavaScript déborde sur le 2 mars, donc refus. |
| Pourquoi stocker `dueDate` en chaîne et non en `Date` ? | C'est une date civile sans heure ; une `Date` introduirait un fuseau horaire et un risque de décalage d'un jour. |
| Que contient le JWT ? Est-il chiffré ? | `sub` (id utilisateur), `iat`, `exp`. Il est signé (HS256), pas chiffré : lisible mais infalsifiable sans la clé. |
| Comment tes tests détectent-ils une régression ? | Ils rejouent le contrat via Supertest sur `createApp()` : code HTTP, enveloppe, état en base. Retirer le filtre propriétaire ou une règle de validation fait échouer les tests correspondants. |
| Pourquoi une base de test en mémoire ? | Isolation totale de la base de développement, déterminisme (base vide à chaque fichier), aucune configuration externe. En CI, un conteneur Mongo est utilisé via `MONGO_URI_TEST`. |
| Pourquoi Express 5 ? | Les promesses rejetées dans les contrôleurs sont transmises automatiquement au gestionnaire d'erreurs : pas de `try/catch` répétitif. |
| Rôle de Vite / Babel / Webpack ? | Vite : serveur de dev et build (Rollup) ; Babel : transpilation (JSX, syntaxe moderne), remplacé ici par esbuild/oxc via le plugin React ; Webpack : bundler historique, rôle tenu ici par Vite. |
| Où placerais-tu les tests dans une chaîne CI/CD ? | Avant tout déploiement : le workflow GitHub Actions lance lint, tests et build à chaque push ; un déploiement ne partirait qu'après succès. |

## Questions pour vérifier sa propre compréhension (s'entraîner à y répondre sans notes)

1. Dans quel fichier la règle « titre de 1 à 120 caractères » est-elle écrite, et comment le test correspondant s'appelle-t-il ?
2. Que renvoie `createApp()` et pourquoi `server.js` est-il séparé ?
3. Quel middleware transforme une `AppError` en réponse JSON, et que se passe-t-il pour une erreur inattendue ?
4. Pourquoi `isObjectIdString` utilise-t-il une regex plutôt que `mongoose.isValidObjectId` ?
5. Comment le front réagit-il à un 401 reçu en cours de session ? Où est ce code ?
6. Pourquoi le garde `GuestRoute` décide-t-il au montage et non à chaque rendu ?
7. Que fait `toJSON` dans `models/Task.js` et pourquoi est-ce une protection ?
8. Comment le test de persistance simule-t-il un redémarrage ?
9. Que se passe-t-il si deux inscriptions avec le même email arrivent en même temps ?
10. Quelle commande lance un seul fichier de test ? Un seul test par son nom ?
11. Où est fixé `BCRYPT_ROUNDS=4` pour les tests, et pourquoi ?
12. Que contient le `.env.example` et qu'est-ce qui ne doit jamais y figurer ?
