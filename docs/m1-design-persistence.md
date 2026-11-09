# M1 — Save and reopen designs (Supabase PostgreSQL + private Storage)

**Status:** Code updated on draft PR #53; **not deployed and no new Supabase StarKeepsake project created yet**.
This branch is based on the unfinished unified customizer (PR #48). Before merging to main, reconcile it with already-deployed Etsy OAuth PRs #50–52. Do not merge or deploy by accident.

## Architecture and design privacy

- Existing React/Vite StarKeepsake customer interface on Vercel; Save Design and Reopen workflows unchanged.
- Existing ASP.NET Core Azure Container Apps backend remains the ONLY customer-facing API to Supabase.
- A **separate** Supabase project named StarKeepsake M1 stores metadata in PostgreSQL table public.customer_designs and photo files in a private Storage bucket named starkeepsake-designs.
- The server uses a secret sb_secret_... API key in Azure Container Apps. Never put it into Vite environment variables, browser code, GitHub or chat. New keys use the apikey header, not JWT Bearer authentication; a legacy service_role JWT is also supported.
- Row-level security is enabled for customer_designs, with anon/authenticated grants revoked; only server role has database access. The private bucket has no public access policy.
- A public Design ID with the form SK-<16 uppercase hex characters> is for Etsy personalization. A separate 256-bit key in a private link URL fragment is required to reopen customer photos. Only its hash is in Postgres.
- An additional Save creates a new immutable snapshot/Design ID. This is NOT Etsy checkout, a verified paid order, a production job, or a tested laser manufacturing file.

## Step 1 — Create a dedicated Supabase project

1. Visit https://supabase.com/dashboard and select your intended organization.
2. Create a new project named StarKeepsake M1. Do not reuse Rig Repair Connect or its staging databases.
3. Choose a region near the existing Central US Azure API, subject to available regions on your plan.
4. Confirm any project pricing before creating. Supabase Free may limit the number of active projects.
5. Once status is healthy, open SQL Editor and run infra/supabase/001_customer_designs.sql.
6. Open Storage > Buckets and verify starkeepsake-designs is Private, with 10 MiB per-object limit and JPG/PNG/WebP MIME restrictions.
7. Check Database > Tables to confirm public.customer_designs exists and RLS is enabled. Run Security Advisor.

## Step 2 — Get the project URL and backend secret

In the NEW project's Settings > API Keys, create or copy a secret key starting with sb_secret_ for the ASP.NET backend. Do not use a publishable key for privileged server access.

Get the Project URL from the Connect dialog or Settings > API, such as https://YOUR_PROJECT_REF.supabase.co/.

The backend expects:
- Designs__ProjectUrl = project HTTPS URL
- Designs__SecretKey = secret reference to the server-only Supabase key
- Designs__StorageBucketName = starkeepsake-designs (default)

Only the Azure API needs the secret; never add it to Vercel or VITE_ variables.

## Step 3 — Store the Supabase key in existing Azure Container Apps

In Azure Cloud Shell Bash, save it without echoing it:

    read -r -s -p "Paste the NEW StarKeepsake Supabase sb_secret key (hidden): " SUPABASE_KEY
    echo
    az containerapp secret set -g rg-starkeepsake-dev -n starkeepsake-api-dev \
      --secrets "designs-supabase-key=$SUPABASE_KEY" --output none
    unset SUPABASE_KEY

After M1 is merged and explicitly approved for deployment, bind it to the API; this creates an Azure revision, so do not run earlier:

    az containerapp update -g rg-starkeepsake-dev -n starkeepsake-api-dev \
      --set-env-vars \
      Designs__ProjectUrl=https://YOUR_PROJECT_REF.supabase.co/ \
      Designs__SecretKey=secretref:designs-supabase-key \
      Designs__StorageBucketName=starkeepsake-designs

Etsy credentials remain in existing Azure secrets and are unaffected.

## Endpoints

- POST /api/designs: multipart design JSON, preferences JSON, original image, optional polished PNG foreground. Returns Design ID, secret access key and status SAVED_UNPAID.
- GET /api/designs/{designId}: requires X-Design-Access-Key header.
- GET /api/designs/{designId}/assets/original: same private header.
- GET /api/designs/{designId}/assets/foreground: same private header.

Wrong/missing private key and unknown Design IDs return 404. Missing configuration or database/storage errors return 503. Rate limits and 10 MiB per-image upload limits apply. Server secret stays off the browser.

## Verification

    dotnet build StarKeepsake.slnx --configuration Release
    dotnet run --project tests/DesignSave.Tests/DesignSave.Tests.csproj --configuration Release
    cd apps/web
    npm ci && npm run test:saved-design && npm run build

Before merging:
- Dedicated StarKeepsake Supabase project and private bucket exist and SQL is applied.
- Backend secret is configured in Azure (not React).
- Test customer saves completed design; receives a permanent SK-... ID and private link.
- New browser reopens photo, polished foreground, astronomy date/location, perspective, finish and inscription.
- Changing choices invalidates saved state; a second save produces a new ID.
- Design ID without private key cannot download images or read settings.
- No Etsy order, payment, or listing is modified.

Known follow-ups: free-project pauses/quotas, retention/deletion, orphaned image cleanup, backups, stronger abuse protection and customer account recovery. Production order processing needs durable webhook reconciliation.
