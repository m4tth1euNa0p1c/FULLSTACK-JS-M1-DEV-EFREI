# Modèle de branches, tickets et pull requests

## Branches

| Branche | Rôle | Protection attendue | Déclenche |
| --- | --- | --- | --- |
| `main` | **Production.** Ne reçoit que des fusions depuis `develop` (releases). Chaque release est taguée `rendu-vN`. | Pull request obligatoire, CI verte | `CI`, puis `Production` (images GHCR, déploiement Cloud Run si configuré, tests de fumée) |
| `develop` | **Intégration.** Reçoit les fonctionnalités terminées. Toujours déployable. | Pull request obligatoire, CI verte | `CI` et `Intégration` (pile Docker + recette API + Playwright) |
| `feature/<sujet>` | Une fonctionnalité ou un bonus (ex. `feature/b4-statistiques`). | — | `CI` et `Intégration` sur sa pull request |
| `ci/<sujet>`, `chore/<sujet>`, `fix/<sujet>` | Outillage, maintenance, correction. | — | idem |

Les branches de travail partent de `develop` et y reviennent par pull request. Elles sont supprimées après fusion. Personne ne pousse directement sur `main` ni sur `develop`.

> Les règles de protection de branche (pull request obligatoire, vérifications requises) se configurent dans *Settings → Branches*. Sur un dépôt privé, GitHub ne les propose qu'avec un plan payant ; à défaut, la règle est appliquée par discipline et vérifiable dans l'historique (chaque commit de `main` et `develop` est un commit de fusion de pull request).

## Tickets

Chaque étape du TP et chaque évolution a un **ticket GitHub** (issue) qui décrit l'objectif, les critères d'acceptation et les preuves attendues. Libellés :

| Libellé | Usage |
| --- | --- |
| `étape` | Étape du livret (TP 1 à TP 12) |
| `bonus` | Bonus du livret (B1 à B4) |
| `ci-cd` | Intégration et déploiement continus |
| `infra` | Conteneurs, environnements, cloud |
| `documentation` | README, recette, soutenance |

La pull request qui réalise un ticket le référence dans sa description (`Closes #N`). Comme les fusions se font dans `develop` et non dans la branche par défaut, GitHub ne ferme pas le ticket automatiquement : il est fermé à la fusion avec un commentaire qui pointe la pull request, le commit de fusion et les résultats de recette. **Le ticket, sa pull request et les exécutions GitHub Actions associées constituent la preuve de l'étape.**

## Pull requests

- Une pull request = un ticket = une branche. Titre court en français, description selon le modèle `.github/PULL_REQUEST_TEMPLATE.md` (objectif, changements, vérifications effectuées).
- Fusion par **commit de merge** (`Titre (#N)`) pour conserver l'historique de la branche et le lien vers la pull request.
- Conditions de fusion : workflow `CI` vert (lint backend et frontend, tests Jest, build, images Docker) et, pour `develop` et `main`, workflow `Intégration` vert (pile Docker, 60 points de recette API, suite Playwright).
- Les commits sont écrits en français, à l'indicatif, sans mention d'outil ; aucun `.env`, `node_modules` ni secret.

## Releases

1. Ouvrir une pull request `develop → main` intitulée `Release rendu-vN : …`.
2. Attendre `CI` et `Intégration` verts, fusionner.
3. Le workflow `Production` publie les images `ghcr.io/<owner>/taskflow-api` et `taskflow-web` (tags `<sha>` et `latest`), déploie sur Cloud Run si le projet Google Cloud est configuré, puis rejoue les tests de fumée.
4. Poser le tag annoté `rendu-vN` sur le commit de fusion et le pousser : `git tag -a rendu-vN -m "…" && git push origin rendu-vN`.
5. Mettre à jour `docs/RECETTE.md` (SHA recetté, résultats) si nécessaire.

## Historique des versions

| Tag | Contenu |
| --- | --- |
| `rendu-v1` | MVP du livret (TP 1 à TP 11) |
| `rendu-v2` | MVP + bonus B1 |
| `rendu-v3` | MVP + bonus B1 et B4, tests Playwright, conteneurs, chaîne intégration / production |
