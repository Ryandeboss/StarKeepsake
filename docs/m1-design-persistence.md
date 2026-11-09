# M1 — Save and reopen designs (Azure SQL + private Blob)

Status: implemented on feature branch; **not deployed or connected to live Azure SQL**.
This feature branches off the unfinished unified customizer (PR #48). Before merging it to main, reconcile with live Etsy OAuth PRs #50–52; do not overwrite those changes.

## What is included

- Save completed DesignSpec v1.5 plus workshop preferences as an immutable snapshot.
- Server-generated unique SKU-safe Design ID (SK- followed by 16 random hex characters).
- Separate 256-bit secret access key: only its SHA-256 hash is stored in Azure SQL.
- Original photo and optional prepared foreground in a private Blob container.
- Copy a private reopen link. Secret stays in the URL fragment; it is never sent as an HTTP URL/query parameter.
- Authenticated GET endpoints for saved settings and both images.
- Saved ID used in new order packet when customer has saved the current revision.
- This is an unpaid design preview, NOT an Etsy order, checkout, production job or validated laser file.

## A. Create an Azure SQL free-tier development database

Use Azure Portal > Azure SQL > Start free (https://aka.ms/azuresqlhub).
Choose the existing subscription, resource group rg-starkeepsake-dev, database name
starkeepsake-designs-dev, and a new or existing Azure SQL logical server.

**Confirm the Apply free offer button** is selected. Choose "Auto-pause the database until next month" to avoid surprise SQL overages while developing. Keep the SQL admin password private and secure.

Free tier provides recurring 100,000 vCore-seconds/month, 32 GB data and 32 GB backup, but no SLA; auto-pause upon exceeding allowance makes the database inaccessible until the next month. For accepting paid Etsy orders, use a reliable paid tier or a durable external queue before relying on the DB to process order events.

Run the migration from infra/azure-sql/001_customer_designs.sql against this specific database, using Azure Portal Query editor or SSMS.

The Azure Container App needs network access to the SQL server. Configure a narrowly scoped firewall or private endpoint if possible. The shortcut "Allow Azure services" permits connections from other Azure customers too, so prefer more restricted access for production.

## B. Add a private artwork container to the existing storage account

Azure Cloud Shell Bash:

    ACCOUNT="sketsy2d37a2b521444df7"
    GROUP="rg-starkeepsake-dev"
    CONNECTION="$(az storage account show-connection-string -g "$GROUP" -n "$ACCOUNT" --query connectionString -o tsv)"
    az storage container create --name "starkeepsake-artwork" --connection-string "$CONNECTION" --public-access off --output none
    unset CONNECTION
    echo "Private artwork container ready."

No public Blob access; customer photos must not be in public website assets.

## C. Store SQL connection string as a Container Apps secret

Locally construct a connection string (real credentials MUST NOT be pasted into chat or git):

    Server=tcp:<SERVER>.database.windows.net,1433;Initial Catalog=starkeepsake-designs-dev;User ID=<SQL_LOGIN>;Password=<PASSWORD>;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;

Store it privately in Azure Cloud Shell Bash:

    read -r -s -p "Paste SQL connection string (hidden): " SQL_CONNECTION
    echo
    az containerapp secret set -g rg-starkeepsake-dev -n starkeepsake-api-dev --secrets "designs-sql-connection=$SQL_CONNECTION" --output none
    unset SQL_CONNECTION

After approving M1 deployment, bind existing secrets to environment variables.
**The update below creates a new API revision; do not run until release is ready.**

    az containerapp update -g rg-starkeepsake-dev -n starkeepsake-api-dev --set-env-vars \
      Designs__SqlConnectionString=secretref:designs-sql-connection \
      Designs__StorageConnectionString=secretref:etsy-storage-connection \
      Designs__StorageContainerName=starkeepsake-artwork

Reusing the existing Storage connection string is a simple MVP choice but grants broad Storage account access; later use a separate identity with container-scoped rights. Artwork is in a separate private container from Etsy OAuth tokens.

## Backend routes

- POST /api/designs — bounded multipart save (JSON design, JSON preferences, photo, optional foreground). Returns Design ID, private key and SAVED_UNPAID.
- GET /api/designs/{designId} — requires X-Design-Access-Key header.
- GET /api/designs/{designId}/assets/original — requires same header.
- GET /api/designs/{designId}/assets/foreground — requires same header.

An unknown or incorrectly keyed design returns 404. Missing SQL/Blob config returns 503. Unauthenticated saves are throttled; public Etsy Design IDs never authorize retrieving photos.

## Developer checks

    dotnet build StarKeepsake.slnx --configuration Release
    dotnet run --project tests/DesignSave.Tests/DesignSave.Tests.csproj --configuration Release
    cd apps/web
    npm ci && npm run test:saved-design && npm run build

## Release acceptance checklist

- Save a completed sky/photo design; receive a new SK-... ID and private link.
- Open private link in a new browser; original photo, polished foreground, sky moment, perspective, wood finish, inscription all restore.
- Alter a preference and save again; get a new ID without mutating the first snapshot.
- Ensure GET without key (or with wrong key) returns 404, including photo bytes.
- Verify no Etsy paid order, listing modification or production job was created.

Future work: user accounts or secure key recovery; explicit image retention/deletion policy; orphan Blob cleanup; WAF/CAPTCHA; stricter physical manufacturing validation before accepting orders.
