# Checklist de recette (partie 7 du livret)

À dérouler avant tout rendu, avec **deux comptes**, **plusieurs entrées invalides** et **un redémarrage de l'API**. Ne cocher un point qu'après l'avoir réellement essayé. Ordre de correction en cas d'échec (TP 10) : sécurité, routes non conformes, CRUD et démarrage, puis qualité et documentation.

Pré-requis : `docker compose up -d`, `npm run dev --prefix backend`, `npm run dev --prefix frontend` (voir README).

Outils : `node scripts/recette.js` joue automatiquement les points marqués **[script]** contre l'API démarrée ; `npm run verify` joue lint, tests et build ; les points **[navigateur]** se vérifient sur http://localhost:5173.

## Installation et démarrage

- [x] Le dépôt contient le code source React et Express et ne contient ni secrets ni `node_modules` — `git ls-files | grep -E "node_modules|\.env$"` ne renvoie rien ; `.env.example` ne contient que des valeurs fictives.
- [x] Une personne peut suivre le `README.md` et configurer les variables via `.env.example` — sections 3 à 6 du README, commandes réellement exécutées.
- [x] MongoDB, le serveur et le front démarrent en suivant les commandes documentées — `docker compose up -d`, `npm run dev:backend`, `npm run dev:frontend`.
- [x] `GET /api/health` répond 200 avec exactement `{"status":"ok"}` — **[script]** et `curl -s http://localhost:3000/api/health`.
- [x] Le build React, le lint et la commande de tests documentée s'exécutent — `npm run verify`.

## Authentification et droits

- [x] Inscription A : 201, objet `user` et JWT signé, sans mot de passe ni hash exposé — **[script]** ; `tests/auth.test.js` vérifie en plus le hash bcrypt en base.
- [x] Connexion A : 200 et JWT ; mauvaise combinaison email/mot de passe : 401 — **[script]**.
- [x] Email déjà utilisé : 409 ; mot de passe trop court ou email invalide : 400 — **[script]**.
- [x] Sans JWT ou avec JWT falsifié, toute route métier refuse l'accès avec 401 — **[script]** (sans jeton, signature modifiée, jeton quelconque) ; `tests/auth.middleware.test.js` couvre aussi expiré, `alg: none`, contenu altéré, sur les cinq routes.
- [x] Créer aussi le compte B ; sa liste ne contient aucun objet A — **[script]**.
- [x] Sur l'id d'un objet A encore existant, B reçoit 404 en GET, PATCH et DELETE — **[script]**, puis relecture par A : objet intact.
- [x] Envoyer `id` ou `ownerId` dans un POST/PATCH métier est refusé avec 400 — **[script]**.

## CRUD, données et erreurs

- [x] Les cinq routes exactes du sujet sont implémentées avec leurs méthodes HTTP exactes — `backend/src/routes/task.routes.js` ; Swagger sur `/api/docs`.
- [x] `GET` collection répond 200 avec `{"items":[]}` si la collection du compte est vide — **[script]** (corps exact).
- [x] `POST` d'un objet valide répond 201 et retourne un objet dont `id` est une chaîne — **[script]** (ni `_id` ni `ownerId` exposés).
- [x] `GET` par id et `PATCH` valide répondent 200 et retournent les objets attendus — **[script]**.
- [x] `PATCH` partiel valide fonctionne ; `PATCH` vide ou champ interdit/invalide donne 400 — **[script]** (vide, champ inconnu, `ownerId`, `id`, statut invalide).
- [x] `DELETE` répond 204 sans corps ; `GET` sur l'id supprimé donne 404 — **[script]**.
- [x] Un id malformé donne 400 ; un id valide absent donne 404 — **[script]**.
- [x] Les champs, valeurs et règles de validation du sujet sont respectés — **[script]** : `status: "archived"`, titre vide après trim, 121 caractères, description 1001 caractères, `2026-02-30`, `05/10/2026`, titre manquant → 400 ; `tests/tasks.validation.test.js` ajoute 36 autres cas.
- [x] Les réponses applicatives d'erreur utilisent `error.code` et `error.message` selon le contrat — **[script]** vérifie l'enveloppe sur chaque erreur, y compris la route inconnue et le JSON mal formé.
- [x] Une donnée non supprimée reste disponible après redémarrage du serveur — procédure ci-dessous, plus `tests/persistence.test.js`.

### Procédure de persistance après redémarrage

1. `node scripts/recette.js` : la fin de la sortie donne l'identifiant d'une tâche conservée et la commande `curl` à rejouer.
2. Arrêter l'API (Ctrl+C dans le terminal `npm run dev:backend`).
3. Relancer `npm run dev:backend`, attendre `MongoDB connecté`.
4. Rejouer la commande `curl` : HTTP 200, mêmes `id`, `title`, `status`, `description`, `dueDate`.
5. Dans le navigateur, recharger la liste : la tâche est toujours affichée.

## Front-end, qualité et documentation

