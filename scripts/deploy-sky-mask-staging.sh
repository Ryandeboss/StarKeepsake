#!/usr/bin/env bash
# Run from the StarKeepsake repository root on a logged-in Azure Cloud Shell.
# Deploy a GitHub-built PR #48 image to a SEPARATE, scale-to-zero Container App.
# Never prints provider credentials or mutates starkeepsake-api-dev.
set -euo pipefail
set +x
umask 077

RG="rg-starkeepsake-dev"
LIVE_APP="starkeepsake-api-dev"
STAGE_APP="starkeepsake-api-sky-staging"
ACR="cad443269256acr"
PULL_ID_NAME="id-starkeepsake-acr-pull-dev"
ENGINE_URL="https://starkeepsake-engine-dev.wittyflower-9225f265.centralus.azurecontainerapps.io/"
EXPECTED_BRANCH="feature/sky-only-ai-cutout"

if [[ ! -f apps/api/Dockerfile ]]; then
  echo "Run this script from the StarKeepsake repository root."
  exit 1
fi
CURRENT_BRANCH="$(git branch --show-current)"
if [[ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]]; then
  echo "Expected branch: $EXPECTED_BRANCH; current branch: $CURRENT_BRANCH"
  exit 1
fi
COMMIT="$(git rev-parse HEAD)"
echo "Staging API source: $COMMIT"
az account show --query '{subscription:name,id:id}' -o table
if [[ "${1:-}" != "--deploy" ]]; then
  echo "Dry run only. Re-run with --deploy to create/update the separate staging app."
  echo "Target: $STAGE_APP in $RG. Existing $LIVE_APP is untouched."
  echo "ACR storage and staging resources may incur charges."
  exit 0
fi

# Staging is independent of the existing API's credentials.
# The key is configured only on the new staging app after creation.

ENVIRONMENT="$(az containerapp show -g "$RG" -n "$LIVE_APP" \
  --query properties.managedEnvironmentId -o tsv)"
PULL_ID="$(az identity show -g "$RG" -n "$PULL_ID_NAME" --query id -o tsv)"
if [[ -z "$ENVIRONMENT" || -z "$PULL_ID" ]]; then
  echo "Could not resolve the existing Azure Container Apps environment/ACR pull identity."
  exit 1
fi
IMAGE="$ACR.azurecr.io/starkeepsake-api:sky-ai-${COMMIT:0:12}"
echo "Checking for a GitHub-built image in the registry..."
if ! az acr repository show --name "$ACR" --image "starkeepsake-api:sky-ai-${COMMIT:0:12}" --output none 2>/dev/null; then
  echo "No image for this commit. Check GitHub Actions: Build sky-mask staging image."
  echo "The registry's remote builds are disabled, so this script never uses az acr build."
  exit 1
fi
echo "The matching prebuilt image exists."

if az containerapp show -g "$RG" -n "$STAGE_APP" -o none >/dev/null 2>&1; then
  echo "Staging app already exists; updating its image."
  az containerapp update -g "$RG" -n "$STAGE_APP" \
    --image "$IMAGE" --set-env-vars \
    "Deployment__CommitSha=$COMMIT" \
    "DesignEngine__BaseUrl=$ENGINE_URL" \
    "SkyMask__Enabled=false" \
    --output none
else
  echo "Creating isolated staging app (scale to zero)."
  az containerapp create -g "$RG" -n "$STAGE_APP" \
    --environment "$ENVIRONMENT" \
    --image "$IMAGE" \
    --registry-server "$ACR.azurecr.io" \
    --registry-identity "$PULL_ID" \
    --user-assigned "$PULL_ID" \
    --ingress external --target-port 8080 \
    --min-replicas 0 --max-replicas 1 \
    --cpu 0.5 --memory 1.0Gi \
    --env-vars "Deployment__CommitSha=$COMMIT" \
    "DesignEngine__BaseUrl=$ENGINE_URL" \
    "SkyMask__Enabled=false" \
    --output none
fi

# Configure the Fal key independently on this isolated staging app.
# Never copy or print a key from another application as part of deployment.
echo "Staging created. Set the staging Fal key separately in Azure Secrets."

FQDN="$(az containerapp show -g "$RG" -n "$STAGE_APP" \
  --query properties.configuration.ingress.fqdn -o tsv)"
BASE_URL="https://$FQDN"
echo "Staging API: $BASE_URL"
echo "Checking API version and availability (no paid Fal request)..."
for attempt in {1..18}; do
  HEALTH="$(curl --fail --silent --show-error --max-time 12 "$BASE_URL/health" || true)"
  if [[ "$(printf '%s' "$HEALTH" | jq -r '.commitSha // empty' 2>/dev/null)" == "$COMMIT" ]]; then
    break
  fi
  if [[ "$attempt" == "18" ]]; then
    echo "Staging API did not report the expected commit; check Container App logs."
    exit 1
  fi
  sleep 10
done
curl --fail --silent --show-error "$BASE_URL/api/sky/mask/status" | jq .
echo "Please share only the staging API URL, not your key or secret."
