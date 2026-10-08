# TaskFlow

Application web de gestion de tâches personnelles, réalisée dans le cadre du module **Full Stack JS** (EFREI, Master 1), sujet **A. TaskFlow** du livret étudiant (`docs/LIVRET ETUDIANT V2.pdf`).

Chaque utilisateur crée un compte, se connecte et gère **ses** tâches (titre, statut, description, échéance). Les données d'un compte sont invisibles pour les autres, y compris par requête HTTP directe : l'autorisation est appliquée dans l'API, pas seulement dans l'interface.

Le MVP du livret est complet. Les **bonus B1** (priorité, filtres et compteurs) et **B4** (statistiques hebdomadaires) ont été ajoutés ensuite, avec leurs critères d'acceptation et leurs tests dédiés (voir section 10) ; les cinq routes CRUD obligatoires sont inchangées.

## Sommaire

1. [Stack et versions](#1-stack-et-versions)
2. [Prérequis](#2-prérequis)
3. [Installation](#3-installation)
4. [Configuration](#4-configuration)
5. [MongoDB](#5-mongodb)
6. [Lancement](#6-lancement)
7. [Ports et URLs](#7-ports-et-urls)
8. [Tests, lint, build](#8-tests-lint-build)
9. [Architecture](#9-architecture)
10. [Contrat API](#10-contrat-api)
11. [Sécurité](#11-sécurité)
12. [Outillage : Vite, Babel, Webpack, CI/CD](#12-outillage--vite-babel-webpack-cicd)
13. [Limites connues et améliorations](#13-limites-connues-et-améliorations)
14. [Livrables et points à confirmer](#14-livrables-et-points-à-confirmer)
15. [Environnements, conteneurs et chaîne CI/CD](#15-environnements-conteneurs-et-chaîne-cicd)

## 1. Stack et versions

| Couche | Technologie | Version utilisée |
| --- | --- | --- |
| Langage | JavaScript (CommonJS côté API, modules ES côté front) | Node.js 20.19.5, npm 11.6 |
| Front-end | React, React Router, Vite | React 19.3, react-router-dom 7.18, Vite 8.3 |
| Interface | Tailwind CSS (plugin Vite), Lucide (icônes), Playwright (tests de bout en bout) | Tailwind CSS 4, lucide-react, Playwright 1.63 |
| API | Node.js, Express | Express 5.2 |
| Base de données | MongoDB, Mongoose | MongoDB 7 (Docker), Mongoose 9.9 (driver mongodb 7.5) |
| Authentification | bcrypt, jsonwebtoken | bcrypt 6.0, jsonwebtoken 9.0 |
| Tests | Jest, Supertest, mongodb-memory-server | Jest 30.5, Supertest 7.3, mongodb-memory-server 11.3 |
| Qualité | ESLint (flat config) | ESLint 10.12 |
| Documentation API | OpenAPI 3.0, swagger-ui-express | swagger-ui-express 5.0 |

Les versions exactes sont figées dans `backend/package-lock.json` et `frontend/package-lock.json`.

> Mongoose est volontairement figé en `~9.9.0` : les versions 9.10 et 9.11 embarquent un driver mongodb (7.6 / 7.7) qui échoue sous Jest avec l'erreur « Missing required sub-document 'driver' ». Ne pas le mettre à jour sans relancer la suite de tests.

## 2. Prérequis

- **Node.js ≥ 20.19** et npm (vérifier avec `node -v`).
- **MongoDB 7** : soit Docker Desktop (recommandé, un `docker-compose.yml` est fourni), soit une installation locale, soit une base distante (MongoDB Atlas).
- **Git**.
- Système testé : Windows 11 (Git Bash et PowerShell). Les commandes sont identiques sous macOS et Linux.

## 3. Installation

```bash
git clone https://github.com/m4tth1euNa0p1c/FULLSTACK-JS-M1-DEV-EFREI.git
cd FULLSTACK-JS-M1-DEV-EFREI
npm run install:all            # équivaut à : npm install --prefix backend && npm install --prefix frontend
```

Le premier `npm install` du backend télécharge un binaire MongoDB (~80 Mo) utilisé uniquement par les tests (mongodb-memory-server). Pour s'en passer (par exemple en CI avec un vrai MongoDB), définir `MONGOMS_DISABLE_POSTINSTALL=1` avant l'installation.

## 4. Configuration

Copier les fichiers d'exemple puis adapter les valeurs. **Aucun fichier `.env` n'est versionné.**

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env      # facultatif en développement
```

`backend/.env` :

| Variable | Rôle | Exemple |
| --- | --- | --- |
| `PORT` | Port HTTP de l'API | `3000` |
| `MONGO_URI` | Chaîne de connexion de la base de développement | `mongodb://127.0.0.1:27017/taskflow` |
| `JWT_SECRET` | Clé de signature des JWT (longue chaîne aléatoire, jamais versionnée) | voir ci-dessous |
| `JWT_EXPIRES_IN` | Durée de vie d'un jeton | `1h` |
| `BCRYPT_ROUNDS` | Coût du hachage bcrypt | `10` |
| `CORS_ORIGIN` | Origine autorisée pour le navigateur | `http://localhost:5173` |

Générer une clé JWT :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

`frontend/.env` : `VITE_API_URL` reste vide en développement (Vite relaie `/api` vers l'API). À renseigner seulement si le front construit est servi depuis une autre origine que l'API. Pour les démonstrations, `VITE_DEMO_EMAIL` et `VITE_DEMO_PASSWORD` préremplissent le formulaire de connexion (par exemple le compte `recette.a@example.test` créé par `node scripts/recette.js`) ; laisser vides ailleurs qu'en local, le fichier `.env` n'est jamais versionné.

## 5. MongoDB

**Avec Docker (recommandé)** :

```bash
docker compose up -d           # démarre le conteneur taskflow-mongo sur le port 27017
docker compose down            # arrête le conteneur, les données restent dans le volume
docker compose down -v         # supprime aussi les données
```

Vérifier : `docker exec taskflow-mongo mongosh --quiet --eval "db.runCommand({ping:1}).ok"` doit afficher `1`.

**Sans Docker** : installer MongoDB Community 7, démarrer `mongod`, et garder `MONGO_URI=mongodb://127.0.0.1:27017/taskflow`. Avec Atlas, remplacer `MONGO_URI` par la chaîne fournie (`mongodb+srv://…`).

La base de développement s'appelle `taskflow` (collections `users` et `tasks`). Les tests n'y touchent jamais (voir section 8).

## 6. Lancement

Dans deux terminaux, depuis la racine :

```bash
npm run dev:backend            # API Express, rechargée automatiquement (node --watch)
npm run dev:frontend           # interface React (Vite)
```

Ou directement dans chaque dossier : `cd backend && npm run dev`, `cd frontend && npm run dev`. En production : `npm start` dans `backend/` et `npm run build` puis `npm run preview` dans `frontend/`.

Au démarrage, l'API affiche `MongoDB connecté` puis l'URL de l'API et de Swagger. Si `JWT_SECRET` manque, elle s'arrête avec un message explicite.

## 7. Ports et URLs

| Service | URL |
| --- | --- |
| Interface React | http://localhost:5173 |
| API (préfixe de toutes les routes) | http://localhost:3000/api |
| Santé | http://localhost:3000/api/health → `{"status":"ok"}` |
| Documentation Swagger UI | http://localhost:3000/api/docs |
| Document OpenAPI brut | http://localhost:3000/api/docs.json (source : `backend/src/docs/openapi.json`) |
| MongoDB | mongodb://127.0.0.1:27017 |

## 8. Tests, lint, build

Depuis la racine :

```bash
npm test                       # suite Jest + Supertest du backend (181 tests, ~12 s)
npm run lint                   # ESLint backend puis frontend
npm run build                  # build de production du front (frontend/dist)
npm run verify                 # les trois à la suite
node scripts/recette.js        # recette automatisée du contrat API contre une API démarrée (60 points, bonus B1 et B4 inclus)
npm run e2e                    # suite Playwright de bout en bout (e2e/, 19 tests), cible E2E_BASE_URL (défaut http://localhost:5173)
npm run int:up                 # pile d'intégration Docker (MongoDB + API + front nginx) sur http://localhost:8080 ; npm run int:down pour l'arrêter
```

Première utilisation de Playwright : `npm install --prefix e2e` puis `npm run install:browsers --prefix e2e` (télécharge Chromium) ou, pour utiliser le Chrome installé, `E2E_BROWSER_CHANNEL=chrome npm run e2e`.

Dans `backend/` : `npm test -- tests/tasks.isolation.test.js` (un fichier), `npm test -- -t "PATCH vide"` (un test par nom), `npm run test:coverage`.

**Base de test isolée.** Chaque fichier de test démarre son propre serveur MongoDB en mémoire (`mongodb-memory-server`), vide ses collections après chaque test et le détruit à la fin. La base de développement `taskflow` n'est jamais lue ni modifiée ; le fichier `.env` n'est pas chargé en test (`backend/tests/setup/env.js`). Pour exécuter la suite contre un MongoDB réel (ce que fait la CI), le setup crée une base dédiée `taskflow_test_<pid>_<horodatage>` puis la supprime :

```bash
MONGO_URI_TEST=mongodb://127.0.0.1:27017 npm test --prefix backend
```

**Couverture fonctionnelle de la suite** (`backend/tests/`) :

| Fichier | Ce qui est vérifié |
| --- | --- |
| `health.test.js` | `/api/health` exact, 404 contractuel, absence de `X-Powered-By` |
| `auth.test.js` | register 201 / login 200, schéma `{user,token}`, JWT signé, email insensible à la casse, 409, 400, 401 sans fuite, hash bcrypt en base |
| `auth.middleware.test.js` | JWT absent, schéma non Bearer, falsifié, contenu altéré, `alg: none`, expiré, sans `sub` → 401 sur les cinq routes |
| `tasks.crud.test.js` | parcours nominal complet, valeurs par défaut, trim, PATCH partiel, 204 sans corps, id malformé 400, id absent 404 |
| `tasks.validation.test.js` | 29 corps invalides en POST, 13 en PATCH (dates impossibles, `id`/`ownerId`, champs inconnus, PATCH vide…), cas limites acceptés |
| `tasks.isolation.test.js` | comptes A/B : liste, lecture, modification, suppression → 404 et état en base intact ; `ownerId` imposé par le serveur |
| `persistence.test.js` | données et connexion conservées après fermeture/réouverture de la connexion et nouvelle instance de l'application |
| `tasks.bonus-b1.test.js` | bonus B1 : `priority` (défaut, valeurs, 400), filtres `status`/`priority`/`due`/`today` seuls et combinés, paramètres invalides ou inconnus → 400, isolation A/B des filtres, `/tasks/stats` (compteurs, zéros, isolation, 400, 401) |
| `weeklyStats.unit.test.js` | bonus B4, calcul pur sans base : rattachement d'un instant à une date civile selon le fuseau, lundi de semaine ISO, séries `created`/`completed`/`open`, taux borné à [0, 1], semaines sans donnée → `null`, tâche rouverte, tendance |
| `tasks.bonus-b4.test.js` | bonus B4 via l'API : cycle de `completedAt` (posé, conservé, effacé, refusé en entrée), `/tasks/stats/weekly` (scénario de référence antidaté, isolation A/B, valeurs par défaut, fuseau, données antérieures au bonus, bornes, 400, 401) |

Le test d'isolation détecte réellement une régression : retirer `ownerId` du filtre dans `backend/src/services/task.service.js` fait échouer 6 des 11 tests de ce fichier (vérifié).

**Persistance après redémarrage, procédure manuelle** : créer une tâche (interface ou `node scripts/recette.js`, qui affiche l'identifiant et la commande `curl` à rejouer), arrêter l'API (Ctrl+C), la relancer, puis relire la tâche : HTTP 200 et mêmes données. Détail dans `docs/RECETTE.md`.

## 9. Architecture

```
.
├── backend/
│   ├── src/
│   │   ├── app.js                 # createApp() : Express sans écoute ni connexion (importable par les tests)
│   │   ├── server.js              # connexion MongoDB + app.listen(PORT) + arrêt propre
│   │   ├── config/                # env.js (variables d'environnement), db.js (Mongoose)
│   │   ├── routes/                # health, auth, tasks + montage Swagger (index.js)
│   │   ├── controllers/           # lisent la requête, appellent validateur + service, fixent le code HTTP
│   │   ├── validators/            # règles du contrat (liste blanche de champs, longueurs, dates réelles) + filtres de liste (B1)
│   │   ├── services/              # logique métier et accès Mongoose, toujours filtré par ownerId
│   │   ├── models/                # User (email unique, passwordHash), Task (ownerId, title, status…)
│   │   ├── middlewares/           # requireAuth (Bearer), validateObjectId, notFound, errorHandler
│   │   ├── utils/                 # AppError + fabriques d'erreurs, civilDate, objectId, weeklyStats (calcul B4 pur)
│   │   └── docs/openapi.json      # documentation OpenAPI servie sur /api/docs
│   └── tests/                     # Jest + Supertest, setup/db.js (base de test), helpers/auth.js
├── frontend/
│   └── src/
│       ├── api/                   # client.js (fetch + Bearer + ApiError), jwt.js (lecture de exp)
│       ├── context/               # AuthContext (session, login/register/logout, request), useAuth
│       ├── components/            # Layout, ProtectedRoute, GuestRoute, TaskForm, Alert, StatusBadge, PriorityBadge (B1)
│       ├── pages/                 # Login, Register, Tasks (liste, filtres et compteurs B1), NewTask, TaskDetail, Stats (B4)
│       └── utils/                 # taskForm.js (validation client, conversion API), taskStatus.js (libellés), dates.js (date locale)
├── e2e/                           # tests Playwright de bout en bout (santé @smoke, auth, CRUD, bonus), rapport HTML
├── infra/
│   ├── compose/docker-compose.int.yml   # pile d'intégration : MongoDB + API + front nginx, construite depuis les sources
│   └── gcp/setup.sh               # mise en place Google Cloud (Artifact Registry, OIDC GitHub, secrets) pour le déploiement
├── scripts/recette.js             # recette automatisée du contrat API
├── docs/                          # livret, RECETTE.md, SOUTENANCE.md, BRANCHING.md (branches, tickets, PR), DEPLOYMENT.md (environnements)
├── docker-compose.yml             # MongoDB 7 de développement
└── .github/
    ├── workflows/ci.yml           # lint + tests + build + construction des images, à chaque PR et push sur develop/main
    ├── workflows/integration.yml  # pile Docker + recette API + Playwright (environnement d'intégration)
    └── workflows/production.yml   # images GHCR, déploiement Cloud Run, tests de fumée (fusion dans main)
```

**Chemin d'une requête** `PATCH /api/tasks/:id` :

1. `express.json()` parse le corps (JSON illisible → 400 via le gestionnaire d'erreurs).
2. `routes/task.routes.js` : `requireAuth` lit `Authorization: Bearer <jwt>`, vérifie signature et expiration avec `JWT_SECRET`, pose `req.user = { id }` (sinon 401) ; `validateObjectId` vérifie le format de `:id` (sinon 400).
3. `controllers/task.controller.js` : `validateTaskPatch(req.body)` retourne les champs normalisés ou lève une `AppError` 400.
4. `services/task.service.js` : `findOneAndUpdate({ _id, ownerId: req.user.id }, …)` ; aucun document → 404.
5. `models/Task.js` : `toJSON` renvoie `{ id, title, status, description, dueDate, createdAt, updatedAt }`.
6. Toute erreur remonte à `middlewares/errorHandler.js` → `{"error":{"code","message"}}`, sans trace serveur.

**Choix techniques** :

- Validation écrite à la main (pas de Joi/Zod) pour que chaque règle du contrat soit lisible dans un seul fichier, `validators/task.validator.js`, et explicable en soutenance.
- `dueDate` stockée comme chaîne `YYYY-MM-DD` : c'est une date civile sans heure, la stocker en `Date` introduirait des décalages de fuseau horaire.
- Express 5 : les promesses rejetées dans les contrôleurs arrivent au gestionnaire d'erreurs sans wrapper.
- Front : Vite relaie `/api` vers l'API en développement (pas de CORS à gérer), et l'API active quand même `cors` pour un déploiement séparé.
- Design : style d'outil, à la manière de Notion. Barre latérale grise, contenu blanc, typographie Inter dense, bordures fines, étiquettes de propriétés colorées pour les statuts et priorités (toujours accompagnées d'un libellé), cases à cocher carrées, un seul bleu réservé aux actions, aucun ornement. Tailwind CSS v4 fournit le thème (`@theme`) et les utilitaires ; les composants sont définis dans `@layer components` de `frontend/src/styles.css` et conservent des classes sémantiques qui servent d'accroches aux tests Playwright. Les patterns viennent de shadcn/ui et de 21st.dev, réécrits en JSX puisque le livret impose JavaScript sans TypeScript. Icônes Lucide.

## 10. Contrat API

Toutes les routes commencent par `/api`, lisent et renvoient du JSON UTF-8.

| Méthode | Route | Accès | Succès | Erreurs |
| --- | --- | --- | --- | --- |
| GET | `/api/health` | public | 200 `{"status":"ok"}` | |
| POST | `/api/auth/register` | public | 201 `{"user":{"id","email"},"token"}` | 400, 409 |
| POST | `/api/auth/login` | public | 200 même schéma | 400, 401 |
| GET | `/api/tasks` | Bearer | 200 `{"items":[…]}` | 401 |
| POST | `/api/tasks` | Bearer | 201 tâche créée | 400, 401 |
| GET | `/api/tasks/:id` | Bearer | 200 tâche | 400, 401, 404 |
| PATCH | `/api/tasks/:id` | Bearer | 200 tâche modifiée | 400, 401, 404 |
| DELETE | `/api/tasks/:id` | Bearer | 204 sans corps | 400, 401, 404 |
| GET | `/api/tasks/stats` (bonus B1) | Bearer | 200 compteurs | 400, 401 |
| GET | `/api/tasks/stats/weekly` (bonus B4) | Bearer | 200 séries hebdomadaires | 400, 401 |

Erreurs : `{"error":{"code":"INVALID_INPUT" | "UNAUTHORIZED" | "NOT_FOUND" | "EMAIL_ALREADY_USED","message":"…"}}` (400 / 401 / 404 / 409).

Règles de validation (serveur) : `title` trimé, 1 à 120 caractères, obligatoire ; `status` exactement `todo`, `doing` ou `done`, obligatoire ; `description` 0 à 1000 caractères, chaîne vide acceptée ; `dueDate` date civile réelle `YYYY-MM-DD` ou `null`. `id`, `_id`, `ownerId` et tout champ inconnu sont refusés (400) en POST comme en PATCH ; un PATCH vide est refusé.

### Bonus B1 : priorité, filtres et compteurs

Réalisé après validation du MVP, conformément au livret (« Champ priority (low, medium, high), filtre par statut/échéance et compteur de tâches. Les routes additionnelles ne remplacent pas le CRUD obligatoire. »).

**Critères d'acceptation** (tous couverts par `backend/tests/tasks.bonus-b1.test.js`, 37 tests) :

1. `priority` ∈ `low` | `medium` | `high`, facultative à la création (`medium` par défaut), modifiable en PATCH ; toute autre valeur → 400 `INVALID_INPUT`. Présente dans toutes les réponses de tâche.
2. `GET /api/tasks` accepte les paramètres facultatifs et combinables `status`, `priority`, `due` et `today` ; sans paramètre, la réponse est identique au MVP (`{"items":[…]}`). Valeur hors liste, paramètre inconnu ou répété → 400.
3. `GET /api/tasks/stats` → 200 `{"total","byStatus":{"todo","doing","done"},"byPriority":{"low","medium","high"},"overdue"}` ; JWT requis ; ne compte que les tâches du compte connecté.
4. Les filtres et les compteurs n'exposent jamais les tâches d'un autre compte ; les cinq routes de base et leur suite de tests restent inchangées.

| Paramètre | Valeurs | Sens |
| --- | --- | --- |
| `status` | `todo`, `doing`, `done` | statut exact |
| `priority` | `low`, `medium`, `high` | priorité exacte |
| `due` | `overdue` | échéance strictement antérieure à la date de référence **et** statut différent de `done` |
| | `today` | échéance égale à la date de référence |
| | `upcoming` | échéance supérieure ou égale à la date de référence |
| | `none` | sans échéance (`dueDate` null) |
| `today` | `YYYY-MM-DD` | date de référence ; par défaut la date UTC du serveur. Le front envoie sa date locale pour que « en retard » suive le fuseau de l'utilisateur. Fonctionne aussi sur `/tasks/stats`. |

Les dates civiles `YYYY-MM-DD` sont comparées comme des chaînes (ordre alphabétique = ordre chronologique) ; MongoDB ne compare `$lt`/`$gte` qu'entre valeurs de même type, donc une échéance `null` n'est jamais « en retard ».

```bash
curl -s "http://localhost:3000/api/tasks?status=todo&priority=high" -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:3000/api/tasks?due=overdue&today=2026-10-07" -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:3000/api/tasks/stats?today=2026-10-07" -H "Authorization: Bearer $TOKEN"
# → {"total":5,"byStatus":{"todo":3,"doing":1,"done":1},"byPriority":{"low":2,"medium":2,"high":1},"overdue":1}
```

Côté interface : sélecteur de priorité dans le formulaire, pastille de priorité dans la liste et le détail, barre de filtres (statut, priorité, échéance) dont l'état vit dans l'URL (`/tasks?status=todo&due=overdue`), compteurs au-dessus de la liste.

### Bonus B4 : statistiques hebdomadaires

Réalisé après B1, conformément au livret (« Taux de complétion hebdomadaire, évolution par période, calcul documenté et tests sur les agrégations »).

**Critères d'acceptation** (couverts par `backend/tests/weeklyStats.unit.test.js`, 13 tests sans base, et `backend/tests/tasks.bonus-b4.test.js`, 23 tests via l'API) :

1. Le serveur pose `completedAt` au passage d'une tâche à `done`, le conserve tant qu'elle reste terminée, le remet à `null` si elle est rouverte. Le client ne peut pas le fournir (400). Il apparaît dans toutes les réponses de tâche.
2. `GET /api/tasks/stats/weekly` renvoie, pour le compte connecté, `weeks` semaines (1 à 26, 8 par défaut) se terminant par la semaine de la date de référence, le taux global et la tendance. `weeks`, `today` et `tzOffset` sont validés ; paramètre inconnu → 400 ; JWT requis.
3. Les instants sont rattachés à une date civile selon le fuseau du client (`tzOffset`, minutes, convention `Date.prototype.getTimezoneOffset`, Paris en été = `-120`) ; sans fuseau, lecture en UTC.
4. Le calcul est isolé dans un module pur (`backend/src/utils/weeklyStats.js`), documenté et testé indépendamment de MongoDB.

**Calcul documenté.** Une semaine va du lundi au dimanche (semaine ISO). Pour une semaine S :

| Mesure | Définition |
| --- | --- |
| `created` | tâches dont la date civile de création est dans S |
| `completed` | tâches dont la date civile de `completedAt` est dans S |
| `open` | tâches « à traiter » pendant S : créées au plus tard le dernier jour de S et non terminées avant le premier jour de S |
| `completionRate` | `completed / open`, arrondi à 4 décimales ; `null` (et non 0) si `open = 0` |
| `overall.completionRate` | tâches `done` ÷ toutes les tâches du compte ; `null` si aucune tâche |
| `trend.delta` | taux de la semaine courante − taux de la semaine précédente ; `null` si l'un des deux manque |

Une tâche terminée pendant S était forcément ouverte pendant S, donc le taux hebdomadaire est toujours compris entre 0 et 1. Une tâche rouverte compte comme ouverte, plus comme terminée. Les tâches passées à `done` avant l'ajout de `completedAt` sont rattachées à leur dernière modification (seule information disponible).

```bash
curl -s "http://localhost:3000/api/tasks/stats/weekly?weeks=3&today=2026-10-07&tzOffset=-120" -H "Authorization: Bearer $TOKEN"
# → {"weeks":3,"today":"2026-10-07","tzOffset":-120,
#    "series":[{"weekStart":"2026-09-21","weekEnd":"2026-09-27","created":2,"completed":1,"open":2,"completionRate":0.5}, …],
#    "overall":{"total":5,"done":3,"completionRate":0.6},
#    "trend":{"currentRate":0.3333,"previousRate":0.5,"delta":-0.1667}}
```

Côté interface : page **Statistiques** (`/stats`) avec chiffres clés, graphique en barres du taux par semaine (une barre par semaine, info-bulle au survol et au clavier, semaine courante mise en évidence), tableau détaillé et choix de la période (4, 8, 12 ou 26 semaines, reflété dans l'URL). Le détail d'une tâche terminée affiche « Terminée le ».

Exemple complet :

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" \
  -d '{"email":"alice@example.test","password":"MotDePasse123!"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).token")

curl -s -X POST http://localhost:3000/api/tasks -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Préparer la démo","status":"todo","description":"Plan et données","dueDate":"2026-10-05"}'
# → 201 {"id":"…","title":"Préparer la démo","status":"todo","description":"Plan et données","dueDate":"2026-10-05",…}

curl -s http://localhost:3000/api/tasks -H "Authorization: Bearer $TOKEN"            # 200 {"items":[…]}
curl -s -X PATCH http://localhost:3000/api/tasks/<id> -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"status":"done"}'                          # 200
curl -s -i -X DELETE http://localhost:3000/api/tasks/<id> -H "Authorization: Bearer $TOKEN"   # 204
```

La documentation interactive (Swagger UI) permet de rejouer ces appels : bouton **Authorize**, coller le token, puis **Try it out**.

## 11. Sécurité

- **Mots de passe** : jamais stockés en clair. `bcrypt.hash(password, BCRYPT_ROUNDS)` produit un hash salé ; la connexion compare avec `bcrypt.compare`. Les réponses ne contiennent jamais `password` ni `passwordHash` (filtré par le `toJSON` du modèle `User`).
- **Email** : validé par expression régulière, normalisé en minuscules à l'inscription et à la connexion ; index unique en base. Un email déjà utilisé répond 409.
- **JWT** : `jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })`, algorithme HS256. Le serveur ne stocke rien : la signature prouve que le jeton a été émis avec la clé serveur et n'a pas été altéré. `requireAuth` vérifie signature, expiration et algorithme (`alg: none` refusé), puis extrait l'identifiant utilisateur. Jeton absent, invalide, falsifié ou expiré → 401.
- **Expiration** : `JWT_EXPIRES_IN=1h` par défaut. Un jeton volé ne reste utilisable que jusqu'à son `exp` ; en contrepartie l'utilisateur doit se reconnecter. Le front détecte l'expiration de deux façons : à l'ouverture il ignore un jeton dont `exp` est dépassé, et toute réponse 401 déconnecte avec le message « Votre session a expiré ». Il n'y a pas de révocation côté serveur (voir limites).
- **Stockage du jeton dans le navigateur** : `localStorage` (clé `taskflow.session`). Avantages : simple, survit au rechargement, envoyé explicitement en en-tête `Authorization` donc insensible au CSRF. Inconvénient : lisible par tout script exécuté sur la page, donc vulnérable en cas de faille XSS. L'alternative (cookie `httpOnly` + `SameSite` + protection CSRF) protège mieux contre XSS mais complexifie l'API ; le choix `localStorage` est assumé pour ce TP et documenté comme limite.
- **Isolation des comptes** : `ownerId` est déduit du JWT vérifié, jamais du corps de la requête (`id`/`ownerId` fournis par le client → 400). Toutes les requêtes Mongo filtrent sur `ownerId`. Une tâche d'un autre compte répond 404 comme une tâche inexistante : on ne révèle pas son existence.
- **Validation serveur** : systématique, indépendante du formulaire React. Masquer un bouton dans l'interface n'est pas une autorisation.
- **Erreurs** : enveloppe unique, messages lisibles, aucune trace ni détail interne ; les erreurs inattendues donnent un 500 générique et sont journalisées côté serveur.
- **Hygiène** : `.env`, `node_modules`, `dist` ignorés par Git ; `.env.example` ne contient que des valeurs fictives ; `X-Powered-By` désactivé ; corps JSON limité à 100 ko.

## 12. Outillage : Vite, Babel, Webpack, CI/CD

- **Vite** sert le front en développement (modules ES natifs, rechargement instantané, proxy `/api`) et produit le build de production avec Rollup (`npm run build` → `frontend/dist`, fichiers minifiés et fingerprintés). Le JSX est transformé par `@vitejs/plugin-react` (esbuild/oxc), sans configuration Babel manuelle.
- **Babel** est un transpileur : il réécrit du JavaScript moderne ou du JSX en code compris par des environnements plus anciens. Historiquement associé à Webpack ; ici il n'est pas nécessaire, Vite s'appuie sur des outils plus rapides pour le même rôle.
- **Webpack** est un bundler : il assemble modules, CSS et images en quelques fichiers optimisés. Vite joue ce rôle via Rollup pour la production, avec une expérience de développement plus rapide (pas de bundle complet à chaque modification).
- **Place des tests dans la chaîne CI/CD** (détail en section 15) : à chaque pull request, `CI` joue lint, tests Jest (contre un conteneur `mongo:7`), build et construction des images ; `Intégration` démarre la pile Docker complète et y rejoue la recette API puis la suite Playwright. Une fusion dans `main` déclenche `Production` : publication des images, déploiement Cloud Run (si configuré) et tests de fumée contre l'URL déployée. Les tests sont donc la porte de qualité avant toute fusion et avant toute mise en production.

## 13. Limites connues et améliorations

- Pas de révocation de JWT (déconnexion = suppression du jeton côté client ; un jeton volé reste valide jusqu'à expiration). Amélioration : jetons courts + refresh token, ou liste de révocation.
- Jeton en `localStorage` (voir section 11). Amélioration : cookie `httpOnly` + CSRF.
- Pas de limitation de débit sur `/api/auth/login` (force brute possible). Amélioration : `express-rate-limit`.
- La connexion répond un peu plus vite quand l'email n'existe pas (pas de `bcrypt.compare`) : différence de temps mesurable en théorie. Amélioration : comparer contre un hash factice.
- Pas de pagination : la liste renvoie toutes les tâches du compte (filtrées ou non). Suffisant pour un usage personnel, à revoir au-delà de quelques centaines de tâches.
- Les compteurs (`/tasks/stats`) et les séries hebdomadaires (`/tasks/stats/weekly`) sont calculés en JavaScript après lecture des tâches du compte, pas par agrégation MongoDB : simple à expliquer et à tester unitairement, à remplacer par un pipeline `$group` si le volume grandit.
- `completedAt` n'existe que depuis le bonus B4 : les tâches terminées auparavant sont rattachées à leur dernière modification, approximation documentée.
- Le front est couvert par la suite Playwright de bout en bout (`e2e/`, 19 tests en intégration) mais n'a pas de tests unitaires de composants. Amélioration : React Testing Library sur `TaskForm` et `AuthContext`.
- Déploiement : la chaîne est prête (images, Cloud Run, tests de fumée) et s'active dès qu'un projet Google Cloud est renseigné dans GitHub ; la modalité de rendu n'étant pas confirmée par l'établissement, aucune URL publique n'est imposée (voir `docs/DEPLOYMENT.md`).

## 14. Livrables et points à confirmer

Livrables présents dans ce dépôt : code front et back, suite de tests exécutable, `README.md`, `.env.example` (sans secret), documentation OpenAPI (`/api/docs`), checklist de recette (`docs/RECETTE.md`), préparation de soutenance (`docs/SOUTENANCE.md`), historique Git.

**Versions** : le tag `rendu-v1` marque le MVP seul, `rendu-v2` le MVP + bonus B1, `rendu-v3` le MVP + bonus B1 et B4. Le SHA d'un tag s'obtient avec `git rev-list -n 1 <tag>`. `docs/RECETTE.md` indique le SHA du code sur lequel chaque recette a été exécutée.

Points **non confirmés par l'établissement** au moment de la rédaction (section 10 du livret), donc non traités ici : dépôt GitHub public ou privé, archive ZIP, plateforme de dépôt et date de gel, obligation de déploiement cloud, barème, calendrier des soutenances, politique d'utilisation de l'IA.

## 15. Environnements, conteneurs et chaîne CI/CD

Le projet est organisé pour être livré par **pull requests** et validé automatiquement à chaque étape. Détails : `docs/BRANCHING.md` (branches, tickets, releases) et `docs/DEPLOYMENT.md` (environnements, variables, déploiement, évolutions).

**Branches** : `main` = production (releases taguées `rendu-vN`), `develop` = intégration, `feature/*` / `ci/*` / `chore/*` = travail en cours. Tout passe par une pull request vers `develop`, puis une pull request de release `develop → main`. Chaque étape a un ticket GitHub (libellés `étape`, `bonus`, `ci-cd`, `infra`, `documentation`) référencé par sa pull request : ticket + pull request + exécutions GitHub Actions = preuve de l'étape.

**Trois environnements, un seul code** :

| Environnement | Construction | Validation |
| --- | --- | --- |
| Développement (poste) | `docker compose up -d`, `npm run dev:backend`, `npm run dev:frontend` | `npm run verify`, `node scripts/recette.js`, `npm run e2e` |
| Intégration (runner GitHub, éphémère ; reproductible avec `npm run int:up`) | `infra/compose/docker-compose.int.yml` : MongoDB + `backend/Dockerfile` + `frontend/Dockerfile` (nginx qui relaie `/api`) | workflow `Intégration` : recette API 60 points + Playwright 19 tests, rapport en artefact |
| Production (Google Cloud Run + MongoDB Atlas) | workflow `Production` : images sur GHCR (`ghcr.io/<owner>/taskflow-api`, `taskflow-web`, tags `<sha>` et `latest`), copie vers Artifact Registry, déploiement | tests de fumée Playwright `@smoke` (sans écriture) contre l'URL déployée |

**Workflows** (`.github/workflows/`) :

| Workflow | Déclencheur | Ce qu'il fait |
| --- | --- | --- |
| `CI` | pull request ; push sur `develop`, `main` | lint + tests backend (Mongo en service), lint + build frontend, construction des deux images Docker |
| `Intégration` | pull request vers `develop` ou `main` ; push sur `develop` | démarre la pile Docker complète, rejoue la recette API puis la suite Playwright, publie le rapport, affiche les journaux en cas d'échec |
| `Production` | push sur `main` ; manuel | publie les images, déploie sur Cloud Run si la variable `GCP_PROJECT_ID` est définie, puis rejoue les tests de fumée |

**Activer le déploiement** : créer un cluster MongoDB Atlas, lancer `infra/gcp/setup.sh` sur un projet Google Cloud (crée Artifact Registry, le compte de service, la fédération d'identité GitHub sans clé JSON et les secrets), puis renseigner dans GitHub les variables `GCP_PROJECT_ID`, `GCP_REGION`, `PROD_WEB_ORIGIN` et les secrets `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`. Tant que ce n'est pas fait, le job de déploiement est ignoré et le workflow reste vert.

**Évolutions** : chaque service supplémentaire (par exemple un assistant s'appuyant sur Vertex AI) suit le même modèle : son conteneur, son entrée dans la pile d'intégration, son job de déploiement, ses tests et son ticket, sans modifier le contrat des cinq routes du livret (voir `docs/DEPLOYMENT.md`).
