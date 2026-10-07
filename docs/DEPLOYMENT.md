# Environnements, conteneurs et déploiement

## Vue d'ensemble

| Environnement | Où | Comment il est construit | Qui le valide |
| --- | --- | --- | --- |
| **Développement** | Poste du développeur | `docker compose up -d` (MongoDB), `npm run dev:backend`, `npm run dev:frontend` | `npm run verify`, `node scripts/recette.js`, `npm run e2e` (contre http://localhost:5173) |
| **Intégration** | Runner GitHub Actions, éphémère (et reproductible en local) | `infra/compose/docker-compose.int.yml` : images construites depuis les sources, MongoDB + API + front nginx | Workflow `Intégration` : recette API (60 points) + suite Playwright complète (19 tests), rapport publié en artefact |
| **Production** | Google Cloud Run (deux services) + MongoDB Atlas | Images publiées sur GHCR par le workflow `Production`, copiées vers Artifact Registry, déployées | Tests de fumée Playwright `@smoke` (sans écriture) contre l'URL déployée |

Les trois environnements exécutent **le même code et les mêmes images** ; seules les variables d'environnement changent (voir plus bas). Rien n'est spécifique à un environnement dans le code.

## Images Docker

| Image | Dockerfile | Contenu | Port |
| --- | --- | --- | --- |
| `taskflow-api` | `backend/Dockerfile` | Node.js 20 (Debian slim), dépendances de production uniquement, `node src/server.js`, utilisateur `node`, healthcheck sur `/api/health` | `3000` |
| `taskflow-web` | `frontend/Dockerfile` | Étape 1 : `npm run build` (Vite). Étape 2 : nginx qui sert `dist/` et relaie `/api/` vers `API_UPSTREAM` | `8080` |

Le front et l'API sont servis **sur la même origine** (nginx fait le proxy), donc aucune configuration CORS n'est nécessaire côté navigateur ; `CORS_ORIGIN` reste utile si l'API est appelée directement.

Construire et lancer la pile localement :

```bash
npm run int:up                         # construit les images et attend que les trois services soient sains
curl -s http://localhost:8080/api/health          # {"status":"ok"} via nginx
E2E_BASE_URL=http://localhost:8080 npm run e2e    # suite Playwright complète
API_URL=http://localhost:3000/api node scripts/recette.js
npm run int:down                       # arrête et supprime les volumes
```

Si le port 3000 est déjà pris par l'API de développement : `API_PORT=3001 npm run int:up` puis `API_URL=http://localhost:3001/api node scripts/recette.js`.

## Variables d'environnement par service

| Variable | API | Front (nginx) | Dév | Intégration | Production |
| --- | --- | --- | --- | --- | --- |
| `PORT` | ✓ | ✓ | 3000 / 5173 | 3000 / 8080 | fourni par Cloud Run |
| `MONGO_URI` | ✓ | | `mongodb://127.0.0.1:27017/taskflow` | `mongodb://mongo:27017/taskflow_int` | secret `taskflow-mongo-uri` (Atlas) |
| `JWT_SECRET` | ✓ | | `.env` local | `INT_JWT_SECRET` (secret GitHub) ou valeur de test | secret `taskflow-jwt-secret` |
| `JWT_EXPIRES_IN` | ✓ | | `1h` | `1h` | `1h` |
| `BCRYPT_ROUNDS` | ✓ | | `10` | `10` | `10` |
| `CORS_ORIGIN` | ✓ | | `http://localhost:5173` | `http://localhost:8080` | variable `PROD_WEB_ORIGIN` |
| `API_UPSTREAM` | | ✓ | — (proxy Vite) | `http://api:3000` | URL du service `taskflow-api` |

Aucune de ces valeurs n'est dans le code ni dans Git, à l'exception des valeurs de test de l'intégration, non secrètes.

## Workflows GitHub Actions

| Workflow | Déclencheur | Jobs | Durée indicative |
| --- | --- | --- | --- |
| `CI` (`ci.yml`) | pull request ; push sur `develop` et `main` | lint + tests backend (Mongo en service), lint + build frontend, construction des deux images | 2 min |
| `Intégration` (`integration.yml`) | pull request vers `develop` ou `main` ; push sur `develop` | pile compose, recette API, Playwright, rapport en artefact, journaux si échec | 5 min |
| `Production` (`production.yml`) | push sur `main` ; manuel | `images` (GHCR), `deploy` (Cloud Run, si `GCP_PROJECT_ID` défini), `smoke` (Playwright `@smoke`) | 3 à 8 min |

Les environnements GitHub `integration` et `production` portent les secrets et peuvent recevoir des règles de protection (approbation manuelle avant déploiement) selon le plan du compte.

## Mettre en place la production (une seule fois)

1. **MongoDB** : créer un cluster MongoDB Atlas (offre gratuite suffisante), un utilisateur de base et autoriser l'accès réseau depuis Cloud Run (`0.0.0.0/0` ou un connecteur VPC). Récupérer la chaîne `mongodb+srv://…/taskflow`.
2. **Google Cloud** : choisir un projet avec facturation, puis exécuter depuis la racine :

   ```bash
   PROJECT_ID=<projet> REGION=europe-west1 \
   GITHUB_REPO=m4tth1euNa0p1c/FULLSTACK-JS-M1-DEV-EFREI \
   MONGO_URI='mongodb+srv://…' ./infra/gcp/setup.sh
   ```

   Le script active les API, crée le dépôt Artifact Registry `taskflow`, le compte de service `github-deployer`, la fédération d'identité GitHub (le workflow s'authentifie par OIDC, **sans clé JSON**) et les secrets `taskflow-jwt-secret` et `taskflow-mongo-uri`. Il affiche à la fin les valeurs à reporter dans GitHub.
