# StarKeepsake → Etsy: owner-only connection (Milestone 1)

**State:** code on `feature/etsy-seller-oauth` (draft PR #49); **not deployed, not Etsy-authorized and no live Etsy listing changed**.

This MVP uses **existing Azure Container Apps secrets**, plus one private Azure Blob container for the OAuth tokens that must survive restarts. **No Azure Key Vault** or managed-identity permissions are required for this version. Physical frames will eventually be sold on Etsy; StarKeepsake will save exact custom designs and associate only verified paid Etsy orders with production instructions.

## What was implemented

- Owner-only authorization page: `GET /api/admin/etsy/connect`, requiring a separate randomly generated admin setup key on submission (not the Etsy Shared Secret).
- Etsy OAuth 2.0 authorization code + PKCE S256 with 10-minute signed state, secure browser cookie and rate limiting.
- Read-only scopes `shops_r listings_r transactions_r` (no listing edits, publishing or fulfillment).
- Verifies that the authorized seller owns **ApexCraftedUS** before saving any tokens.
- Access/refresh tokens persist in a **private Azure Blob** (encrypted at rest); access token refreshed when needed. The storage connection string lives in a Container App secret.
- Authenticated status endpoint: `GET /api/admin/etsy/status` (does not return tokens).

## Step 1 — Already done: add the two Etsy secrets

In Azure Portal → Container Apps → `starkeepsake-api-dev` (resource group `rg-starkeepsake-dev`) → Secrets:

| Container App secret name | Value |
| --- | --- |
| `etsy-keystring` | Etsy developer app Keystring |
| `etsy-shared-secret` | Etsy developer app Shared Secret |

**Do not paste credential values into GitHub, ChatGPT or the customer-facing Vercel app.** Merely adding these two secrets does not make them readable to the backend until environment variables reference them.

## Step 2 — Run one safe Cloud Shell bootstrap

In [Azure Cloud Shell](https://shell.azure.com/) select **Bash**, and make sure the subscription is the one containing StarKeepsake. Then run:

```bash
git clone --branch feature/etsy-seller-oauth --single-branch https://github.com/Ryandeboss/StarKeepsake.git starkeepsake-etsy
cd starkeepsake-etsy
bash scripts/etsy/prepare-container-app.sh --inspect
bash scripts/etsy/prepare-container-app.sh --prepare
```

- `--inspect` is read-only. It verifies the two *names* are present, shows your actual API host and exact Etsy callback URL, and displays no secret values.
- `--prepare` asks for the word **PREPARE** before doing anything. It creates (or reuses) a **Standard LRS** Storage account and a **private** `starkeepsake-private` Blob container; disables public blob access on a new account; then adds three Container App secrets:
  - `etsy-storage-connection`: private Blob Storage connection string
  - `etsy-admin-setup-key`: a fresh owner-only password
  - `etsy-state-signing-key`: a different fresh random key for OAuth state/PKCE
- It **does not deploy code, publish a listing, change API environment variables, or authorize Etsy**.
- Azure Storage is a **small usage-based cost** (not necessarily free).
- At the end, Cloud Shell shows your exact redirect URI and **one-time admin setup password**. Save the admin setup password somewhere private. Never share it in chat. Running `--prepare` again rotates both generated secrets and invalidates any setup key you previously saved.

If you already have a suitable Azure Storage account and prefer to reuse it, a manual setup is possible, but the script is optimized for a simple dedicated private container.

## Step 3 — Add the Etsy Redirect URI (manual)

At [Etsy Developer Portal → Your Apps](https://www.etsy.com/developers/your-apps), select your approved application and register **exactly** the HTTPS URL printed in the script output, ending:

```text
/api/admin/etsy/callback
```

Do **not** use the Vercel host or add a trailing slash.

## Step 4 — Bind secrets to your API (after review and approved deployment)

**Do not do this until PR #49 has been reviewed and you want to deploy it.** Azure environment-variable updates create a new revision. They must point to the five existing Container Apps secrets:

| API environment variable | Value |
| --- | --- |
| `Etsy__Keystring` | `secretref:etsy-keystring` |
| `Etsy__SharedSecret` | `secretref:etsy-shared-secret` |
| `Etsy__StorageConnectionString` | `secretref:etsy-storage-connection` |
| `Etsy__AdminSetupKey` | `secretref:etsy-admin-setup-key` |
| `Etsy__StateSigningKey` | `secretref:etsy-state-signing-key` |
| `Etsy__ExpectedShopName` | `ApexCraftedUS` |
| `Etsy__RedirectUri` | the exact HTTPS callback URL from Step 3 |
| `Etsy__StorageContainerName` | `starkeepsake-private` (default) |
| `Etsy__TokenBlobName` | `integrations/etsy/connection.json` (default) |

You can configure these in **Azure Container Apps → Revisions and replicas → Create new revision → Edit container → Environment variables**, or with `az containerapp update --set-env-vars`. Use secret references, **not the plain secret values**.

## Step 5 — Authorize Etsy (only after approved deployment)

Go to `https://<YOUR-API-HOST>/api/admin/etsy/connect` in your browser. Enter the **StarKeepsake admin setup password** generated in Step 2, not the Etsy Shared Secret. Etsy asks you to authorize read-only shop/listing/order access. Confirm that the account owns `ApexCraftedUS`. The callback verifies shop identity before storing tokens in Blob Storage.

To check the status with the privately saved admin key:

```bash
curl -H "X-Starkeepsake-Admin-Key: <YOUR-ADMIN-SETUP-KEY>" \
  "https://<YOUR-API-HOST>/api/admin/etsy/status"
```

Expected response includes `"connected":true` and `"shopName":"ApexCraftedUS"`.

### Important limitations and security tradeoffs

- The OAuth token file is **never** placed on ephemeral container storage and is **not** sent to browsers or GitHub. The private blob survives replica restarts/deployments.
- A Storage connection string grants significant access to its account. This is a simpler owner-operated MVP compromise, **not** maximum least-privilege security. Rotate that secret if leaked; keep the container private.
- The initial token-store implementation uses last-writer-wins storage and a per-process refresh lock. Before operating with multiple replicas or high-volume orders, add ETag/lease coordination to avoid refresh races.
- The API is disabled (503) until all required configuration exists; no Etsy charges or listing publication occur from this OAuth integration.
- Etsy access tokens last about one hour; refresh tokens last longer (~90 days). Token renewals do not require another owner sign-in while authorization remains valid. Reauthorization may still be required if the refresh token expires or is revoked.
- The Etsy **webhook signing secret is a separate credential**, which isn't needed in Milestone 1.

## What is *not* implemented

Saving the customer's exact design and photos, Etsy checkout button, design ID matching, verifying paid orders, generating a bill of materials, and Google Sheets tracking are **future milestones**. Keep the physical listing as a draft until the design→paid order→production workflow and real manufacturing specs are tested.

## Verification

```bash
dotnet build StarKeepsake.slnx --configuration Release
dotnet run --project tests/EtsyOAuth.Tests/EtsyOAuth.Tests.csproj --configuration Release
bash -n scripts/etsy/prepare-container-app.sh
```

Official references:
- https://developers.etsy.com/documentation/essentials/authentication/
- https://learn.microsoft.com/azure/container-apps/manage-secrets
- https://learn.microsoft.com/azure/container-apps/environment-variables
- https://learn.microsoft.com/azure/container-apps/storage-mounts
