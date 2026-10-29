# PR 3 — Experimental Horizon Blend (DesignSpec v1.4)

Horizon Blend is a **separate, optional artistic visualization**, not the
classic physical star-hole/LED pattern. Default remains `classic`.

## User flow

1. Upload an outdoor photo and enter a date, time (or unknown), and location.
2. Generate real Hipparcos star positions through the existing ASP.NET →
   Azure Python astronomy service.
3. In step 3 select **Horizon Blend · experimental**.
4. Click **Detect sky in my photo** to run ADE20K DeepLab semantic segmentation
   **in the customer's browser** on the uploaded photo.
5. The browser draws selected genuinely calculated Hipparcos stars **only in
   confidently detected sky pixels**, tinting detected sky subtly while
   leaving all non-sky photo pixels unchanged.
6. A clear message explains detected sky coverage and number of accepted stars.
   No detected sky = no inserted stars. Revert to Classic Frame freely.

The image remains in-memory in the browser for this detection. Model library
scripts are fetched on demand from jsDelivr, pinned to
`@tensorflow/tfjs@4.22.0` and `@tensorflow-models/deeplab@0.2.2`.
The segmentation model's public, quantized ADE20K weights are fetched when
requested. This component **does not send photo pixels to an AI inference
service**. Existing engraving-preview uploads through the app's ASP.NET API
remain a separate feature. Script/model network access and browser WebGL/CPU
support are required, so model loading can fail; show an error and preserve
the classic layout rather than synthesizing an unverified sky.

Sources: [TensorFlow.js DeepLab](https://github.com/tensorflow/tfjs-models/tree/master/deeplab),
[ADE20K segmentation](https://groups.csail.mit.edu/vision/datasets/ADE20K/),
[ESA Hipparcos](https://www.esa.int/Science_Exploration/Space_Science/Hipparcos_overview).

## Scientific / manufacturing limits

- The **stars are real**: their HIP ID, brightness and azimuth/altitude are
  calculated from the chosen moment and location by the existing engine.
- The **placement over the customer's photograph is NOT an accurate
  reconstruction** of what the camera saw: camera orientation, field of view,
  lens geometry, landscape topography, exposure and actual sky visibility
  are unknown. Do not promise astronomically aligned overlays.
- The ML sky mask may be inaccurate on indoor, cloudy, nighttime or complex
  photos. Boundary masking rejects star points near edges and foreground,
  but quality cannot be guaranteed.
- No generated Horizon Blend raster is uploaded, ordered, persisted or
  exported as laser-ready manufacturing content. Do not put it into
  production bundles before a separate manufacturing design is approved.
- This UI-only mode does not affect the canonical classic 3D frame geometry,
  M5 astronomical projection, public API, or production laser parameters.
- Known gap: automatic segmentation needs browser-device QA on real images
  and verification of runtime CDN/model availability before being called
  production-ready. Tests cover deterministic mask clipping, not AI accuracy.
