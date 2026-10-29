"""Deterministic raster preview, honoring the selected frame and photo crop.

Output is a proofing preview only, NOT a material-calibrated laser file.
"""
from __future__ import annotations

import math
from io import BytesIO

from PIL import Image, ImageEnhance, ImageFilter, ImageOps, UnidentifiedImageError
from frame_layout import get_layout

PIXELS_PER_MM = 6  # preview only; roughly 152 dpi, not final laser resolution
PHOTO_WIDTH_MM = get_layout("11x14").photo[2]
PHOTO_HEIGHT_MM = get_layout("11x14").photo[3]
OUTPUT_SIZE_PX = (
    round(PHOTO_WIDTH_MM * PIXELS_PER_MM),
    round(PHOTO_HEIGHT_MM * PIXELS_PER_MM),
)
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_SOURCE_PIXELS = 20_000_000
MIN_SOURCE_EDGE_PX = 64
ALLOWED_FORMATS = frozenset({"JPEG", "PNG", "WEBP"})
Image.MAX_IMAGE_PIXELS = MAX_SOURCE_PIXELS


class EngravingInputError(ValueError):
    """Invalid customer image, crop, or dimensions."""


def validate_crop(crop: dict) -> tuple[float, float, float, float]:
    try:
        x, y, width, height = (
            float(crop[key]) for key in ("x", "y", "width", "height")
        )
    except (KeyError, ValueError, TypeError) as exc:
        raise EngravingInputError("Choose a valid photo crop.") from exc

    if not all(math.isfinite(v) for v in (x, y, width, height)):
        raise EngravingInputError("Choose a valid photo crop.")
    if x < 0 or y < 0 or width <= 0 or height <= 0 or x + width > 1.000001 or y + height > 1.000001:
        raise EngravingInputError("Photo crop must fit inside the uploaded image.")
    return x, y, width, height


def prepare_engraving_preview(
    data: bytes,
    *,
    frame_preset_id: str = "11x14",
    fit_mode: str = "contain",
    crop: dict | None = None,
) -> bytes:
    if not data:
        raise EngravingInputError("Choose a photo to process.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise EngravingInputError("The photo must be 10 MB or smaller.")
    try:
        layout = get_layout(frame_preset_id)
    except ValueError as exc:
        raise EngravingInputError(str(exc)) from exc

    if fit_mode not in ("contain", "cover"):
        raise EngravingInputError("Choose a valid photo fitting mode.")

    photo_region = layout.photo
    output_size = (
        round(photo_region[2] * PIXELS_PER_MM),
        round(photo_region[3] * PIXELS_PER_MM),
    )
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
            background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
            photo = Image.alpha_composite(background, rgba).convert("RGB")

    except EngravingInputError:
        raise
    except (OSError, ValueError, Image.DecompressionBombError, UnidentifiedImageError) as exc:
        raise EngravingInputError("We could not read this image. Try a different JPG, PNG, or WebP.") from exc

    if fit_mode == "contain":
        # Show entire image; fill letterboxed space with a consistent light base.
        fitted = ImageOps.contain(photo, output_size, method=Image.Resampling.LANCZOS)
        output = Image.new("RGB", output_size, (245, 242, 233))
        output.paste(fitted, ((output_size[0] - fitted.width) // 2, (output_size[1] - fitted.height) // 2))
    else:
        if crop is None:
            raise EngravingInputError("Choose a crop before using fill mode.")
        x, y, w, h = validate_crop(crop)
        source_w, source_h = photo.size
        source_ratio = (w * source_w) / (h * source_h)
        target_ratio = output_size[0] / output_size[1]
        if abs(source_ratio / target_ratio - 1) > 0.025:
            raise EngravingInputError("Photo crop does not match the chosen frame ratio.")
        bounds = (
            round(x * source_w),
            round(y * source_h),
            round((x + w) * source_w),
            round((y + h) * source_h),
        )
        if bounds[2] <= bounds[0] or bounds[3] <= bounds[1]:
            raise EngravingInputError("Photo crop is too small.")
        output = photo.crop(bounds).resize(output_size, resample=Image.Resampling.LANCZOS)

    grayscale = ImageOps.grayscale(output)
    grayscale = ImageOps.autocontrast(grayscale, cutoff=1)
    grayscale = ImageEnhance.Contrast(grayscale).enhance(1.12)
    grayscale = grayscale.filter(ImageFilter.UnsharpMask(radius=1.3, percent=110, threshold=3))

    buffer = BytesIO()
    grayscale.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()
