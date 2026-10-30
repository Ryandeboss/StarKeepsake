# Sky Lab: star inspector and independent reference material

The Sky Lab panorama at `/sky-lab` now has a persistent star inspector.

## Each plotted star
- Originates **exclusively** in a real Python Hipparcos/Skyfield response.
- Hover, focus, tap or click to inspect its Hipparcos identifier, V-band-like
  displayed apparent magnitude (from engine's catalogue magnitude), altitude
  above the ideal horizon and azimuth (bearing clockwise from north).
- Click to pin; click the same star to unpin. Keyboard Enter/Space works.
- Displays one of 13 reviewed common names, its constellation and a short
  descriptive fact when that HIP number has a curated entry. Otherwise
  displays the HIP number alone and explicitly says that StarKeepsake has no
  verified common name in its list.
- Provides a deep link to Strasbourg CDS SIMBAD identifier search:
  `https://simbad.u-strasbg.fr/simbad/sim-id?Ident=HIP+<id>`.
  This is an external scientific cross-reference and is **not** an assertion
  that SIMBAD's spectra, distances or measurements have been fetched here.
- The named-star shortcuts are derived from **current real engine results**;
  if none of the displayed stars has a verified name, show the brightest
  calculated entries by HIP ID instead.
- The star inspector is an educational panel, never part of the engraved
  artwork. The observed sky still assumes an unobstructed geometrical horizon.

## Independent verification tools

1. NASA's Eyes on the Solar System Telescope mode:
   `https://eyes.nasa.gov/apps/solar-system/`. NASA's own skywatching
   documentation says one can pick a point on Earth and then see a
   constellation-enabled view of the sky **right now**.
   `https://science.nasa.gov/skywatching/`
2. Stellarium Web: `https://stellarium-web.org/`. Independent open-source
   software that supports location and date/time changes. University of Iowa
   tutorial: `https://itu.physics.uiowa.edu/labs/foundational/exploring-sky-i/using-stellarium-web`.
3. NASA article `https://www.nasa.gov/image-article/stargazing-from-international-space-station/`
   explicitly describes scientists matching an ISS night-sky photo to
   star charts using the observation's exact time and location.

These links are **independent references**, not guarantees of pixel- or
frame-for-frame agreement with StarKeepsake's 360° horizon panorama. NASA,
ESA and Stellarium have not endorsed the product. Local terrain, air
turbulence, clouds, lens orientation, light pollution and detection of
planets are not simulated by the Hipparcos-only panorama.

## Actual astrophotography

Three externally sourced images are shown with credit, an outbound NASA
page link and text saying the photos do not correspond to the current
custom time/location. They are linked *not saved, cloned, or made into
user artwork*. Remote image rendering requires availability at NASA's
official URLs and does not imply NASA licensing or endorsement:

- NASA Scientific Visualization Studio (SVS) `https://svs.gsfc.nasa.gov/31347/`:
  Don Pettit's Milky Way star-field from orbit,
  `pettit-star-field.jpg`; processed by Babak Tafreshi.
- NASA SVS: star field containing M31 and M33 as seen from orbit,
  `star-field-showing-m31-and-m33.jpg`, Don Pettit.
- NASA Skywatching real night-sky photograph, Orion over a rural
  landscape, credit NASA/Preston Dyches, source
  `https://science.nasa.gov/skywatching/`.

If a NASA image host is unreachable the source link still provides
the caption and original material.
