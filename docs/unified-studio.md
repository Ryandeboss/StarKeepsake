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

## Staging location fallback and photo composition controls (November 2026)

The staging API requires the **server-side** `AzureMaps__SubscriptionKey` configuration in Azure Container Apps (ASP.NET config path `AzureMaps:SubscriptionKey`). If it is unset, normal address/city search and the server-based location-to-time-zone resolution return 503. No secret is injected into Vercel or any `VITE_` environment variable.

To unblock visual testing without inventing time zones, the unified page has a visibly labeled **sample cities** row. These cities have known, fixed latitude, longitude, and IANA time zone IDs, and they bypass only the unavailable Azure Maps search/resolve calls. The original astronomy calculation still runs on the backend. Client-side sample resolution validates DST skipped/repeated hours and correct local-to-UTC conversion. Arbitrary address search still requires restoring Azure Maps server configuration; the fallback is not represented as a universal geocoding service.

The two layout cards **Above my photo** and **Within my photo** now appear before generation. Above has adjustable sky height (20–70%) and five fitting modes (fit, center/top/bottom crop, stretch); the preview-only geometry reprojects display star positions without changing catalog identities or claiming manufacturing-ready artwork. Within preserves the original foreground pixels through the full AI sky-cutout editor (local edge recovery, spot cleanup, rectangle sweep, undo), and never requests a paid Fal mask until explicitly clicked. The cutout remains editable during the current page session. No purchase flow exists.
