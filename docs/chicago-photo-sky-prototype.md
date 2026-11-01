# Sky Lab Chicago photographic sky prototype

This adds a *browser-only* test of a transparent equirectangular foreground
rendered over StarKeepsake's existing Hipparcos/Skyfield/JPL star calculation.

## Run it
1. Open Sky Lab, select **Chicago**, and enter the observer sky.
2. Download `chicago_foreground.webp` from the companion prototype package
   supplied in the chat. The image is intentionally **not** committed to the
   repository; it is an AI-generated test texture and may be replaced.
3. Use the **Transparent 360° skyline** file selector to choose the WebP.
4. Select **Chicago photo experiment** and rotate/tilt the camera.
5. Change the selected **UTC date/time**. The photo stays fixed while stars
   update from the existing astronomy backend. Stars go behind any opaque
   skyline pixels automatically.
6. Adjust **Panorama center compass bearing** and **Horizon alignment** for a
   visual calibration. Avoid claiming they represent true north.

The original illustration and Google Street View modes remain available.

## Technical details
- `SkyPhotoForeground.tsx`: WebGL1 pinhole camera, RGBA panorama texture,
  perspective matching `projectObserverStar`; alpha handles obstruction.
- `panoramaProjection.ts`: explicit image-bearing mapping and inverse camera
  math, independently tested by `npm run test:photo-panorama`.
- No AI sky/background is displayed: the masked WebP contains the foreground
  only and shows the calculated stars through transparent sky pixels.
- No new database, API keys, billing or production storage is required.
- File stays in the user's browser through an object URL and is not uploaded to
  StarKeepsake servers.

## Accuracy limits
- Source panorama is generative artwork, not a georeferenced image from a
  measured viewpoint in Chicago.
- Generated landmark geometry is illustrative and may not be physically
  plausible when rotated. The source's true compass orientation is unknown.
- Calibration sliders control the look of the overlay only. Without reference
  features or measured panoramic orientation, we cannot verify the stars
  against actual buildings.
- Mask needs manual edge cleanup (tree twigs and antenna silhouettes) before
  publishing professionally.
- This is an immersive camera test, not a historical reconstruction of local
  weather, moonlight, light pollution or real street-level appearance.

For production-grade accuracy, source a properly licensed original 360° photo
whose equirectangular projection, latitude, longitude, level and true compass
heading have been measured. Then export an accurate sky-occlusion mask.
