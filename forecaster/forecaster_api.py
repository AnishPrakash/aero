"""
Forecaster REST API
GET /forecast → returns predicted GPU demand for next 15-minute window
GET /forecast/history → returns last N predictions
"""

import os
import time
import joblib
import threading
import numpy as np
import pandas as pd
from datetime import datetime, timezone
from collections import deque
from typing import Optional

from fastapi import FastAPI, HTTPException
import uvicorn

MODEL_PATH = os.getenv("MODEL_PATH", "forecaster/models/demand_forecaster.joblib")

app = FastAPI(title="AERO Demand Forecaster", version="1.0")

_artifact = None
_model = None
_features = None
_history: deque = deque(maxlen=100)
_lock = threading.Lock()


def load_model():
    global _artifact, _model, _features
    _artifact = joblib.load(MODEL_PATH)
    _model = _artifact["model"]
    _features = _artifact["features"]


def build_feature_row(
    gpu_utilization: float,
    queue_depth: int,
    gpu_demand: float,
    gpu_util_roll15: float,
    gpu_util_roll60: float,
    demand_roll15: float,
) -> pd.DataFrame:
    now = datetime.now(timezone.utc)
    hour = now.hour + now.minute / 60.0
    dow  = now.weekday()
    row = {
        "hour_sin":        np.sin(2 * np.pi * hour / 24),
        "hour_cos":        np.cos(2 * np.pi * hour / 24),
        "dow_sin":         np.sin(2 * np.pi * dow / 7),
        "dow_cos":         np.cos(2 * np.pi * dow / 7),
        "is_weekday":      int(dow < 5),
        "gpu_utilization": gpu_utilization,
        "queue_depth":     queue_depth,
        "gpu_demand":      gpu_demand,
        "gpu_util_roll15": gpu_util_roll15,
        "gpu_util_roll60": gpu_util_roll60,
        "demand_roll15":   demand_roll15,
    }
    return pd.DataFrame([row])[_features]


def recommend_action(predicted_demand: float) -> str:
    if predicted_demand >= 7.0:
        return "pre-warm 2 nodes immediately"
    if predicted_demand >= 5.0:
        return "pre-warm 1 node"
    if predicted_demand >= 3.0:
        return "standby — monitor queue"
    return "no action needed"


@app.on_event("startup")
def startup():
    load_model()


@app.get("/forecast")
def get_forecast(
    gpu_utilization: float = 50.0,
    queue_depth: int = 2,
    gpu_demand: float = 3.0,
    gpu_util_roll15: float = 50.0,
    gpu_util_roll60: float = 48.0,
    demand_roll15: float = 3.0,
):
    if _model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    X = build_feature_row(
        gpu_utilization=gpu_utilization,
        queue_depth=queue_depth,
        gpu_demand=gpu_demand,
        gpu_util_roll15=gpu_util_roll15,
        gpu_util_roll60=gpu_util_roll60,
        demand_roll15=demand_roll15,
    )
    pred = float(_model.predict(X)[0])
    pred = round(max(0.0, pred), 3)
    confidence = round(min(0.95, max(0.6, _artifact.get("r2", 0.8))), 2)

    now = datetime.now(timezone.utc)
    result = {
        "window_start": now.isoformat(),
        "window_end":   (now.replace(second=0, microsecond=0) + pd.Timedelta(minutes=15)).isoformat(),
        "predicted_gpu_demand": pred,
        "confidence": confidence,
        "recommended_action": recommend_action(pred),
        "model_mae": round(_artifact.get("mae", 0.0), 4),
    }

    with _lock:
        _history.append({"timestamp": now.isoformat(), **result})

    return result


@app.get("/forecast/history")
def forecast_history(n: int = 20):
    with _lock:
        return {"history": list(_history)[-n:]}


@app.get("/forecast/model-info")
def model_info():
    return {
        "features": _features,
        "mae": _artifact.get("mae"),
        "r2": _artifact.get("r2"),
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8002)
