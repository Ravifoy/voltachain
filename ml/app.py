"""VoltaChain ML + report-storage API (FastAPI). Run: uvicorn app:app --port 8000"""
import json
import os
import re
from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from train import FEATURES

BASE = Path(__file__).parent
REPORTS_FILE = BASE / "data" / "reports.json"   # simple "database": {reportHash: reportJSON}
REPORTS_FILE.parent.mkdir(exist_ok=True)

app = FastAPI(title="VoltaChain ML API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

if not (BASE / "model.joblib").exists():
    raise SystemExit("model.joblib missing - run `python train.py` first")
model = joblib.load(BASE / "model.joblib")


class Readings(BaseModel):
    cycle_count: float = Field(ge=0)
    age_months: float = Field(ge=0)
    internal_resistance: float = Field(gt=0, description="milli-ohm")
    avg_temperature: float
    measured_capacity: float = Field(gt=0, description="mAh")
    nominal_capacity: float = Field(gt=0, description="mAh")


def grade_for(soh: float) -> str:
    if soh >= 85: return "A"
    if soh >= 70: return "B"
    if soh >= 50: return "C"
    return "D"


def explain(grade: str, r: Readings, soh: float) -> str:
    """One plain-English line: grade meaning + the main reason."""
    meaning = {
        "A": "excellent capacity left",
        "B": "good capacity left",
        "C": "usable but noticeably worn",
        "D": "very little life left - best sent for recycling",
    }[grade]
    concerns = []
    if r.cycle_count > 600: concerns.append("high cycle count")
    if r.age_months > 30: concerns.append("old age")
    if r.avg_temperature > 35: concerns.append("it ran hot")
    if r.internal_resistance > 65: concerns.append("high internal resistance")
    if concerns:
        return f"Grade {grade}: {meaning}, but {' and '.join(concerns[:2])}."
    return f"Grade {grade}: {meaning}, with low wear on all indicators."


@app.post("/predict")
def predict(r: Readings):
    soh = float(model.predict(pd.DataFrame([r.model_dump()])[FEATURES])[0])
    soh = round(min(max(soh, 0), 100), 1)
    grade = grade_for(soh)
    # Simple formula: assume ~0.6 SoH points lost per month; usable until 50%.
    remaining = int(min(120, max(0, (soh - 50) / 0.6)))
    # Price: INR 600 per Ah of nominal capacity, scaled by health squared.
    price = round(r.nominal_capacity / 1000 * 600 * (soh / 100) ** 2 / 10) * 10
    return {"soh_percent": soh, "grade": grade, "remaining_life_months": remaining,
            "suggested_price_inr": max(price, 50), "explanation": explain(grade, r, soh)}


def _load():
    return json.loads(REPORTS_FILE.read_text()) if REPORTS_FILE.exists() else {}


class ReportIn(BaseModel):
    hash: str            # keccak256 computed by the frontend
    report: dict         # the full report JSON that was hashed


@app.post("/reports")
def save_report(body: ReportIn):
    data = _load()
    data[body.hash.lower()] = body.report
    REPORTS_FILE.write_text(json.dumps(data, indent=2))
    return {"saved": True, "hash": body.hash.lower()}


@app.get("/reports/{report_hash}")
def get_report(report_hash: str):
    data = _load()
    if report_hash.lower() not in data:
        raise HTTPException(404, "Report not found")
    return data[report_hash.lower()]


# ---- Battery photos: stored by content hash (the hash is also stored on-chain) ----
IMAGES_DIR = BASE / "data" / "images"
HASH_RE = re.compile(r"^0x[0-9a-fA-F]{64}$")
DATA_URL_RE = re.compile(r"^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$")
MAX_IMAGE_CHARS = 700_000  # ~500 KB; the frontend resizes photos well below this


class ImageIn(BaseModel):
    hash: str   # keccak256 of the data URL string, computed by the frontend
    data: str   # the photo as a data URL


@app.post("/images")
def save_image(body: ImageIn):
    if not HASH_RE.match(body.hash):
        raise HTTPException(400, "Bad hash")
    if len(body.data) > MAX_IMAGE_CHARS or not DATA_URL_RE.match(body.data):
        raise HTTPException(400, "Photo must be a JPEG/PNG/WebP under ~500 KB")
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    (IMAGES_DIR / f"{body.hash.lower()}.txt").write_text(body.data)
    return {"saved": True, "hash": body.hash.lower()}


@app.get("/images/{image_hash}")
def get_image(image_hash: str):
    if not HASH_RE.match(image_hash):
        raise HTTPException(400, "Bad hash")
    p = IMAGES_DIR / f"{image_hash.lower()}.txt"
    if not p.exists():
        raise HTTPException(404, "Photo not found")
    return {"data": p.read_text()}


@app.get("/health")
def health():
    return {"ok": True, "reports": len(_load())}
