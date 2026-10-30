# Sky Lab – Street View setup (optional)

The **Calculated night sky** uses our Hipparcos/Skyfield backend and works
without a Google account or Maps key.

The separate **Real Street View** mode is an opt-in Google Maps JavaScript
API panorama, not a nighttime reconstruction. Visitors drag and follow
arrows to view real existing street photography. On returning to our
calculated night sky, the panorama heading and pitch are transferred so the
observer faces roughly the same direction (zoom and building occlusion are
NOT calibrated).

## Enable real panoramas

1. In Google Cloud Console, select or create a Maps Platform project,
   enable billing, and enable **Maps JavaScript API**.
2. Create a dedicated browser API key. Set **Application restrictions**
   to Websites/HTTP referrers and include
   `https://starkeepsake.vercel.app/*` and any production custom domain.
   Under **API restrictions**, restrict the key to **Maps JavaScript API**.
3. Review [Dynamic Street View pricing](https://developers.google.com/maps/billing-and-pricing/pricing)
   and configure usage/quota alerts or limits to prevent unexpected bills.
4. In Vercel > StarKeepsake > Settings > Environment Variables, add
   `VITE_GOOGLE_MAPS_API_KEY` for the Production environment. This is a
   client-side **public, referrer-restricted** key; the `VITE_` prefix
   embeds it in the JavaScript build. Do NOT use a private backend key.
   Never paste the key into chat, issues, or GitHub commits.
5. Redeploy production to embed the new value.
6. Navigate to Sky Lab, select Chicago, enter the sky, and choose
   **Real Street View**. Verify camera movement and that switching back
   to the calculated sky retains the approximate viewing direction.
7. Test at least one other city and a scenario where nearby Street View
   coverage is unavailable (show the Google Maps link instead).

## Important limitations

- Google panoramas are photographs captured on Google's own dates. They
  are not photographs from the chosen historical year, time or weather.
- The photo camera may be hundreds of meters from the city centroid
  used by our sky calculations. Navigating further along a street does
  not update astronomy location currently.
- The ground view and calculated night sky are **separate modes**;
  no night sky is composited over the photographs, since doing so would
  require verified building masks, optics and view geometry.
- The Google Street View API is not requested on ordinary Sky Lab visits.
  We fetch it only when the visitor explicitly selects the real ground mode
  and the public API key is configured.
- Without a key the mode shows a working link to Google Maps' closest
  available ground panorama instead of attempting an API call.
- Existing illustrated horizons remain as an offline-safe fallback;
  objects in these drawings use the same gnomonic camera projection as
  the stars to eliminate the previous parallax drift, but the buildings
  and landmarks are not measured real-world locations.

References:
- https://developers.google.com/maps/documentation/javascript/streetview
- https://developers.google.com/maps/documentation/urls/get-started
- https://developers.google.com/maps/api-security-best-practices
