# Sky-only AI cutout prototype (not released)

## User flow

1. Sky Lab → Chicago → upload a skyline photo (JPG, PNG, WebP).
2. A full-fit side-by-side dialog shows original photo at its complete aspect ratio. No zoom canvas or nested scrollbars.
3. Click **Remove sky with AI** to request text-prompted "sky" segmentation. The model produces a mask only; the site applies it locally to the original photo. A narrow edge-only decontamination option can adjust partially transparent fringe RGB while fully opaque foreground RGB stays unchanged. No building, tree or waterfront pixels are generated.
4. Inspect the result over a dark night gradient or a checkerboard. Use **Edge cleanup** (0–8 original-image pixels; default 2 px) to remove thin sky-colored borders. The local cleanup references nearby confident-sky pixels and protects contrasting branches/building edges. Toggle **Remove sky-colored edge glow** for semi-transparent fringe RGB decontamination, or set cleanup to 0 and disable the toggle to see the untouched AI matte. These adjustments reuse the existing downloaded AI mask and never make another Fal request. If mask polarity is reversed, use **Invert AI mask**. Click **Apply to night sky** only after checking.
5. An already transparent PNG can be applied directly; for images with a plain white sky, a free local white-sky remover is offered explicitly as fallback.

## Server configuration and costs

- Backend: ASP.NET Core endpoint `POST /api/sky/mask` on the existing Azure API.
- Third party: fal.ai `fal-ai/sam-3/image`, text prompt `sky`, `apply_mask=false`, `sync_mode=true`. No image generation.
- Configure **Fal__ApiKey** on the API server through Azure's protected environment configuration, **never** a Vite `VITE_` variable.
- **Disabled by default even if the key exists**. Both `Fal__ApiKey` and `SkyMask__Enabled=true` are required. Without the explicit opt-in, `GET /api/sky/mask/status` returns `{"available":false}`. This prevents paid requests accidentally activating if the feature is merged into an existing live backend.
- Metered third-party processing incurs charges. Before configuring a key for public visitors, enforce an account/usage budget and monitor service spend. A 3-per-10-minute per-IP limiter is provided but is not a reliable billing ceiling for an anonymous public site; auth, abuse controls, and monetary caps are still necessary.
- When clicked, an upload copy of the user's photo is sent to Fal. The original browser photo is not uploaded when using the local fallback or an existing transparent PNG. Check Fal's privacy and retention terms before public launch.
- On provider error or unusable mask, the original remains intact and the user can cancel. The server returns an error without disclosing credentials.

## Correctness and limitations

- This is a **prototype** pending credentialed, browser-level tests on the owner's actual Chicago image. The Fal model's ability to segment thin leafless tree twigs and disconnected sky patches has **not been verified**.
- The image-transmission copy is resized to a maximum side of 2048 pixels, while the mask is composited onto the original-resolution RGB image. Fine branches may need a higher-res model path later.
- A semantic model can misclassify water or buildings. Always review before applying, especially for complex skyline panoramas.
- No true compass bearing, 360° view, historic photographic accuracy, or real sky photometry is implied.
- Pre-existing production and manufacturing design workflows are unchanged.

## Isolated Azure staging procedure (ACR Tasks workaround)

Azure rejected `az acr build` with `TasksOperationsNotAllowed`. Our replacement builds the Docker image on a GitHub-hosted runner and **pushes** it to the same ACR. This does not require ACR Tasks or Docker inside Azure Cloud Shell.

1. A GitHub Actions workflow `.github/workflows/build-sky-mask-image.yml` runs only on pushes to `feature/sky-only-ai-cutout`. It signs into Azure with the repository's existing OIDC secrets and runs Docker build/push. It **does not update any Azure Container App**.
2. The existing Azure deployment identity `id-starkeepsake-github-dev` needs a federated credential authorizing that **exact** feature branch. The repository uses an immutable ID-based OIDC subject, consistent with its existing `github-main` credential. Create it in Cloud Shell once:
   ```bash
   az identity federated-credential create \
     --resource-group rg-starkeepsake-dev \
     --identity-name id-starkeepsake-github-dev \
     --name github-sky-mask-feature \
     --issuer https://token.actions.githubusercontent.com \
     --subject "repo:Ryandeboss@96958000/StarKeepsake@1409130491:ref:refs/heads/feature/sky-only-ai-cutout" \
     --audiences api://AzureADTokenExchange \
     --output none
   ```
   Creating a branch credential grants workflows on that branch the Azure identity's current privileges. Remove the credential when the staging experiment ends.
3. After the new GitHub Actions workflow successfully uploads a matching SHA-tagged image, in Azure Cloud Shell run:
   ```bash
   cd ~/StarKeepsake
   git pull --ff-only
   bash scripts/deploy-sky-mask-staging.sh --deploy
   ```
   This script **never** invokes `az acr build`. It confirms an image tagged with the exact checked-out SHA exists in ACR before creating/updating a separate app `starkeepsake-api-sky-staging` (scale to zero). No existing API is modified.
4. New staging defaults to `SkyMask__Enabled=false`. Add your Fal key as a secret `fal-api-key` to the **new staging app**, not to the Vercel frontend. Reference it through `Fal__ApiKey=secretref:fal-api-key` and set `SkyMask__Enabled=true` on staging. Do not paste the key in chat.
5. Confirm staging `GET /api/sky/mask/status` is `{"available":true}`, then configure a Vercel preview **branch-specific override** for `VITE_API_BASE_URL` to the new staging API URL. The shared Vercel default points to the live API and must not be changed.
6. Test the original Chicago image and examine the mask before merging. This *one* requested AI removal invokes a metered third-party model; all subsequent edge and halo adjustments in the same open preview are local and free.
7. On completion, disable `SkyMask__Enabled`, delete staging and remove the temporary Azure OIDC feature-branch credential to minimize blast radius and costs.

The staging script is deliberately opt-in and the workflow does **not** deploy to Azure. ACR image storage and staging resources may incur costs even at zero replicas.
