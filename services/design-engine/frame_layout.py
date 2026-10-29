"""Nominal frame-opening presets and authoritative physical layout.

These dimensions are STANDARD nominal print dimensions, not yet verified supplier
rabbet/mat openings. Frontend and engine contract alignment is checked by CI.
"""
from dataclasses import dataclass
import math


@dataclass(frozen=True)
class FrameLayout:
    width_mm: float
    height_mm: float
    margin_mm: float
    photo_aspect_ratio: float | None = None

    def _auto_parts(self) -> tuple[float, float, float, float]:
        ratio = self.photo_aspect_ratio
        assert ratio is not None
        photo_height = 267.4 / ratio
        sky_height = min(180.0, max(76.0, photo_height * 0.56))
        text_height = min(45.0, max(27.0, photo_height * 0.18))
        return photo_height, sky_height, text_height, self.width_mm / 279.4

    @property
    def sky(self) -> tuple[float, float, float, float]:
        if self.photo_aspect_ratio is not None:
            _, sky_height, _, scale = self._auto_parts()
            return (self.margin_mm, self.margin_mm, round(self.width_mm - 2*self.margin_mm, 3), round(sky_height * scale, 3))
        return (
            self.margin_mm,
            self.margin_mm,
            round(self.width_mm - 2 * self.margin_mm, 3),
            round(self.height_mm * 0.47 - self.margin_mm, 3),
        )

    @property
    def photo(self) -> tuple[float, float, float, float]:
        if self.photo_aspect_ratio is not None:
            photo_height, sky_height, _, scale = self._auto_parts()
            return (self.margin_mm, round((6 + sky_height + 8) * scale, 3), round(267.4 * scale, 3), round(photo_height * scale, 3))
        return (
            self.margin_mm,
            round(self.height_mm * 0.48, 3),
            round(self.width_mm - 2 * self.margin_mm, 3),
            round(self.height_mm * 0.4, 3),
        )

    @property
    def text(self) -> tuple[float, float, float, float]:
        photo_height, sky_height, text_height, scale = self._auto_parts() if self.photo_aspect_ratio is not None else (0, 0, 0, 0)
        if self.photo_aspect_ratio is not None:
            return (self.margin_mm, round((6 + sky_height + 8 + photo_height + 8) * scale, 3), round(267.4 * scale, 3), round(text_height * scale, 3))
        return (
            self.margin_mm,
            round(self.height_mm * 0.885, 3),
            round(self.width_mm - 2 * self.margin_mm, 3),
            round(self.height_mm * 0.115 - self.margin_mm, 3),
        )


PRESETS: dict[str, FrameLayout] = {
    "8x10": FrameLayout(203.2, 254.0, 5.0),
    "11x14": FrameLayout(279.4, 355.6, 6.0),
    "16x20": FrameLayout(406.4, 508.0, 8.0),
}


def get_layout(frame_preset_id: str, photo_aspect_ratio: float | None = None) -> FrameLayout:
    if frame_preset_id == 'auto':
        if photo_aspect_ratio is None or not math.isfinite(photo_aspect_ratio) or not 0.35 <= photo_aspect_ratio <= 3.0:
            raise ValueError('Choose a photo to determine a custom frame ratio (0.35–3.0).')
        photo_height = 267.4 / photo_aspect_ratio
        sky_height = min(180.0, max(76.0, photo_height * 0.56))
        text_height = min(45.0, max(27.0, photo_height * 0.18))
        natural_height = 12 + sky_height + photo_height + text_height + 16
        scale = min(1.0, 508 / natural_height)
        return FrameLayout(round(279.4 * scale, 3), round(natural_height * scale, 3), round(6 * scale, 3), photo_aspect_ratio)
    try:
        return PRESETS[frame_preset_id]
    except KeyError as exc:
        raise ValueError("Choose a supported frame size.") from exc
