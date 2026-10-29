from datetime import date, datetime
import os

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from astronomy import AstronomyInputError, generate_star_field

app = FastAPI(title="StarKeepsake Design Engine")
deployment_commit_sha = os.getenv("DEPLOYMENT_COMMIT_SHA", "unknown")


class AstronomyRequest(BaseModel):
    date: date
    utcDateTime: datetime | None = None
    exactTimeUnknown: bool
    timeZoneId: str = Field(min_length=1, max_length=100)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    magnitudeLimit: float = Field(default=6.0, ge=-2.0, le=6.5)
    maxStars: int = Field(default=96, ge=1, le=200)
    minSeparationMm: float = Field(default=3.5, ge=1.0, le=15.0)


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "service": "design-engine",
        "status": "healthy",
        "commitSha": deployment_commit_sha,
    }


@app.post("/astronomy/stars")
def astronomy_stars(request: AstronomyRequest) -> dict:
    try:
        return generate_star_field(
            selected_date=request.date,
            utc_datetime=request.utcDateTime,
            exact_time_unknown=request.exactTimeUnknown,
            time_zone_id=request.timeZoneId,
            latitude=request.latitude,
            longitude=request.longitude,
            magnitude_limit=request.magnitudeLimit,
            max_stars=request.maxStars,
            min_separation_mm=request.minSeparationMm,
        )
    except AstronomyInputError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
