# Studio photo plates · Chapter 05

These **11 files were supplied by the shop owner** from Nano Banana / Gemini (not photographs of physical StarKeepsake inventory). They are self-hosted under `apps/web/public/showroom`, so customer artwork never needs to be sent to the image generator.

## Chroma-key frame plates (9)
The green area was analyzed in the original image and its four corners saved in `HomeShowroomOptions.ts` as normalized TL, TR, BR, BL coordinates. At runtime:

1. Load only the selected local photograph.
2. Remove green-screen RGB and the immediate anti-aliased green fringe from **the plate only** using a browser canvas.
3. Position the live, astronomical StarKeepsake artwork behind the plate with a CSS matrix3d homography (exact 4-corner mapping, including the oblique perspectives).
4. Keep the frame, mat board, original wall surface and natural photograph shadows untouched in the foreground.
5. For a mismatch in picture ratios, **letterbox**, never stretch or crop the customer's entire frame artwork.
6. The user's original photo and star calculations never go to the third-party photography/image generation service.

| Scene | File | Original image size | Use |
|---|---|---|---|
| Warm living room | room-warm.png | 1024 × 572 | primary landscape host |
| Gallery wall | room-gallery-matted.png | 1024 × 687 | matted wall |
| Modern room | room-modern.png | 1024 × 687 | modern living interior |
| Side view | room-oblique.png | 1024 × 687 | perspective quadrilateral |
| Frame detail | frame-closeup-perspective.png | 1024 × 687 | closeup side angle |
| Portrait in room | room-portrait.png | 1024 × 687 | naturally matches portrait keepsakes |
| Walnut studio | studio-walnut.png | 1024 × 687 | wood finish study |
| Oak studio | studio-oak.png | 1024 × 687 | light finish study |
| Ebony studio | studio-ebony.jpg | 2048 × 1373 | dark finish study |

## Other supplied assets
- `glass-reflection.png` (1024 × 765) is screened at **very low opacity** on top of the composited artwork; optional via in-room Glass on/off.
- `shadow-map.png` (1024 × 765) is retained as an optional study/reference asset, **not** used over photographic wall shadows, since duplicating the shadow looks fake.

## Quality assurance
- `npm run test:showroom` checks all 9 perspective quads and the portrait/landscape contain math, including a color-key test proving the original plate RGB is unchanged.
- Verify real images with different aspect ratios and both star placements. Manually verify that no green outlines remain, the studio finish sampler changes to the corresponding photographic frame, and the panel stays aligned through mobile resizes.
- Current composite is a digital visualization, not a physical product photo, confirmed part SKU, real 3D scene or AR. The Etsy checkout still depends on a real listing and paid-order integration.

## Template replacement instructions
To replace a plate, supply a front-on or angled JPEG/PNG with exactly one unobstructed chroma-green artwork opening. Keep its original resolution and update the `path`, `width`, `height` and `quad` values in `HomeShowroomOptions.ts`. Image borders must not overlap the green area. Run the showroom geometry tests and inspect the browser preview.
