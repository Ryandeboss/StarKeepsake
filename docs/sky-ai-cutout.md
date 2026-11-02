# Sky-only AI cutout prototype (not released)

## User flow

1. Sky Lab → Chicago → upload a skyline photo (JPG, PNG, WebP).
2. A full-fit side-by-side dialog shows original photo at its complete aspect ratio. No zoom canvas or nested scrollbars.
3. Click **Remove sky with AI** to request text-prompted "sky" segmentation. The model produces a mask only; the site applies it to **unchanged original RGB pixels**. No building, tree or waterfront pixels are generated.
4. Inspect the result over a dark night gradient or a checkerboard. If mask polarity is reversed, use **Invert AI mask**. Click **Apply to night sky** only after checking.
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

## Isolated Azure staging procedure

The Vercel production and preview environments currently share `VITE_API_BASE_URL` pointing at `starkeepsake-api-dev`. **Never deploy this feature to that shared API as an early test.**

1. In Azure Cloud Shell, clone this feature branch, `cd StarKeepsake`, and run `bash scripts/deploy-sky-mask-staging.sh`. This first run is dry-run, prints only resource metadata and does not create resources.
2. Review Azure costs. Then run `bash scripts/deploy-sky-mask-staging.sh --deploy`. This builds the feature-branch API in the existing ACR and creates a new, scale-to-zero Container App `starkeepsake-api-sky-staging`. It reads the Fal secret from the existing Container App through Azure and copies it directly to the new app without printing it. The source app remains untouched.
3. Confirm `GET /health` returns the branch commit and `GET /api/sky/mask/status` returns `{"available":true}` on the new URL. These checks never make a paid model call.
4. Configure **only** the Vercel branch-specific `VITE_API_BASE_URL` for `feature/sky-only-ai-cutout` to the new staging API URL. Do not replace the shared production/preview variable; the branch override must have precedence.
5. Open the branch preview and upload the original Chicago JPG. Click the AI action *once*, inspect all tree branches, skyline and water pixels, then cancel or apply. A single request incurs a provider charge.
6. After testing, disable `SkyMask__Enabled` or delete the isolated test app to stop further inference; keep production unchanged. The staged ACR image persists unless removed.

The staging shell script is a deliberately opt-in Azure infrastructure change. It is not executed by GitHub Actions or by this PR, and cloud resources may have charges even at zero replicas (ACR build/storage).
