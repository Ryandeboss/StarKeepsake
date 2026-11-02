# Sky Lab photographic atmosphere — visual prototype

The interactive sky viewer now renders the environment in two distinct layers:

1. **Camera-aware atmospheric plate**, calculated locally in a Canvas 2D
   pixel buffer. Ray altitude is derived from the same perspective camera
   and vertical/horizontal field of view as the star coordinates. Near-black
   sky, muted teal-blue airglow, amber city-light pollution around the
   altitude=0° horizon, and low-contrast sensor grain replace the old
   simple SVG blue rectangle. There are **no fictitious background stars**
   in this layer, nor any dependence on AI image textures or paid services.
2. **True catalogued HIP stars**, still using the current API's calculated
   azimuth, altitude and magnitude. A brightness-driven point-spread profile
   gives them smaller, sharper centers and softly fading color-temperature
   halos. Scientifically identifiable star colors are preserved. Other
   stars use neutral white rather than inventing physical spectral types.

The Sky Lab astronomy request uses 200 stars, the maximum currently
accepted by the design-engine, with 1 mm artwork-space separation to avoid
dropping as many visually useful stars. This setting affects only Sky Lab
requests, not manufacturing defaults or customer orders.

A **Photographic sky** toggle enables stronger exposure-style airglow
and luminous bloom. It is artistic enhancement, not a claim that the view
matches historical Bortle conditions or a long-exposure image. The
constellation guides and educational overlays are unchanged.

## Performance and expected behavior
- A 400×240 atmospheric color buffer is redrawn only when the observer
  heading, pitch, field-of-view or exposure setting changes, with redraw
  scheduled on `requestAnimationFrame`.
- SVG stars are interactive and not rasterized: hover, click, keyboard
  focus, and subtle reduced-motion-aware twinkle remain.
- The atmosphere fills the camera viewport via `object-fit: cover`, to
  match the sky SVG's `preserveAspectRatio="xMidYMid slice"`.
- The Chicago JPG foreground and mini N/E/S/W dome remain separate layers.

## Scientific and aesthetic limitations
- The sky image is illustrative and contains no computed Milky Way, nebulae,
  clouds, moonlight, twilight, or measured light-pollution data.
- Catalog selection is limited by the existing production-compatible
  astronomy API to at most 200 selected HIP stars. A later separate
  visualization-only catalog/endpoint could increase density without
  violating physical LED/engraving constraints.
- No photo assets or external image services are required for this change.
