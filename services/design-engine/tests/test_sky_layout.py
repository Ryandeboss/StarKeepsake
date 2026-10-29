"""Frame layout and real altitude/azimuth projection regression tests."""
import unittest
from pathlib import Path

from astronomy import _point_in_reserved_region, project_alt_az
from frame_layout import PRESETS, get_layout


class SkyFirstLayoutTests(unittest.TestCase):
    def test_nominal_frame_sizes(self):
        self.assertEqual((get_layout("8x10").width_mm, get_layout("8x10").height_mm), (203.2, 254.0))
        self.assertEqual((get_layout("11x14").width_mm, get_layout("11x14").height_mm), (279.4, 355.6))
        self.assertEqual((get_layout("16x20").width_mm, get_layout("16x20").height_mm), (406.4, 508.0))
        with self.assertRaises(ValueError):
            get_layout("unavailable")

    def test_sky_over_photo_over_text_for_all_presets(self):
        for name, layout in PRESETS.items():
            with self.subTest(preset=name):
                sky, photo, text = layout.sky, layout.photo, layout.text
                self.assertGreater(sky[0], 0)
                self.assertLess(sky[1] + sky[3], photo[1])
                self.assertLess(photo[1] + photo[3], text[1])
                self.assertLessEqual(text[1] + text[3], layout.height_mm)
                self.assertGreater(photo[2] / layout.width_mm, .90)
                self.assertEqual(photo[2], sky[2])

    def test_north_center_east_right_and_horizon_at_bottom(self):
        for layout in PRESETS.values():
            x, y, width, height = layout.sky
            north = project_alt_az(0, 0, layout)
            east = project_alt_az(0, 90, layout)
            west = project_alt_az(0, 270, layout)
            zenith = project_alt_az(90, 0, layout)
            self.assertAlmostEqual(north[0], x + width / 2)
            self.assertAlmostEqual(east[0], x + width * .75 - 1)
            self.assertAlmostEqual(west[0], x + width * .25 + 1)
            self.assertAlmostEqual(north[1], y + height - 2)
            self.assertAlmostEqual(zenith[1], y + 2)

    def test_all_sampled_star_points_in_upper_panel(self):
        for layout in PRESETS.values():
            x, y, width, height = layout.sky
            for altitude in (0, 15, 30, 45, 60, 75, 90):
                for azimuth in range(0, 360, 15):
                    px, py = project_alt_az(altitude, azimuth, layout)
                    with self.subTest(layout=layout, altitude=altitude, azimuth=azimuth):
                        self.assertGreaterEqual(px, x)
                        self.assertLessEqual(px, x + width)
                        self.assertGreaterEqual(py, y)
                        self.assertLessEqual(py, y + height)
                        self.assertFalse(_point_in_reserved_region(px, py, layout))

    def test_typescript_contract_has_matching_nominal_settings(self):
        source = (
            Path(__file__).resolve().parents[3] / "contracts" / "design-spec" / "design-spec.ts"
        ).read_text(encoding="utf-8")
        for id, layout in PRESETS.items():
            self.assertIn(f"id: '{id}'", source)
            self.assertIn(f"widthMm: {layout.width_mm:g}", source)
            self.assertIn(f"heightMm: {layout.height_mm:g}", source)
        for factor in ("0.47", "0.48", "0.4", "0.885", "0.115"):
            self.assertIn(f"heightMm * {factor}", source)


if __name__ == "__main__":
    unittest.main()
