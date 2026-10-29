"""Nominal frame-opening presets and authoritative physical layout.

These dimensions are STANDARD nominal print dimensions, not yet verified supplier
rabbet/mat openings. Frontend and engine contract alignment is checked by CI.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class FrameLayout:
    width_mm: float
    height_mm: float
    margin_mm: float

    @property
    def sky(self) -> tuple[float, float, float, float]:
        return (
            self.margin_mm,
            self.margin_mm,
            round(self.width_mm - 2 * self.margin_mm, 3),
            round(self.height_mm * 0.47 - self.margin_mm, 3),
        )

    @property
    def photo(self) -> tuple[float, float, float, float]:
        return (
            self.margin_mm,
            round(self.height_mm * 0.48, 3),
            round(self.width_mm - 2 * self.margin_mm, 3),
            round(self.height_mm * 0.4, 3),
        )

    @property
    def text(self) -> tuple[float, float, float, float]:
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


def get_layout(frame_preset_id: str) -> FrameLayout:
    try:
        return PRESETS[frame_preset_id]
    except KeyError as exc:
        raise ValueError("Choose a supported frame size.") from exc
