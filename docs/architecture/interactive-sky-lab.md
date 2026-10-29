# Interactive Sky Lab — Earth → Observer → Calculated Sky

Standalone route: `/sky-lab`. The keepsake preview has a new prominent
**Explore the 3D Earth & interactive night sky** link. This page is a
scientific visualization, not a production design-editing screen.

## Earth

A pointer-draggable Earth is drawn using a genuine orthographic 3D
coordinate projection. Eight clickable cities/observer markers use real
latitude and longitude. Globe landmasses are **coarse illustrative
silhouettes**: not a geographic atlas, not an official NASA globe.

Click a city marker to zoom into its location and enter a separate
night-sky view, or select a city from accessible buttons and choose
`Travel down & view the sky`.

## Night sky

Location and UTC date/time are submitted to StarKeepsake's existing public
ASP.NET API, which forwards them to the Skyfield + Hipparcos/JPL Python
astronomy engine. Every returned star in the sky panorama has an actual
HIP ID, magnitude, altitude and azimuth.

- Choose any supported UTC date between 1850 and 2149 and time of day.
- Click `Animate the sky` to advance **one hour every 8 seconds**.
  Each position comes from a fresh engine response; SVG transitions
  smoothly bridge computed snapshots (an illustration, not numerically
  exact frame-by-frame celestial motion).
- The API is IP-rate-limited to 20 astronomy calls/minute; animation
  requests ~7.5 per minute in this page with a 400ms debounce, barring
  additional manual requests from the same IP.
- The sky view is a **360° altitude/azimuth panorama**, not a
  perspective-camera simulation, a photo taken from that location,
  or a physically measured local landscape horizon. North is centered;
  West is left, East is right. Only above-ideal-horizon stars are plotted.
- The chosen exact time is **UTC** for all locations to avoid silent time
  zone or daylight-savings mistakes. The controls explicitly say UTC.
- Failure messages preserve accuracy: no fictional replacement star map
  is shown when the API cannot calculate.

## Historical background

The page summarizes documented Mesopotamian systematic astronomical
observations by about 1000 BCE, Hipparchus's systematic star catalogue
in the second century BCE, and modern ESA Hipparcos astrometry.

Sources:
- [ESA: From ancient star maps to precision astrometry](https://sci.esa.int/documents/33580/36006/1567260353925-ESA_Gaia_DR2_MediaKit_23042018.pdf)
- [OpenStax: Ancient astronomy](https://openstax.org/books/astronomy-2e/pages/2-2-ancient-astronomy)
- [Skyfield: Positions](https://rhodesmill.org/skyfield/positions.html)

**Limitations**: This educational viewer doesn't feed source photographs,
frame geometry, AI sky blending, or manufacturing exports; its globe
shapes are approximate and star count is capped for legibility.
