import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, Security
from fastapi.security.api_key import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_client import Gauge, Counter

from app.schemas import PredictRequest, PredictResponse, HealthResponse
from app.predictor import Predictor

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s — %(message)s")

predictor = Predictor()
API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=True)

# Custom Prometheus Metrics
PREDICTION_CONFIDENCE = Gauge(
    "moonplants_ml_prediction_confidence",
    "Confidence score of the specific ML prediction",
    ["confidence_level"]
)
PREDICTION_WATER_ML = Gauge(
    "moonplants_ml_recommended_water_ml",
    "Recommended water amount in ml"
)

def verify_api_key(api_key: str = Security(API_KEY_HEADER)):
    expected = os.environ.get("API_SECRET_KEY", "")
    if not expected or api_key != expected:
        raise HTTPException(status_code=401, detail="Invalid API key")


@asynccontextmanager
async def lifespan(app: FastAPI):
    predictor.load(
        supabase_url=os.environ["SUPABASE_URL"],
        supabase_key=os.environ["SUPABASE_SERVICE_KEY"],
    )
    yield


app = FastAPI(
    title="MoonPlants ML API",
    version="1.0.0",
    lifespan=lifespan,
)

# Instrument the FastAPI app for Prometheus
# expose(app) викликається одразу — НЕ в on_event (несумісно з lifespan)
instrumentator = Instrumentator(
    should_group_status_codes=False,
    should_ignore_untemplated=True,
    should_instrument_requests_inprogress=True,
    excluded_handlers=[".*admin.*", "/metrics"],
    inprogress_name="inprogress",
    inprogress_labels=True,
).instrument(app).expose(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://*.vercel.app", "http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(status="ok", models_loaded=predictor._loaded)


@app.post("/api/v1/predict", response_model=PredictResponse)
def predict(request: PredictRequest, _=Depends(verify_api_key)):
    try:
        result = predictor.predict(
            plant_uuid=request.plant_id,
            reference_time=request.reference_time,
        )

        # Log custom metrics
        conf_level = result.get("confidence", "unknown")
        PREDICTION_CONFIDENCE.labels(confidence_level=conf_level).set(
            1.0 if conf_level == "high" else (0.5 if conf_level == "medium" else 0.1)
        )
        PREDICTION_WATER_ML.set(result.get("recommended_ml", 0))

        return PredictResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")
