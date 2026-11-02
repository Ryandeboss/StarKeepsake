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
- **Disabled by default**. Without the key, `GET /api/sky/mask/status` returns `{"available":false}` and the UI disables the AI action. No paid API calls happen without explicit clicking.
- Metered third-party processing incurs charges. Before configuring a key for public visitors, enforce an account/usage budget and monitor service spend. A 3-per-10-minute per-IP limiter is provided but is not a reliable billing ceiling for an anonymous public site; auth, abuse controls, and monetary caps are still necessary.
- When clicked, an upload copy of the user's photo is sent to Fal. The original browser photo is not uploaded when using the local fallback or an existing transparent PNG. Check Fal's privacy and retention terms before public launch.
- On provider error or unusable mask, the original remains intact and the user can cancel. The server returns an error without disclosing credentials.

## Correctness and limitations

- This is a **prototype** pending credentialed, browser-level tests on the owner's actual Chicago image. The Fal model's ability to segment thin leafless tree twigs and disconnected sky patches has **not been verified**.
- The image-transmission copy is resized to a maximum side of 2048 pixels, while the mask is composited onto the original-resolution RGB image. Fine branches may need a higher-res model path later.
- A semantic model can misclassify water or buildings. Always review before applying, especially for complex skyline panoramas.
- No true compass bearing, 360° view, historic photographic accuracy, or real sky photometry is implied.
- Pre-existing production and manufacturing design workflows are unchanged.
