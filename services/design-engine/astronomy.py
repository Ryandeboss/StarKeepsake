from __future__ import annotations

import math
import os
from dataclasses import dataclass
from datetime import UTC, date, datetime, time
from functools import lru_cache
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np
from skyfield.api import Loader, Star, wgs84
from skyfield.data import hipparcos

from frame_layout import FrameLayout, get_layout

DEFAULT_LAYOUT = get_layout("11x14")
ARTWORK_WIDTH_MM = DEFAULT_LAYOUT.width_mm
ARTWORK_HEIGHT_MM = DEFAULT_LAYOUT.height_mm
SKY_REGION = DEFAULT_LAYOUT.sky
RESERVED_REGIONS = (DEFAULT_LAYOUT.photo, DEFAULT_LAYOUT.text)
RESERVED_MARGIN_MM = 2.0
SKY_CENTER_X_MM = SKY_REGION[0] + SKY_REGION[2] / 2
SKY_CENTER_Y_MM = SKY_REGION[1] + SKY_REGION[3] / 2
# Retained compatibility constant for old importers; projection is now rectangular.
SKY_RADIUS_MM = min(SKY_REGION[2], SKY_REGION[3]) / 2
DEFAULT_MAGNITUDE_LIMIT = 6.0
DEFAULT_MAX_STARS = 96
DEFAULT_MIN_SEPARATION_MM = 3.5

DATA_DIR = Path(
    os.getenv(
        "SKYFIELD_DATA_DIR",
        str(Path(__file__).resolve().parent / "data"),
    )
)
loader = Loader(str(DATA_DIR), verbose=False)


class AstronomyInputError(ValueError):
    pass


@dataclass(frozen=True)
class AstronomyMoment:
    utc_datetime: datetime
    time_basis: str


@dataclass(frozen=True)
class CandidateStar:
    hipparcos_id: int
    magnitude: float
    altitude_deg: float
    azimuth_deg: float
    x_mm: float
    y_mm: float


@lru_cache(maxsize=1)
def _timescale():
    return loader.timescale()


@lru_cache(maxsize=1)
def _ephemeris():
    return loader("de440s.bsp")


@lru_cache(maxsize=16)
def _catalog(magnitude_limit: float):
    catalog_path = DATA_DIR / "hip_main.dat"
    if not catalog_path.exists():
        raise RuntimeError(
            "Hipparcos catalog is missing from the design-engine image."
        )

    with catalog_path.open("rb") as catalog_file:
        frame = hipparcos.load_dataframe(catalog_file)

    frame = frame[
        frame["ra_degrees"].notnull()
        & frame["dec_degrees"].notnull()
        & frame["magnitude"].notnull()
        & (frame["magnitude"] <= magnitude_limit)
    ].copy()

    frame.sort_values(["magnitude"], inplace=True, kind="stable")
    return frame, Star.from_dataframe(frame)


def resolve_astronomy_moment(
    selected_date: date,
    utc_datetime: datetime | None,
    exact_time_unknown: bool,
    time_zone_id: str,
) -> AstronomyMoment:
    if utc_datetime is not None:
        if utc_datetime.tzinfo is None:
            raise AstronomyInputError("utcDateTime must include a UTC offset.")

        return AstronomyMoment(
            utc_datetime=utc_datetime.astimezone(UTC),
            time_basis="exact",
        )

    if not exact_time_unknown:
        raise AstronomyInputError(
            "An exact UTC time is required when exactTimeUnknown is false."
        )

    try:
        zone = ZoneInfo(time_zone_id)
    except Exception as exc:
        raise AstronomyInputError("The supplied time zone is not available.") from exc

    local_midnight = datetime.combine(selected_date, time.min, tzinfo=zone)
    return AstronomyMoment(
        utc_datetime=local_midnight.astimezone(UTC),
        time_basis="date-only-local-midnight",
    )


def project_alt_az(
    altitude_deg: float,
    azimuth_deg: float,
    layout: FrameLayout = DEFAULT_LAYOUT,
) -> tuple[float, float]:
    """Plot true altitude and azimuth into a rectangular horizon-to-zenith map.

    North is centered (azimuth 0/360), east to the right, west to the left.
    The horizon is a horizontal line at the bottom of the sky panel. This is
    an azimuth-altitude equirectangular projection, not a perspective photo.
    """
    x, y, width, height = layout.sky
    inset = 2.0
    wrapped_azimuth = ((azimuth_deg + 180.0) % 360.0) / 360.0
    return (
        x + inset + wrapped_azimuth * (width - inset * 2),
        y + inset + (90.0 - altitude_deg) / 90.0 * (height - inset * 2),
    )


def _point_in_reserved_region(
    x_mm: float, y_mm: float, layout: FrameLayout = DEFAULT_LAYOUT
) -> bool:
    for x, y, width, height in (layout.photo, layout.text):
        if (
            x - RESERVED_MARGIN_MM <= x_mm <= x + width + RESERVED_MARGIN_MM
            and y - RESERVED_MARGIN_MM <= y_mm <= y + height + RESERVED_MARGIN_MM
        ):
            return True
    return False


def _far_enough_from_selected(
    candidate: CandidateStar,
    selected: list[CandidateStar],
    minimum_distance_mm: float,
) -> bool:
    minimum_distance_squared = minimum_distance_mm * minimum_distance_mm
    return all(
        (candidate.x_mm - other.x_mm) ** 2
        + (candidate.y_mm - other.y_mm) ** 2
        >= minimum_distance_squared
        for other in selected
    )


