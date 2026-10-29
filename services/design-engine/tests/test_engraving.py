"""M6 raster validation and deterministic output regression tests."""
import unittest
from io import BytesIO
from unittest.mock import patch

from PIL import Image

from frame_layout import PRESETS
from engraving import (
    EngravingInputError,
    OUTPUT_SIZE_PX,
    prepare_engraving_preview,
)


def image_bytes(mode="RGB", size=(240, 160), fmt="PNG", color=(40, 110, 160)):
    image = Image.new(mode, size, color)
    buffer = BytesIO()
    image.save(buffer, format=fmt)
    return buffer.getvalue()


class EngravingTests(unittest.TestCase):
    def test_jpeg_and_png_output_fixed_grayscale_dimensions(self):
        for fmt in ("PNG", "JPEG", "WEBP"):
            with self.subTest(fmt=fmt):
                data = image_bytes(fmt=fmt)
                result = prepare_engraving_preview(data)
                with Image.open(BytesIO(result)) as output:
                    self.assertEqual(output.format, "PNG")
                    self.assertEqual(output.mode, "L")
                    self.assertEqual(output.size, OUTPUT_SIZE_PX)
                    self.assertEqual(len(output.getexif()), 0)

    def test_same_input_produces_same_output(self):
        data = image_bytes()
        self.assertEqual(prepare_engraving_preview(data), prepare_engraving_preview(data))

    def test_transparent_input_becomes_white(self):
        data = image_bytes(mode="RGBA", color=(0, 0, 0, 0))
        result = prepare_engraving_preview(data)
        with Image.open(BytesIO(result)) as output:
            self.assertEqual(output.getpixel((100, 100)), 255)

    def test_reject_unsupported_format_even_with_photo_extension(self):
        data = image_bytes(fmt="GIF")
        with self.assertRaisesRegex(EngravingInputError, "JPG, PNG, or WebP"):
            prepare_engraving_preview(data)

    def test_reject_corrupt_and_empty_input(self):
        for data in (b"", b"not an image"):
            with self.subTest(data=data), self.assertRaises(EngravingInputError):
                prepare_engraving_preview(data)

    def test_reject_tiny_source(self):
        with self.assertRaisesRegex(EngravingInputError, "64 pixels"):
            prepare_engraving_preview(image_bytes(size=(32, 240)))

    def test_reject_oversized_upload(self):
        with self.assertRaisesRegex(EngravingInputError, "10 MB"):
            prepare_engraving_preview(b"x" * (10 * 1024 * 1024 + 1))

    def test_reject_too_many_pixels(self):
        with patch("engraving.MAX_SOURCE_PIXELS", 100):
            with self.assertRaisesRegex(EngravingInputError, "20 megapixels"):
                prepare_engraving_preview(image_bytes(size=(240, 160)))

    def test_each_frame_outputs_photo_panel_pixels(self):
        data = image_bytes()
        for id, layout in PRESETS.items():
            with self.subTest(frame=id):
                result = prepare_engraving_preview(data, frame_preset_id=id)
                with Image.open(BytesIO(result)) as output:
                    self.assertEqual(output.size, (
                        round(layout.photo[2] * 6),
                        round(layout.photo[3] * 6),
                    ))

    def test_default_contain_keeps_whole_image_with_light_borders(self):
        data = image_bytes(size=(120, 400), color=(20, 20, 20))
        with Image.open(BytesIO(prepare_engraving_preview(data))) as output:
            self.assertGreater(output.getpixel((1, output.height // 2)), 200)
            self.assertLess(output.getpixel((output.width // 2, output.height // 2)), 90)

    def test_cover_uses_user_selected_crop_and_rejects_invalid(self):
        image = Image.new("RGB", (400, 200))
        for x in range(400):
            for y in range(200):
                image.putpixel((x, y), (x // 2, x // 2, x // 2))
        buffer = BytesIO()
        image.save(buffer, format="PNG")
        data = buffer.getvalue()
        # Crop 375x200 proportion (~1.875), matching 11x14 photo panel.
        left_crop = {"x": 0, "y": 0, "width": .9375, "height": 1}
        right_crop = {"x": .0625, "y": 0, "width": .9375, "height": 1}
        left = prepare_engraving_preview(data, fit_mode="cover", crop=left_crop)
        right = prepare_engraving_preview(data, fit_mode="cover", crop=right_crop)
        self.assertNotEqual(left, right)
        for crop in (
            {"x": -.2, "y": 0, "width": .9, "height": 1},
            {"x": 0, "y": 0, "width": 1.1, "height": 1},
            {"x": 0, "y": 0, "width": 1, "height": 0},
        ):
            with self.subTest(crop=crop), self.assertRaises(EngravingInputError):
                prepare_engraving_preview(data, fit_mode="cover", crop=crop)

    def test_cover_requires_crop_not_implicit_center_fit(self):
        with self.assertRaisesRegex(EngravingInputError, "Choose a crop"):
            prepare_engraving_preview(image_bytes(), fit_mode="cover")


if __name__ == "__main__":
    unittest.main()
