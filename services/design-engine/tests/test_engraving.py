"""M6 raster validation and deterministic output regression tests."""
import unittest
from io import BytesIO
from unittest.mock import patch

from PIL import Image

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
                    self.assertEqual(output.getexif(), {})

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


if __name__ == "__main__":
    unittest.main()