def hole_size_mm(magnitude: float) -> float:
    if magnitude <= 0:
        return 1.8
    if magnitude <= 1:
        return 1.6
    if magnitude <= 2:
        return 1.4
    if magnitude <= 3:
        return 1.2
    if magnitude <= 4:
        return 1.0
    return 0.8


def generate_star_field(
    *,
    selected_date: date,
    utc_datetime: datetime | None,
    exact_time_unknown: bool,
    time_zone_id: str,
    latitude: float,
    longitude: float,
    magnitude_limit: float = DEFAULT_MAGNITUDE_LIMIT,
    max_stars: int = DEFAULT_MAX_STARS,
    min_separation_mm: float = DEFAULT_MIN_SEPARATION_MM,
    frame_preset_id: str = "11x14",
    photo_aspect_ratio: float | None = None,
) -> dict:
    if not -90 <= latitude <= 90:
        raise AstronomyInputError("Latitude must be between -90 and 90 degrees.")
    if not -180 <= longitude <= 180:
        raise AstronomyInputError("Longitude must be between -180 and 180 degrees.")
    if not 1 <= max_stars <= 200:
        raise AstronomyInputError("maxStars must be between 1 and 200.")
    if not -2.0 <= magnitude_limit <= 6.5:
        raise AstronomyInputError("magnitudeLimit must be between -2.0 and 6.5.")
    if not 1.0 <= min_separation_mm <= 15.0:
        raise AstronomyInputError("minSeparationMm must be between 1 and 15 mm.")

    try:
        layout = get_layout(frame_preset_id, photo_aspect_ratio)
    except ValueError as exc:
        raise AstronomyInputError(str(exc)) from exc

    moment = resolve_astronomy_moment(
        selected_date,
        utc_datetime,
        exact_time_unknown,
        time_zone_id,
    )

    if not 1850 <= moment.utc_datetime.year <= 2149:
        raise AstronomyInputError(
            "StarKeepsake astronomy currently supports moments from 1850 through 2149."
        )

    frame, star_vectors = _catalog(round(magnitude_limit, 2))
    planets = _ephemeris()
    earth = planets["earth"]

    observer = earth + wgs84.latlon(latitude_degrees=latitude, longitude_degrees=longitude)
    skyfield_time = _timescale().from_datetime(moment.utc_datetime)

    apparent = observer.at(skyfield_time).observe(star_vectors).apparent()
    altitude, azimuth, _ = apparent.altaz()

    altitude_degrees = np.asarray(altitude.degrees)
    azimuth_degrees = np.asarray(azimuth.degrees)
    magnitudes = frame["magnitude"].to_numpy(dtype=float)
    hipparcos_ids = frame.index.to_numpy(dtype=int)

    visible_mask = np.isfinite(altitude_degrees) & (altitude_degrees >= 0.0)
    visible_catalog_stars = int(np.count_nonzero(visible_mask))

    candidates: list[CandidateStar] = []

    for hip_id, magnitude, altitude_deg, azimuth_deg in zip(
        hipparcos_ids[visible_mask],
        magnitudes[visible_mask],
        altitude_degrees[visible_mask],
        azimuth_degrees[visible_mask],
        strict=True,
    ):
        x_mm, y_mm = project_alt_az(float(altitude_deg), float(azimuth_deg), layout)

        if _point_in_reserved_region(x_mm, y_mm, layout):
            continue

        candidates.append(
            CandidateStar(
                hipparcos_id=int(hip_id),
                magnitude=float(magnitude),
                altitude_deg=float(altitude_deg),
                azimuth_deg=float(azimuth_deg),
                x_mm=x_mm,
                y_mm=y_mm,
            )
        )

    candidates.sort(key=lambda star: (star.magnitude, -star.altitude_deg, star.hipparcos_id))

    selected: list[CandidateStar] = []
    for candidate in candidates:
        if _far_enough_from_selected(candidate, selected, min_separation_mm):
            selected.append(candidate)
            if len(selected) >= max_stars:
                break

    stars = [
        {
            "hipparcosId": star.hipparcos_id,
            "xMm": round(star.x_mm, 3),
            "yMm": round(star.y_mm, 3),
            "magnitude": round(star.magnitude, 3),
            "altitudeDeg": round(star.altitude_deg, 3),
            "azimuthDeg": round(star.azimuth_deg, 3),
            "holeSizeMm": hole_size_mm(star.magnitude),
            "ledIndex": index,
        }
        for index, star in enumerate(selected)
    ]

    return {
        "calculation": {
            "catalog": "hipparcos",
            "ephemeris": "de440s",
            "projection": "altaz-equirectangular",
            "orientation": "north-center-east-right",
            "calculationUtcDateTime": moment.utc_datetime.isoformat().replace("+00:00", "Z"),
            "timeBasis": moment.time_basis,
            "magnitudeLimit": magnitude_limit,
            "maxStars": max_stars,
            "minSeparationMm": min_separation_mm,
            "visibleCatalogStars": visible_catalog_stars,
            "projectedCandidates": len(candidates),
            "selectedStars": len(stars),
        },
        "stars": stars,
    }
