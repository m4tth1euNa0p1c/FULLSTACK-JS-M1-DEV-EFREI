#!/usr/bin/env bash
# Mise en place, une seule fois, de l'infrastructure Google Cloud nécessaire au workflow
# .github/workflows/production.yml : Artifact Registry, compte de service de déploiement,
# fédération d'identité GitHub (aucune clé JSON à stocker), secrets applicatifs.
#
# Pré-requis : gcloud authentifié sur un compte propriétaire du projet, facturation activée.
# Usage :
#   PROJECT_ID=mon-projet REGION=europe-west1 GITHUB_REPO=m4tth1euNa0p1c/FULLSTACK-JS-M1-DEV-EFREI \
#   MONGO_URI='mongodb+srv://...' ./infra/gcp/setup.sh
#
# Le script est idempotent : relancer ne casse rien (les ressources existantes sont réutilisées).
set -euo pipefail

: "${PROJECT_ID:?PROJECT_ID manquant}"
: "${REGION:=europe-west1}"
: "${GITHUB_REPO:?GITHUB_REPO manquant (owner/repo)}"
: "${MONGO_URI:?MONGO_URI manquant (chaîne MongoDB Atlas ou autre MongoDB joignable depuis Cloud Run)}"

POOL="github"
PROVIDER="github-oidc"
DEPLOYER="github-deployer"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"

echo "→ Projet $PROJECT_ID ($PROJECT_NUMBER), région $REGION, dépôt $GITHUB_REPO"
gcloud config set project "$PROJECT_ID" >/dev/null

echo "→ Activation des API"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com iam.googleapis.com \
  iamcredentials.googleapis.com secretmanager.googleapis.com sts.googleapis.com

echo "→ Dépôt Artifact Registry 'taskflow'"
gcloud artifacts repositories describe taskflow --location="$REGION" >/dev/null 2>&1 ||
  gcloud artifacts repositories create taskflow --repository-format=docker --location="$REGION" \
    --description="Images TaskFlow (API et front)"

echo "→ Compte de service de déploiement"
gcloud iam service-accounts describe "$DEPLOYER@$PROJECT_ID.iam.gserviceaccount.com" >/dev/null 2>&1 ||
  gcloud iam service-accounts create "$DEPLOYER" --display-name="Déploiement GitHub Actions"
for role in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$DEPLOYER@$PROJECT_ID.iam.gserviceaccount.com" --role="$role" --quiet >/dev/null
done

echo "→ Fédération d'identité GitHub (OIDC)"
gcloud iam workload-identity-pools describe "$POOL" --location=global >/dev/null 2>&1 ||
  gcloud iam workload-identity-pools create "$POOL" --location=global --display-name="GitHub Actions"
gcloud iam workload-identity-pools providers describe "$PROVIDER" --location=global --workload-identity-pool="$POOL" >/dev/null 2>&1 ||
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" --location=global \
    --workload-identity-pool="$POOL" --display-name="GitHub OIDC" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
    --attribute-condition="assertion.repository == '$GITHUB_REPO'"
gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER@$PROJECT_ID.iam.gserviceaccount.com" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/attribute.repository/$GITHUB_REPO" --quiet >/dev/null

echo "→ Secrets applicatifs (Secret Manager)"
JWT_SECRET_VALUE="$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))" 2>/dev/null || openssl rand -hex 48)"
for pair in "taskflow-jwt-secret=$JWT_SECRET_VALUE" "taskflow-mongo-uri=$MONGO_URI"; do
  name="${pair%%=*}"; value="${pair#*=}"
  gcloud secrets describe "$name" >/dev/null 2>&1 || gcloud secrets create "$name" --replication-policy=automatic
  printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- >/dev/null
done
# Le compte d'exécution par défaut de Cloud Run doit pouvoir lire les secrets.
RUNTIME_SA="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
for name in taskflow-jwt-secret taskflow-mongo-uri; do
  gcloud secrets add-iam-policy-binding "$name" --member="serviceAccount:$RUNTIME_SA" \
    --role=roles/secretmanager.secretAccessor --quiet >/dev/null
done

cat <<EOF

Terminé. À renseigner dans GitHub (Settings → Secrets and variables → Actions) :

  Variables (vars)
    GCP_PROJECT_ID   = $PROJECT_ID
    GCP_REGION       = $REGION
    PROD_WEB_ORIGIN  = https://taskflow-web-<hash>-<region>.a.run.app   (à compléter après le premier déploiement)

  Secrets
    GCP_WORKLOAD_IDENTITY_PROVIDER = projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/providers/$PROVIDER
    GCP_SERVICE_ACCOUNT            = $DEPLOYER@$PROJECT_ID.iam.gserviceaccount.com

Le workflow "Production" déploiera ensuite à chaque fusion dans main.
EOF
