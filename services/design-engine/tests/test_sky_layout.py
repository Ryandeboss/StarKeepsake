"""Regression tests for the canonical sky-first physical layout.

These tests do not need a Hipparcos catalog download. They verify that the
skyfield projection is a faithful azimuthal-equidistant circle centered in
the upper sky panel, rather than visually shifting stars around the photo.
"""
import math
import unittest
from pathlib import Path

from astronomy import (
    ARTWORK_HEIGHT_MM,
    ARTWORK_WIDTH_MM,
    RESERVED_MARGIN_MM,
    RESERVED_REGIONS,
    SKY_CENTER_X_MM,
    SKY_CENTER_Y_MM,
    SKY_RADIUS_MM,
    SKY_REGION,
    _point_in_reserved_region,
    project_alt_az,
)


class SkyFirstLayoutTests(unittest.TestCase):
    def test_sky_region_is_strictly_above_photo_and_text(self):
        self.assertEqual(SKY_REGION, (0.0, 0.0, 279.4, 166.0))
        photo, text = RESERVED_REGIONS
        self.assertEqual(photo, (34.7, 174.0, 210.0, 125.0))
        self.assertEqual(text, (34.7, 305.0, 210.0, 44.0))
        self.assertLess(SKY_REGION[1] + SKY_REGION[3], photo[1])
        self.assertLess(photo[1] + photo[3], text[1])
        self.assertLessEqual(text[1] + text[3], ARTWORK_HEIGHT_MM)
        self.assertLessEqual(photo[0] + photo[2], ARTWORK_WIDTH_MM)

    def test_true_zenith_is_centered_in_top_sky(self):
        self.assertEqual(project_alt_az(90, 0), (SKY_CENTER_X_MM, SKY_CENTER_Y_MM))
        self.assertEqual((SKY_CENTER_X_MM, SKY_CENTER_Y_MM), (139.7, 83.0))

    def test_azimuths_preserve_north_up_east_right(self):
        north = project_alt_az(0, 0)
        east = project_alt_az(0, 90)
        south = project_alt_az(0, 180)
        west = project_alt_az(0, 270)
        self.assertAlmostEqual(north[0], SKY_CENTER_X_MM)
        self.assertAlmostEqual(north[1], SKY_CENTER_Y_MM - SKY_RADIUS_MM)
        self.assertAlmostEqual(east[0], SKY_CENTER_X_MM + SKY_RADIUS_MM)
        self.assertAlmostEqual(east[1], SKY_CENTER_Y_MM)
        self.assertAlmostEqual(south[0], SKY_CENTER_X_MM)
        self.assertAlmostEqual(south[1], SKY_CENTER_Y_MM + SKY_RADIUS_MM)
        self.assertAlmostEqual(west[0], SKY_CENTER_X_MM - SKY_RADIUS_MM)
        self.assertAlmostEqual(west[1], SKY_CENTER_Y_MM)

    def test_sampled_above_horizon_stars_fit_sky_and_miss_photo(self):
        x, y, width, height = SKY_REGION
        for altitude in (0, 15, 30, 45, 60, 75, 90):
            for azimuth in range(0, 360, 15):
                px, py = project_alt_az(altitude, azimuth)
                with self.subTest(altitude=altitude, azimuth=azimuth):
                    self.assertGreaterEqual(px, x)
                    self.assertLessEqual(px, x + width)
                    self.assertGreaterEqual(py, y)
                    self.assertLessEqual(py, y + height)
                    self.assertFalse(_point_in_reserved_region(px, py))
                    radius = math.hypot(px - SKY_CENTER_X_MM, py - SKY_CENTER_Y_MM)
                    self.assertAlmostEqual(
                        radius,
                        (90 - altitude) / 90 * SKY_RADIUS_MM,
                        places=8,
                    )

    def test_typescript_contract_matches_engine_geometry(self):
        # Catch independent frontend/engine edits that would manufacture
        # stars in a different physical panel from the UI preview.
        contract_path = (
            Path(__file__).resolve().parents[3]
            / "contracts"
            / "design-spec"
            / "design-spec.ts"
        )
        contract = contract_path.read_text(encoding="utf-8")

        for region_name, expected in (
            ("sky", SKY_REGION),
            ("engravingPhoto", RESERVED_REGIONS[0]),
            ("text", RESERVED_REGIONS[1]),
        ):
            start = contract.index(f"  {region_name}: {{" )
            end = contract.index("  },", start)
            region_lines = contract[start:end].splitlines()
            values = []
            for key in ("xMm", "yMm", "widthMm", "heightMm"):
                line = next(
                    line.strip()
                    for line in region_lines
                    if line.strip().startswith(f"{key}: ")
                )
                values.append(float(line.split(": ", 1)[1].rstrip(",")))
            self.assertEqual(tuple(values), expected, region_name)

    def test_reserved_margin_does_not_overlap_upper_sky(self):
        self.assertLess(
            SKY_CENTER_Y_MM + SKY_RADIUS_MM + RESERVED_MARGIN_MM,
            RESERVED_REGIONS[0][1],
        )


if __name__ == "__main__":
    unittest.main()
