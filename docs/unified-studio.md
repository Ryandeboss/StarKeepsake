# Single-page StarKeepsake studio

The root URL, /create, and /sky-lab all render `ExperiencePage`: a one-page
landing-and-builder studio. The old page source files remain in the repository
for reference and later migration, but are no longer routed.

## Visitor workflow

- Hover or tap the photograph section of the sample frame to select an image.
  The small drag-and-drop upload panel and keyboard-accessible file input provide
  alternative interaction; JPG/PNG/WebP, maximum 10 MiB. A photo is kept as a
  browser-local object URL and is not uploaded for engraving in this flow.
- Hover or tap the sky panel to open date, optional exact time, and location
  search. A search request returns candidates; the visitor must choose one.
- Clicking Generate calls the existing resolve-moment endpoint (for time zone)
  and then the real catalog astronomy endpoint. The loading animation is
  explicitly a *visual estimate*, not server-reported percent complete.
- The frame's physical artwork geometry adapts to the uploaded image's ratio
  through the existing auto layout. The preview is **illustrative**, not a
  fabrication, laser-ready, pricing, or Etsy ordering workflow.
- After building, users may optionally choose a browser-local artistic sky
  blend within the photo if the image has visible sky, or keep stars above the
  photo. Camera orientation is not inferred. The 3D-style immersive observer
  remains a collapsible section on the same page and uses the calculated
  moment, rather than a separate Sky Lab route.
- The existing `StarKeepsakePreview` is reused in `minimal` mode; hover/touch
  overlays on the star and photo regions expose input controls. Its richer
  controls remain intact for any other use.
- No buy, order, Etsy submission, payment, or manufacturing claim is made.
  Future purchase flow will require an explicit reviewed handoff containing
  image, selected moment/location, frame treatment, and agreed fulfillment
  details.

## Resource cost and safety

The frame hover effects, animated rings, image preview, finish switches, and
scene transitions run locally in CSS/React. Location search and sky calculation
call the existing API **only on explicit actions**; no timer-driven API polling.
The browser-side horizon blending model is requested only when a user selects
that option. This feature is submitted as one GitHub tree/commit to minimize
Vercel's automatic preview deployments. Changes are held on the existing draft
PR branch until reviewed.

Respect `prefers-reduced-motion`, label the star field as astronomical where
calculated and artistic where blended, and avoid NASA affiliation claims.

## Typed location search (Geoapify primary)

The existing `/api/locations/search` and `/api/moments/resolve` endpoints now
prefer Geoapify when the ASP.NET API server has `Geoapify__ApiKey` configured.
This supports cities, typed street addresses, and landmarks without putting
the key in Vercel or in browser JavaScript. The geocoder normally returns
coordinates and IANA time-zone ID together in a single result; the existing
.NET DST validation calculates the selected date/time's real UTC moment.
For a result without a zone, Geoapify reverse geocoding is used at resolve time.

If Geoapify is not configured, the backend retains the original Azure Maps
integration. If the live search request fails, the frontend uses the licensed
GeoNames gazetteer (32,754 cities). Offline city matches calculate real
astronomical skies but cannot match precise street addresses or landmarks.
Geoapify results display required linked attribution next to the location.

### Staging setup (server-only key, no production changes)

The new API code must be built and deployed to the separate Container App
`starkeepsake-api-sky-staging` before frontend testing. The Docker GitHub
Action only pushes an ACR image; the deployment script
`scripts/deploy-sky-mask-staging.sh --deploy` updates the staging app after
the exact branch head has been checked out. Check the reported `/health`
commit ID. Use a secret reference to set the key on that staging app only:

```bash
read -rsp "Geoapify API key: " GEOAPIFY_KEY; echo
az containerapp secret set -g rg-starkeepsake-dev \
  -n starkeepsake-api-sky-staging \
  --secrets "geoapify-key=$GEOAPIFY_KEY" --output none
unset GEOAPIFY_KEY
az containerapp update -g rg-starkeepsake-dev \
  -n starkeepsake-api-sky-staging \
  --set-env-vars "Geoapify__ApiKey=secretref:geoapify-key" --output none
```

Never commit the key, use `VITE_` variables, or paste a secret in chat.
Tests after deployment: search Chicago, Paris France, and a complete street
address; select results and generate a real sky, including a DST transition
case. Disconnect the provider to check offline city fallback. Avoid
per-keystroke billing and monitor the free usage quota before public launch.
Reference: https://www.geoapify.com/pricing/ .


The two layout cards **Above my photo** and **Within my photo** now appear before generation. Above has adjustable sky height (20–70%) and five fitting modes (fit, center/top/bottom crop, stretch); the preview-only geometry reprojects display star positions without changing catalog identities or claiming manufacturing-ready artwork. Within preserves the original foreground pixels through the full AI sky-cutout editor (local edge recovery, spot cleanup, rectangle sweep, undo), and never requests a paid Fal mask until explicitly clicked. The cutout remains editable during the current page session. No purchase flow exists.

## Manual horizon and sky-mask editor (restored)

The **Within my photo** selection exposes two explicit actions once a user
uploads an image: **Detect horizon & edit sky manually** (free and local)
and **Remove sky with AI** (optional Fal-powered editor). This restores the
older manual SkyMaskEditor that had been dropped from the unified builder.
Manual editing works even if Fal is not configured or unavailable.

The free editor starts with conservative top-connected near-white sky removal,
then supports connected-color magic wand, adjustable tolerance, remove/restore
brush strokes, traced polygon removal, mask-overlay/night/transparency previews,
and Undo/Redo. It accepts portrait and landscape photos (up to 50 MP input,
2600-pixel longest-side working preview). At normal zoom the complete photo
is visible within a vertically scrollable dialog; zoomed-in images can pan
horizontally. Edited alpha is saved in memory for subsequent editing of the
same uploaded photo, always composed against the original RGB. Uploading a
new photo clears the edit session. No free editor action calls a model or
uploads the photo. Bright-sky auto-detection is not a semantic horizon detector;
colored/cloudy or complex skies require manual correction or the separate AI
option. Both modes continue to use the calculated star field once applied.

Regression tests: `npm run test:sky-mask-editor` and the existing
`test:sky-cutout`; GitHub CI runs both. Do not merge until browser review.
