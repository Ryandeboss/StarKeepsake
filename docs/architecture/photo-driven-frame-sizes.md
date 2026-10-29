# Photo-driven frame sizes (DesignSpec v1.5)

The three nominal stock frame openings (8×10, 11×14, 16×20 inches)
are retained; they have nearly identical portrait proportions, so the
configurator now shows them at a common physical preview scale with the
actual width/height dimensions clearly printed.

A fourth **Fit my photo · custom** choice is selected automatically after
the first image upload unless the customer explicitly chose a stock size.
This constructs the opening from the EXIF-oriented **original photograph
aspect**. The photo panel has the same ratio and contains the entire photo:
there is no automatic cropping.

For a photo aspect `r` (clamped between 0.35 and 3.0), the engine and
frontend both construct a custom width of up to 279.4 mm with a 6mm base
margin; photo height is `267.4/r`; sky and footer heights are derived from
photo height with bounded aesthetic limits. If the design exceeds 508mm
tall, all physical geometry is reduced by the same factor. Both
Python and TypeScript return physical millimeter rectangles, so stars,
engraving, photo and footer never use incompatible guessed rectangles.

**Custom sizes are not ordinary stocked frame SKUs** and must not be
offered for sale until suppliers and real build tolerances are confirmed.
The visual preview is a sizing proposal, not a manufacturing guarantee.
Physical frame style and edge profiles remain illustrative.

Changing a frame size with a resolved location requests astronomy
again. Users can choose an existing stock preset to retain standard
purchase options even if this means their original image letterboxes.
