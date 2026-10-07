# infra/

Tout ce qui sert à exécuter TaskFlow ailleurs que sur un poste de développement.

| Chemin | Rôle |
| --- | --- |
| `compose/docker-compose.int.yml` | Pile d'intégration complète (MongoDB + API + front nginx) construite depuis les sources. Utilisée par le workflow « Intégration » et reproductible en local (`npm run int:up`). |
| `gcp/setup.sh` | Mise en place, une seule fois, de l'infrastructure Google Cloud du workflow « Production » : Artifact Registry, compte de service, fédération d'identité GitHub, secrets. |

Les images elles-mêmes sont décrites au plus près du code : `backend/Dockerfile` et `frontend/Dockerfile` (+ `frontend/nginx/default.conf.template`). Le MongoDB de développement reste dans le `docker-compose.yml` à la racine.

Le détail des environnements, des variables et de la procédure de déploiement est dans `docs/DEPLOYMENT.md`.
