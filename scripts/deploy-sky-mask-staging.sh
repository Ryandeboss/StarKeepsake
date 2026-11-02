#!/usr/bin/env bash
# Run from the StarKeepsake repository root on a logged-in Azure Cloud Shell.
# Deploy PR #48's API to a SEPARATE, scale-to-zero Container App.
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
  echo "Azure ACR builds and staging resources may incur charges."
  exit 0
fi

# Fail before building if the owner has not yet added the Fal secret.
if ! az containerapp secret show -g "$RG" -n "$LIVE_APP" \
    --secret-name fal-api-key --query name -o tsv >/dev/null; then
  echo "The secret named fal-api-key was not found on $LIVE_APP."
  exit 1
fi

ENVIRONMENT="$(az containerapp show -g "$RG" -n "$LIVE_APP" \
  --query properties.managedEnvironmentId -o tsv)"
PULL_ID="$(az identity show -g "$RG" -n "$PULL_ID_NAME" --query id -o tsv)"
if [[ -z "$ENVIRONMENT" || -z "$PULL_ID" ]]; then
  echo "Could not resolve the existing Azure Container Apps environment/ACR pull identity."
  exit 1
fi
IMAGE="$ACR.azurecr.io/starkeepsake-api:sky-ai-${COMMIT:0:12}"
echo "Building staging image (the existing production app is not changed)."
az acr build -r "$ACR" -t "starkeepsake-api:sky-ai-${COMMIT:0:12}" \
  -f Dockerfile apps/api

if az containerapp show -g "$RG" -n "$STAGE_APP" -o none >/dev/null 2>&1; then
  echo "Staging app already exists; updating its image."
  az containerapp update -g "$RG" -n "$STAGE_APP" \
    --image "$IMAGE" --set-env-vars \
    "Deployment__CommitSha=$COMMIT" \
    "DesignEngine__BaseUrl=$ENGINE_URL" \
    "SkyMask__Enabled=true" \
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
    "SkyMask__Enabled=true" \
    --output none
fi

# Copy only the already-set Fal key, without printing its value. No file writes.
FAL_SECRET="$(az containerapp secret show -g "$RG" -n "$LIVE_APP" \
  --secret-name fal-api-key --query value -o tsv)"
if [[ -z "$FAL_SECRET" || "$FAL_SECRET" == "None" ]]; then
  echo "Could not read fal-api-key from the source app. Add the key to staging manually."
  exit 1
fi
az containerapp secret set -g "$RG" -n "$STAGE_APP" \
  --secrets "fal-api-key=$FAL_SECRET" --output none
unset FAL_SECRET
az containerapp update -g "$RG" -n "$STAGE_APP" \
  --set-env-vars "Fal__ApiKey=secretref:fal-api-key" --output none

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