- [x] Inscription, connexion et CRUD sont réalisables dans React, pas seulement dans un client HTTP — **[navigateur]** : `/register`, `/login`, `/tasks`, `/tasks/new`, `/tasks/:id` (modifier, supprimer).
- [x] Les formulaires affichent des erreurs lisibles ; chargement, succès et suppression sont compréhensibles — **[navigateur]** : messages « Cet email est déjà utilisé », « Email ou mot de passe incorrect », « Chargement des tâches… », « Tâche « … » créée / mise à jour / supprimée », confirmation avant suppression, « Votre session a expiré ».
- [x] L'interface reste utilisable sur un écran mobile ; les contrôles principaux sont accessibles au clavier — **[navigateur]** : largeur 375 px sans défilement horizontal ; Tab atteint les liens et boutons, focus visible (contour orange), Entrée active.
- [x] Les tests Jest/Supertest couvrent le nominal, l'entrée invalide, l'absence de JWT et l'isolation A/B — `npm test` : 7 fichiers, 108 tests.
- [x] `README.md` contient toutes les commandes réellement nécessaires, les choix d'architecture et les limites.
- [x] Swagger/OpenAPI reflète les routes, schémas et codes d'erreur réellement implémentés — `backend/src/docs/openapi.json`, servi sur `/api/docs` ; relu route par route contre `task.routes.js` et `auth.routes.js`.
- [x] Le commit SHA final est identifiable et la version démontrée correspond à celle rendue — tag `rendu-v1`, voir ci-dessous.

## Bonus B1 : priorité, filtres et compteurs (après validation du MVP)

Critères d'acceptation définis dans le README (section 10) ; chaque point ci-dessous a été exécuté.

- [x] `priority` vaut `medium` par défaut, accepte `low`/`medium`/`high` en POST et PATCH, refuse toute autre valeur avec 400 — **[script]** et `tests/tasks.bonus-b1.test.js`.
- [x] `GET /api/tasks` sans paramètre renvoie exactement la même enveloppe qu'avant (`{"items":[…]}`) — **[script]**, test « sans paramètre ».
- [x] Filtres `status`, `priority`, `due` (`overdue`, `today`, `upcoming`, `none`) et `today`, seuls et combinés — **[script]** (`status=done`, `priority=high`, `due=overdue`) ; les 4 valeurs de `due` et les combinaisons sont couvertes par les tests.
- [x] Valeur hors liste, paramètre inconnu ou répété → 400 `INVALID_INPUT` — **[script]** (`due=yesterday`, `page=1`) et tests.
- [x] `GET /api/tasks/stats` renvoie `total`, `byStatus`, `byPriority`, `overdue` pour le compte connecté ; 401 sans JWT ; 400 si `today` invalide — **[script]** et tests.
- [x] Isolation A/B conservée : aucun filtre ni compteur de B ne voit les tâches de A — **[script]** (compteurs de B à zéro) et tests.
- [x] Les cinq routes de base et la suite de tests du MVP passent toujours — `npm test` : 145 tests.
- [x] Interface : sélecteur de priorité, pastille de priorité (liste et détail), compteurs, barre de filtres reflétée dans l'URL, date locale envoyée en `today` — **[navigateur]**.

## Résultats de la recette du 7 octobre 2026

Environnement : Windows 11, Node.js 20.19.5, npm 11.6.4, MongoDB 7 (Docker `taskflow-mongo`), Chrome (parcours navigateur).

| Vérification | Résultat |
| --- | --- |
| `npm run lint --prefix backend` | OK, 0 erreur |
| `npm run lint --prefix frontend` | OK, 0 erreur |
| `npm test --prefix backend` | 8 suites, **145 tests OK** en ~10 s (base MongoDB en mémoire), dont 37 pour le bonus B1 |
| `npm run build --prefix frontend` | OK (`dist/` : index.html, CSS 6 ko, JS 282 ko / 88 ko gzip) |
| `node scripts/recette.js` | **52/52 points OK** (42 MVP + 10 bonus B1) |
| Redémarrage de l'API puis relecture de la tâche conservée | HTTP 200, mêmes données (`id 6ac648b33df272e2887f5777`, titre « Préparer la démo », statut `done`) |
| Mutation : suppression du filtre `ownerId` dans `task.service.js` | 6 des 11 tests de `tasks.isolation.test.js` échouent, puis repassent après restauration |
| Parcours navigateur (inscription, erreurs 409/401, création, détail, modification, rechargement, annulation puis confirmation de suppression, tâche supprimée → « introuvable », mobile 375 px, Tab/Entrée/focus visible, jeton falsifié → « session expirée », reconnexion, déconnexion) | 30/30 vérifications OK |
| Parcours navigateur bonus B1 (priorité haute à la création, pastille dans la liste et le détail, 5 compteurs, filtres statut/priorité/échéance, URL `?status=…`, `today=` envoyé à l'API, réinitialisation) | 10/10 vérifications OK (40/40 au total) |

Version recettée (MVP seul) : commit `bf16ad4029aa82747918291826aeaec950804631`, tag `rendu-v1`. Version recettée (MVP + bonus B1) : commit `49fbb49cc4fd584e99413bfa7bef0191f762b34a` (les commits suivants ne touchent que la documentation), tag `rendu-v2` (`git rev-list -n 1 rendu-v2`).
