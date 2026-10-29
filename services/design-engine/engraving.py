"""Deterministic, storage-free raster preparation for the M6 engraving preview.

This output is a visual prototype, not material-calibrated laser instructions.
The reserved photo region is 210 x 125 mm; geometry remains canonical elsewhere.
"""
from __future__ import annotations

from io import BytesIO

from PIL import Image, ImageEnhance, ImageFilter, ImageOps, UnidentifiedImageError

PHOTO_WIDTH_MM = 210
PHOTO_HEIGHT_MM = 125
PIXELS_PER_MM = 10
OUTPUT_SIZE_PX = (PHOTO_WIDTH_MM * PIXELS_PER_MM, PHOTO_HEIGHT_MM * PIXELS_PER_MM)
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_SOURCE_PIXELS = 20_000_000
MIN_SOURCE_EDGE_PX = 64
ALLOWED_FORMATS = frozenset({"JPEG", "PNG", "WEBP"})
Image.MAX_IMAGE_PIXELS = MAX_SOURCE_PIXELS


class EngravingInputError(ValueError):
    """Invalid customer image or image dimensions."""


def prepare_engraving_preview(data: bytes) -> bytes:
    """Convert a validated photo into a grayscale, center-cropped PNG.

    The file is processed entirely in memory. EXIF orientation is applied,
    transparent backgrounds are flattened to white, and metadata is stripped.
    The grayscale preview is not a final laser calibration or toolpath.
    """
    if not data:
        raise EngravingInputError("Choose a photo to process.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise EngravingInputError("The photo must be 10 MB or smaller.")

    try:
        with Image.open(BytesIO(data)) as source:
            if source.format not in ALLOWED_FORMATS:
                raise EngravingInputError("Use a JPG, PNG, or WebP photo.")

            width, height = source.size
            if min(width, height) < MIN_SOURCE_EDGE_PX:
                raise EngravingInputError("Choose a photo at least 64 pixels wide and tall.")
            if width * height > MAX_SOURCE_PIXELS:
                raise EngravingInputError("Choose a photo with 20 megapixels or fewer.")

            source.load()
            oriented = ImageOps.exif_transpose(source)
            rgba = oriented.convert("RGBA")
            # White background gives transparent PNGs predictable engraving tones.
            background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
            photo = Image.alpha_composite(background, rgba).convert("RGB")

    except EngravingInputError:
        raise
    except (OSError, ValueError, Image.DecompressionBombError, UnidentifiedImageError) as exc:
        raise EngravingInputError("We could not read this image. Try a different JPG, PNG, or WebP.") from exc

    cropped = ImageOps.fit(
        photo,
        OUTPUT_SIZE_PX,
        method=Image.Resampling.LANCZOS,
        centering=(0.5, 0.5),
    )
    grayscale = ImageOps.grayscale(cropped)
    grayscale = ImageOps.autocontrast(grayscale, cutoff=1)
    grayscale = ImageEnhance.Contrast(grayscale).enhance(1.12)
    grayscale = grayscale.filter(ImageFilter.UnsharpMask(radius=1.3, percent=110, threshold=3))

    buffer = BytesIO()
    grayscale.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()
