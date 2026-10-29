# M5 Astronomy Engine

M5 replaces the placeholder star pattern with a real star field calculated for the customer's resolved place and moment.

## Astronomy sources

- Skyfield 1.55 performs the coordinate calculations.
- The Hipparcos catalog supplies stellar positions, proper motion, and visual magnitude.
- JPL DE440s supplies the Earth ephemeris needed for topocentric apparent positions.
- The Docker image caches both datasets during build so runtime requests do not download astronomy data.

## Projection and manufacturing selection

1. Compute apparent altitude and azimuth for Hipparcos stars at the observer's latitude/longitude and UTC moment.
2. Keep stars at or above the geometric horizon.
3. Map the visible hemisphere with an azimuthal-equidistant projection:
   - zenith at the artwork center
   - north at the top
   - east to the right
   - horizon at the sky circle edge
4. Exclude stars that land inside the reserved engraving-photo and text regions.
5. Select stars from brightest to dimmest, enforcing a minimum physical spacing.
6. Map apparent magnitude to a small set of manufacturable hole diameters.
7. Assign sequential LED indexes for later physical/electronics work.

Default M5 settings are magnitude limit 6.0, up to 96 selected stars, and 3.5 mm minimum separation.

## Unknown exact time

M4 intentionally leaves UTC null when the customer does not know the exact time. M5 uses **local midnight at the start of the selected date** as an explicit representative calculation time and marks the result with `timeBasis = date-only-local-midnight`. The UI must disclose this instead of presenting it as an exact-time sky.

## Current supported date range

M5 accepts astronomy moments from 1850 through 2149, matching the useful covered range of the bundled DE440s ephemeris.

## Endpoint

`POST /astronomy/stars`

The design engine returns calculation metadata plus canonical physical star coordinates in millimeters. The ASP.NET API remains the public orchestrator; browsers should not call the design engine directly once the internal-ingress transition is complete.
