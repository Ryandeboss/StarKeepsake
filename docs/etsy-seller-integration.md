# StarKeepsake → Etsy (seller-only connection, milestone 1)

Status: **code on feature branch; not authorized, merged or deployed**.
The Etsy shop in the current design is **ApexCraftedUS**. Physical frames will be sold on Etsy, while StarKeepsake handles the customizer and later the design-to-paid-order-to-production pipeline.

## Implemented in this milestone

- A private **owner-only** browser form at `GET /api/admin/etsy/connect`, protected at submission by a separate strong StarKeepsake admin setup key.
- Etsy OAuth2 authorization-code grant with **PKCE S256**, signed 10-minute state, browser-bound HttpOnly/Secure/SameSite=Lax cookie, one-time callback handling, and rate limiting. Callback path: `/api/admin/etsy/callback`.
- Smallest read scopes needed for the next milestone: `shops_r listings_r transactions_r`. **No listing write, publication, payment, or order fulfillment permissions.**
- Exact owner verification through Etsy's `GET /v3/application/users/{user_id}/shops` endpoint. Connection fails if that account does **not** own the configured shop name.
- Token exchange and refresh, including refresh-token rotation, with durable storage as a secret in **Azure Key Vault** accessed by the API's managed identity.
- Authenticated `GET /api/admin/etsy/status` (no token data returned), for confirming the connection and refreshing expired access tokens.
- All Etsy secrets/tokens remain server-side; disabled if required server configuration is missing.

## Setup (after PR review; do not deploy yet)

1. In Etsy Developer Portal → Your Apps, register the **exact HTTPS Redirect URI**
   `https://<YOUR-AZURE-API-HOST>/api/admin/etsy/callback`. Use the actual API host; do not register the frontend Vercel host. Do not append a slash or query.
2. Create a **dedicated Azure Key Vault** for StarKeepsake API integrations (or a securely scoped existing one). Enable an API-managed identity on Azure Container Apps. Grant it **Get and Set secret** rights on the dedicated vault (RBAC via Key Vault Secrets Officer on this *dedicated* vault, or a narrowly scoped secret access policy). If a user-assigned identity is used, provide its **client ID**, not its resource ID.
3. Generate two **separate** high-entropy setup secrets, distinct from Etsy's Shared Secret. PowerShell example for each:
   `[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))`
4. Configure the **API Container App** (secure environment variables/secret references, not GitHub, not Vercel):
   - `Etsy__Keystring` = Etsy Keystring (private to API)
   - `Etsy__SharedSecret` = Etsy Shared Secret (**keep private**)
   - `Etsy__RedirectUri` = exact HTTPS URI from step 1
   - `Etsy__ExpectedShopName` = `ApexCraftedUS`
   - `Etsy__AdminSetupKey` = separately generated ≥32-character random key
   - `Etsy__StateSigningKey` = different ≥32-character random key
   - `Etsy__KeyVaultUri` = `https://<VAULT>.vault.azure.net/`
   - `Etsy__ManagedIdentityClientId` = optional, only for user-assigned managed identity
   - `Etsy__TokenSecretName` = optional, defaults to `starkeepsake-etsy-connection`
5. After deploying *with approval*, visit `https://<YOUR-AZURE-API-HOST>/api/admin/etsy/connect`. Enter **the StarKeepsake admin setup key**, NOT the Etsy Shared Secret. Etsy will ask you to approve read-only shop, listing and order access. Use the Etsy account that owns **ApexCraftedUS**. The callback verifies shop ownership and saves tokens to Key Vault.
6. Check status locally with an authenticated request (the admin key must never appear in the URL or git history):
   `curl -H "X-Starkeepsake-Admin-Key: <ADMIN_KEY>" https://<YOUR-AZURE-API-HOST>/api/admin/etsy/status`
   Expected response: `{"connected":true,"shopName":"ApexCraftedUS","shopId":...}`.
   Rotate the admin setup key and signing key if either is leaked; changing the signing key invalidates in-flight callbacks only.

**Failure behavior:** Missing credentials → HTTP 503. Bad admin setup key → HTTP 401. Tampered, mismatched or expired callback state → HTTP 400. Wrong Etsy shop → no tokens saved. API or Key Vault failure → generic HTTP 502, without reflecting codes/tokens/secrets.

### Operational/security notes

- The OAuth state cookie is root-scoped because the `__Host-` prefix requires `Path=/`; it is HttpOnly, Secure, SameSite=Lax and expires in 10 minutes.
- Requesting additional scopes later requires Etsy reauthorization. Avoid adding write scopes until there is a specific approved need.
- The API's secret store is **Azure Key Vault**, not static Container Apps environment variables: Etsy refresh tokens rotate and must persist across restarts/replicas.
- Set Azure networking/Key Vault policy so only the API's managed identity can access this dedicated secret store. Do not log Authorization headers, HTTP token bodies, OAuth query codes, or Key Vault secret values.
- Read-only Etsy API calls are owner-authenticated. This code **does not** publish listings or verify payments yet.
- Seller authorization must be initiated by the owner. Do not expose the admin setup key to customer-facing React code.

## Next development milestones (NOT implemented)

1. Persist customer design specs and uploaded photos securely; provide a stable, unique Design ID with a 1:1 link to artwork and intended frame dimensions/finish.
2. Etsy listing personalization collects Design ID; enforce an exact match for any selected variation/price; customer buys the **physical frame on Etsy**.
3. Consume signed `order.paid` Etsy webhooks; verify their signature with a separate webhook signing secret; fetch the order receipt and confirm status, quantities, listing and personalization before associating a design with an Etsy order. Deduplicate retries and handle cancellation/refund state.
4. Produce a materials bill and assembly checklist only for **verified paid** orders using *actual approved frame SKUs, parts and suppliers*; optionally export to Google Sheets.
5. Photograph a real physical sample and verify Etsy listing accuracy, actual fulfillment times and manufacture method before publishing.

## Developer checks

`dotnet build StarKeepsake.slnx --configuration Release`
`dotnet run --project tests/EtsyOAuth.Tests/EtsyOAuth.Tests.csproj --configuration Release`

Official docs:
- https://developers.etsy.com/documentation/essentials/authentication/
- https://developers.etsy.com/documentation/reference/
