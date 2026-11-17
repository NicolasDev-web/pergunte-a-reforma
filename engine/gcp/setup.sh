#!/usr/bin/env bash
# Configuração ÚNICA do Google Cloud para o motor (rode no Cloud Shell: https://shell.cloud.google.com).
# Cria: APIs, repositório no Artifact Registry, conta de serviço de deploy e Workload Identity Federation
# (o GitHub Actions faz deploy SEM chave JSON salva). Também cria um alerta de orçamento opcional.
#
# Uso:  PROJETO=seu-projeto-id bash setup.sh
set -euo pipefail
: "${PROJETO:?defina PROJETO=<id do projeto no GCP>}"
REPO_GH="${REPO_GH:-NicolasDev-web/pergunte-a-reforma}"
REGIAO="${REGIAO:-southamerica-east1}"
SA="deploy-motor"
gcloud config set project "$PROJETO"
NUM=$(gcloud projects describe "$PROJETO" --format='value(projectNumber)')

echo "→ APIs"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com iamcredentials.googleapis.com sts.googleapis.com

echo "→ Artifact Registry"
gcloud artifacts repositories describe reforma --location "$REGIAO" >/dev/null 2>&1 || \
  gcloud artifacts repositories create reforma --repository-format docker --location "$REGIAO" --description "Pergunte à Reforma"

echo "→ Conta de serviço de deploy"
gcloud iam service-accounts describe "$SA@$PROJETO.iam.gserviceaccount.com" >/dev/null 2>&1 || \
  gcloud iam service-accounts create "$SA" --display-name "Deploy do motor (GitHub Actions)"
for papel in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding "$PROJETO" --member "serviceAccount:$SA@$PROJETO.iam.gserviceaccount.com" --role "$papel" --condition None >/dev/null
done

echo "→ Workload Identity Federation (só este repositório pode usar)"
gcloud iam workload-identity-pools describe github --location global >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools create github --location global --display-name "GitHub"
gcloud iam workload-identity-pools providers describe github --workload-identity-pool github --location global >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools providers create-oidc github --workload-identity-pool github --location global \
    --issuer-uri "https://token.actions.githubusercontent.com" \
    --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository" \
    --attribute-condition "assertion.repository == '$REPO_GH'"
gcloud iam service-accounts add-iam-policy-binding "$SA@$PROJETO.iam.gserviceaccount.com" \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/$NUM/locations/global/workloadIdentityPools/github/attribute.repository/$REPO_GH" >/dev/null

cat <<FIM

✓ Pronto. Agora cadastre no GitHub (Settings → Secrets and variables → Actions → aba Variables):
  GCP_PROJETO      = $PROJETO
  GCP_REGIAO       = $REGIAO
  GCP_WIF_PROVIDER = projects/$NUM/locations/global/workloadIdentityPools/github/providers/github
  GCP_SA           = $SA@$PROJETO.iam.gserviceaccount.com

Depois: Actions → "deploy-motor" → Run workflow.
Recomendado: Faturamento → Orçamentos e alertas → criar alerta de R\$ 50/mês.
FIM
