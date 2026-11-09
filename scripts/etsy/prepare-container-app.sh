#!/usr/bin/env bash
# StarKeepsake Etsy MVP storage preparation; run in Azure Cloud Shell (Bash).
# Default --inspect is read-only. --prepare creates private Blob storage and
# Container Apps secrets only; it does NOT deploy/restart API or alter Etsy.
set -euo pipefail
umask 077

GROUP="rg-starkeepsake-dev"
APP="starkeepsake-api-dev"
CONTAINER="starkeepsake-private"
MODE="--inspect"
if [[ "$#" -gt 0 ]]; then MODE="$1"; fi

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
command -v az >/dev/null || fail "Please use Azure Cloud Shell (Bash) with Azure CLI."
command -v openssl >/dev/null || fail "openssl is required."
az account show --query id -o tsv >/dev/null || fail "Select your StarKeepsake subscription in Azure Cloud Shell."

SUBSCRIPTION="$(az account show --query id -o tsv)"
LOCATION="$(az group show -n "$GROUP" --query location -o tsv)"
FQDN="$(az containerapp show -n "$APP" -g "$GROUP" --query properties.configuration.ingress.fqdn -o tsv)"
[[ -n "$FQDN" && "$FQDN" != "None" ]] || fail "Could not find Container App public hostname."
CALLBACK="https://$FQDN/api/admin/etsy/callback"
# Storage account names must be globally unique, lowercase and <=24 characters.
ACCOUNT="sketsy$(printf '%s' "$SUBSCRIPTION/$GROUP" | sha256sum | cut -c1-16)"

printf 'StarKeepsake API: %s\n' "$APP"
printf 'Azure resource group: %s\n' "$GROUP"
printf 'Etsy callback URL: %s\n' "$CALLBACK"
printf 'Suggested private storage account: %s\n' "$ACCOUNT"
printf '\n'

# This returns names only; it never displays any secret values.
EXISTING_SECRETS="$(az containerapp secret list -g "$GROUP" -n "$APP" --query '[].name' -o tsv)"
printf '%s\n' "$EXISTING_SECRETS" | grep -Fxq 'etsy-keystring' ||
  fail "Add 'etsy-keystring' to Container Apps Secrets first."
printf '%s\n' "$EXISTING_SECRETS" | grep -Fxq 'etsy-shared-secret' ||
  fail "Add 'etsy-shared-secret' to Container Apps Secrets first."
printf 'Found both Etsy API credential secret names; no values have been read.\n'

if [[ "$MODE" == "--inspect" ]]; then
  printf 'Inspection complete; no changes made.\n'
  printf 'To prepare private token storage: bash scripts/etsy/prepare-container-app.sh --prepare\n'
  exit 0
fi
[[ "$MODE" == "--prepare" ]] || fail "Use --inspect or --prepare."

printf '\nThis creates or reuses an Azure Storage account and a private container.\n'
printf 'It adds three Container Apps secrets but does NOT deploy code or change environment variables.\n'
printf 'Storage has usage-based charges. Existing Etsy secrets are kept unchanged.\n'
printf 'Type PREPARE to continue: '
read -r confirm
[[ "$confirm" == "PREPARE" ]] || fail "Canceled."

if ! az storage account show -n "$ACCOUNT" -g "$GROUP" >/dev/null 2>&1; then
  az storage account create -g "$GROUP" -n "$ACCOUNT" -l "$LOCATION" \
    --sku Standard_LRS --kind StorageV2 --allow-blob-public-access false \
    --min-tls-version TLS1_2 --output none
  printf 'Created private Azure Storage account.\n'
else
  printf 'Reusing existing storage account.\n'
fi

# Connection string is kept in process memory and in Container Apps secret storage,
# not written to GitHub, copied to chat, or printed to the terminal.
CONNECTION="$(az storage account show-connection-string \
  -g "$GROUP" -n "$ACCOUNT" --query connectionString -o tsv)"
[[ -n "$CONNECTION" ]] || fail "Could not obtain storage connection. Check subscription permissions."
az storage container create --name "$CONTAINER" --connection-string "$CONNECTION" \
  --public-access off --output none >/dev/null

ADMIN_KEY="$(openssl rand -base64 48)"
SIGNING_KEY="$(openssl rand -base64 48)"

az containerapp secret set -g "$GROUP" -n "$APP" --secrets \
  "etsy-storage-connection=$CONNECTION" \
  "etsy-admin-setup-key=$ADMIN_KEY" \
  "etsy-state-signing-key=$SIGNING_KEY" --output none
unset CONNECTION SIGNING_KEY

printf '\nAzure preparation complete. No application revision was deployed.\n'
printf 'Copy this Etsy redirect URI into the Etsy Developer Portal (exact match):\n%s\n' "$CALLBACK"
printf '\nYour owner-only setup password (save privately; generated new each time --prepare runs):\n%s\n' "$ADMIN_KEY"
printf '\nDo NOT paste this password into ChatGPT/GitHub. Then follow docs/etsy-seller-integration.md.\n'
unset ADMIN_KEY
