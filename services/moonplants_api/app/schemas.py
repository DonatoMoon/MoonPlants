from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class PredictRequest(BaseModel):
    plant_id: str                           # UUID рослини (з Supabase plants.id)
    reference_time: Optional[datetime] = None  # UTC, defaults to now


class PredictResponse(BaseModel):
    plant_id: str
    timestamp: str
    current_moisture: float                 # 0.0–1.0
    time_to_water_hours: float
    recommended_ml: float
    confidence: str                         # "high" | "medium" | "low"
    trajectory_hours: Optional[float]
    tte_pred_hours: float
    low_threshold: float
    high_target: float
    rationale: str


class HealthResponse(BaseModel):
    status: str
    models_loaded: bool
