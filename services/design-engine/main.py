from datetime import date, datetime
import json
import os

from starlette.concurrency import run_in_threadpool

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import Literal

from astronomy import AstronomyInputError, generate_star_field
from engraving import EngravingInputError, MAX_UPLOAD_BYTES, prepare_engraving_preview

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
    framePresetId: Literal['8x10', '11x14', '16x20'] = '11x14'


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
            frame_preset_id=request.framePresetId,
        )
    except AstronomyInputError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/engraving/preview")
async def engraving_preview(
    image: UploadFile = File(...),
    framePresetId: Literal['8x10', '11x14', '16x20'] = Form("11x14"),
    fitMode: Literal['contain', 'cover'] = Form("contain"),
    crop: str = Form('{"x":0,"y":0,"width":1,"height":1}'),
) -> Response:
    if image.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=422, detail="Use a JPG, PNG, or WebP photo.")

    try:
        # Read only one byte beyond the advertised maximum; never trust Content-Length.
        payload = await image.read(MAX_UPLOAD_BYTES + 1)
    finally:
        await image.close()

    try:
        parsed_crop = json.loads(crop)
        if not isinstance(parsed_crop, dict):
            raise EngravingInputError("Choose a valid photo crop.")
        output = await run_in_threadpool(
            prepare_engraving_preview, payload,
            frame_preset_id=framePresetId, fit_mode=fitMode, crop=parsed_crop,
        )
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail="Choose a valid photo crop.") from exc
    except EngravingInputError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return Response(
        content=output,
        media_type="image/png",
        headers={"Cache-Control": "no-store"},
    )
