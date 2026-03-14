#!/usr/bin/env bash
#
# Deploy DesignMuse AI to Google Cloud Run.
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - Docker installed (or use --cloud-build flag)
#   - A .env file with at least GOOGLE_CLOUD_PROJECT set
#
# Usage:
#   ./deploy.sh                      # deploy both services
#   ./deploy.sh --backend-only       # deploy backend only
#   ./deploy.sh --frontend-only      # deploy frontend only (backend must exist)

set -euo pipefail

# ── Load config from .env ────────────────────────────────────────────────────
if [ -f .env ]; then
  set -a; source .env; set +a
fi

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:?Set GOOGLE_CLOUD_PROJECT in .env}"
REGION="${GOOGLE_CLOUD_LOCATION:-us-central1}"
API_KEY="${BACKEND_API_KEY:-}"
REPO_NAME="designmuse"
BACKEND_SERVICE="designmuse-backend"
FRONTEND_SERVICE="designmuse-frontend"

AR_HOST="${REGION}-docker.pkg.dev"
AR_PREFIX="${AR_HOST}/${PROJECT_ID}/${REPO_NAME}"

# ── Parse flags ──────────────────────────────────────────────────────────────
DEPLOY_BACKEND=true
DEPLOY_FRONTEND=true

for arg in "$@"; do
  case $arg in
    --backend-only)  DEPLOY_FRONTEND=false ;;
    --frontend-only) DEPLOY_BACKEND=false  ;;
    *) echo "Unknown flag: $arg"; exit 1   ;;
  esac
done

# ── Ensure gcloud project is set ─────────────────────────────────────────────
gcloud config set project "$PROJECT_ID" --quiet

# ── Enable required APIs ─────────────────────────────────────────────────────
echo "==> Enabling required APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  aiplatform.googleapis.com \
  cloudbuild.googleapis.com \
  --quiet

# ── Create Artifact Registry repo (if missing) ──────────────────────────────
if ! gcloud artifacts repositories describe "$REPO_NAME" \
      --location="$REGION" --format="value(name)" 2>/dev/null; then
  echo "==> Creating Artifact Registry repository..."
  gcloud artifacts repositories create "$REPO_NAME" \
    --repository-format=docker \
    --location="$REGION" \
    --description="DesignMuse AI container images"
fi

# ── Configure Docker auth for Artifact Registry ─────────────────────────────
gcloud auth configure-docker "$AR_HOST" --quiet

# ── Deploy backend ───────────────────────────────────────────────────────────
if [ "$DEPLOY_BACKEND" = true ]; then
  echo ""
  echo "==> Building backend image..."
  docker build -t "${AR_PREFIX}/backend:latest" -f Dockerfile .

  echo "==> Pushing backend image..."
  docker push "${AR_PREFIX}/backend:latest"

  echo "==> Deploying backend to Cloud Run..."
  gcloud run deploy "$BACKEND_SERVICE" \
    --image "${AR_PREFIX}/backend:latest" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --port 8080 \
    --memory 2Gi \
    --cpu 2 \
    --timeout 600 \
    --set-env-vars "USE_VERTEX_AI=true,GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GOOGLE_CLOUD_LOCATION=${REGION},GCS_BUCKET_NAME=${GCS_BUCKET_NAME:-designmuse-assets},BACKEND_API_KEY=${API_KEY}" \
    --quiet
fi

# ── Get backend URL ──────────────────────────────────────────────────────────
BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" \
  --region "$REGION" --format="value(status.url)")

echo "==> Backend URL: ${BACKEND_URL}"

# ── Deploy frontend ─────────────────────────────────────────────────────────
if [ "$DEPLOY_FRONTEND" = true ]; then
  echo ""
  echo "==> Building frontend image (API → ${BACKEND_URL})..."
  docker build \
    --build-arg "NEXT_PUBLIC_API_URL=${BACKEND_URL}" \
    --build-arg "NEXT_PUBLIC_BACKEND_API_KEY=${API_KEY}" \
    -t "${AR_PREFIX}/frontend:latest" \
    -f frontend/Dockerfile \
    frontend/

  echo "==> Pushing frontend image..."
  docker push "${AR_PREFIX}/frontend:latest"

  echo "==> Deploying frontend to Cloud Run..."
  gcloud run deploy "$FRONTEND_SERVICE" \
    --image "${AR_PREFIX}/frontend:latest" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --port 3000 \
    --memory 512Mi \
    --cpu 1 \
    --quiet

  FRONTEND_URL=$(gcloud run services describe "$FRONTEND_SERVICE" \
    --region "$REGION" --format="value(status.url)")

  echo ""
  echo "==> Updating backend CORS to allow ${FRONTEND_URL}..."
  gcloud run services update "$BACKEND_SERVICE" \
    --region "$REGION" \
    --update-env-vars "CORS_ORIGINS=${FRONTEND_URL},FRONTEND_URL=${FRONTEND_URL}" \
    --quiet
fi

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "============================================"
echo "  DesignMuse AI deployed successfully!"
echo "============================================"
echo ""
if [ -n "${FRONTEND_URL:-}" ]; then
  echo "  Frontend : ${FRONTEND_URL}"
fi
echo "  Backend  : ${BACKEND_URL}"
echo ""
echo "  To tear down:"
echo "    gcloud run services delete ${BACKEND_SERVICE}  --region ${REGION} --quiet"
echo "    gcloud run services delete ${FRONTEND_SERVICE} --region ${REGION} --quiet"
echo ""
