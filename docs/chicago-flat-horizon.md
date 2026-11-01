# Chicago flat skyline — Sky Lab photo test

## What changed
- Removed the **360-degree photo texture mapping** from the Chicago photo mode.
  The supplied image is a wide, front-facing shot, not an equirectangular
  spherical capture. Mapping it overhead was geometrically incorrect.
- When the user selects a Chicago JPG/PNG/WebP in Sky Lab, the browser now
  removes top-connected near-white pixels as sky and keeps opaque pixels
  for buildings, lights, trees, the shore and water. The entire operation
  happens locally; there is no image upload to StarKeepsake.
- The processed image is drawn as a **bottom-anchored flat foreground plate**
  with original aspect ratio (scale adjustable between 100 and 160%).
- Hipparcos/JPL/Skyfield stars still render behind transparent pixels.
- The four large FPS directional arrows and the row of arrow controls are
  removed. Drag/swipe and keyboard arrows continue to rotate the star camera.

## Test
1. Select Chicago, enter Sky Lab, then use **Chicago skyline photo**.
2. Upload the original `Gemini_Generated_Image_va3qmova3qmova3q.jpg`
   supplied by the owner. A white sky will be removed automatically.
3. Verify that the skyline is **at the bottom** and remains upright.
4. Rotate and tilt the sky; the image remains a stationary photographic
   foreground in this prototype (not a true freely navigable 3D city).
5. Change the UTC date/time and confirm the sky changes behind the skyline.
6. Test the *Calculate night sky* and optional *Real Street View* modes.

## Limitations
This deliberately does not represent a physically correct street-level 360
view. Camera motion affects the stars but not the flat skyline, so alignment
of stars to photographed building bearings is **not physically calibrated**.
The generated image is not a surveyed viewpoint. For a realistic 360 city
view, a correctly oriented panoramic image, depth/sky mask, and measured
camera heading are required.

No new paid services, secrets or storage were added.
