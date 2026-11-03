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

## Typed location search and Azure Maps recovery

The original searchable location field remains in the unified page. When
the staging Azure Maps key is present, StarKeepsake uses the actual
`/api/locations/search` and `/api/moments/resolve` endpoints, which support
cities, addresses, and landmarks. The necessary **server-side** setting
is `AzureMaps__SubscriptionKey` in the Azure Container App. No key is put
in Vercel frontend configuration.

When Azure Maps returns an error or is unreachable, the page switches to a
bundled, local GeoNames city gazetteer (32,754 entries, including Bolingbrook,
Chicago and global capitals). Visitors can still **type the name of a city
or town**, press Find, choose a result showing its country and coordinates,
and generate a real astronomical sky. There is no fixed sample-city picker.
The local database is fetched only on the first fallback search and cached
by the browser; no additional third-party API request is made per keystroke.
An offline city record carries its IANA timezone; wall-clock conversion
checks for invalid and ambiguous DST hours before sending the calculated UTC
moment to the existing astronomy API.

**Coverage:** the gazetteer includes cities with about 15,000+ residents and
national capitals. It is not a street-level or landmark geocoder. Exact
street addresses and lesser-known places require Azure Maps to be restored;
the UI explains this rather than silently substituting a nearby city.

**Attribution:** original data © GeoNames (geonames.org), CC BY 4.0,
https://creativecommons.org/licenses/by/4.0/ . This bundled, compact JSON
export was adapted from
https://github.com/serdarsalim/Time-Zoner-Converter-Chrome-Extension
and is redistributed with GeoNames attribution. Update the dataset
periodically when necessary to avoid stale administrative names.


The two layout cards **Above my photo** and **Within my photo** now appear before generation. Above has adjustable sky height (20–70%) and five fitting modes (fit, center/top/bottom crop, stretch); the preview-only geometry reprojects display star positions without changing catalog identities or claiming manufacturing-ready artwork. Within preserves the original foreground pixels through the full AI sky-cutout editor (local edge recovery, spot cleanup, rectangle sweep, undo), and never requests a paid Fal mask until explicitly clicked. The cutout remains editable during the current page session. No purchase flow exists.