3. **GitHub** (*Settings → Secrets and variables → Actions*) :
   - variables : `GCP_PROJECT_ID`, `GCP_REGION`, `PROD_WEB_ORIGIN` ;
   - secrets : `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT` ;
   - facultatif : `INT_JWT_SECRET` pour l'intégration.
4. Fusionner `develop` dans `main` (ou lancer `Production` manuellement). Le premier déploiement affiche l'URL du front dans l'environnement `production` ; la reporter dans `PROD_WEB_ORIGIN` et relancer une fois pour que l'API n'accepte que cette origine.

Tant que `GCP_PROJECT_ID` n'est pas défini, le job `deploy` est ignoré : le workflow publie les images sur GHCR et reste vert.

## Exploitation

- **Retour arrière** : redéployer une image précédente (`ghcr.io/<owner>/taskflow-api:<sha>`) via `gcloud run deploy … --image` ou relancer le workflow sur l'ancien commit ; Cloud Run conserve aussi les révisions précédentes (`gcloud run services update-traffic`).
- **Journaux** : Cloud Logging (`gcloud run services logs read taskflow-api --region $REGION`). L'API ne journalise que les erreurs inattendues, jamais de données personnelles.
- **Coûts** : Cloud Run facture à l'usage avec un palier gratuit ; `--min-instances=0` évite toute instance permanente. Atlas M0 est gratuit. GHCR est inclus avec GitHub.
- **Sécurité** : secrets dans Secret Manager, lus par le compte d'exécution de Cloud Run ; aucun secret dans les images ni dans les workflows ; authentification GitHub → Google Cloud sans clé longue durée.

## Évolutions prévues : Vertex AI et autres services conteneurisés

L'architecture est pensée pour accueillir d'autres services sans toucher au contrat de l'API :

- **Un service par conteneur** : chaque nouveau service (par exemple `taskflow-assistant`, qui appellerait Vertex AI pour suggérer une priorité ou résumer une liste de tâches) a son dossier, son `Dockerfile`, son entrée dans `docker-compose.int.yml` et son job de déploiement Cloud Run dans `production.yml`, sur le même modèle que `api` et `web`.
- **Accès à Vertex AI sans clé** : le service tourne sur Cloud Run avec un compte de service dédié portant `roles/aiplatform.user` ; le SDK Google utilise l'identité du conteneur. Rien à stocker dans GitHub.
- **Intégration côté API** : l'API expose le service derrière une route additionnelle (`/api/assistant/...`), protégée par le même middleware `requireAuth` ; nginx relaie `/api/` sans changement.
- **Contrat intact** : les cinq routes du livret et leurs tests restent la référence ; tout nouveau service a ses propres critères d'acceptation, tests dédiés et ticket, comme les bonus B1 et B4.
