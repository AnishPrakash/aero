"""
XGBoost Demand Forecaster Training Script.
Trains on 6 days of synthetic telemetry, validates on day 7.
Saves model to forecaster/models/demand_forecaster.joblib
"""

import os
import pandas as pd
import numpy as np
import joblib
from xgboost import XGBRegressor
from sklearn.metrics import mean_absolute_error, r2_score

os.makedirs("models", exist_ok=True)
os.makedirs("data", exist_ok=True)

FEATURE_COLS = [
    "hour_sin", "hour_cos",
    "dow_sin", "dow_cos",
    "is_weekday",
    "gpu_utilization",
    "queue_depth",
    "gpu_demand",
]
TARGET_COL = "gpu_demand_next_15m"

def load_data() -> pd.DataFrame:
    path = "data/synthetic_telemetry.csv"
    if not os.path.exists(path):
        from data_generator import generate_dataset
        df = generate_dataset(days=7)
        df.to_csv(path, index=False)
    return pd.read_csv(path, parse_dates=["timestamp"])

def rolling_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add rolling mean features (15-min, 60-min) for utilisation and demand."""
    df = df.copy()
    df["gpu_util_roll15"] = df["gpu_utilization"].rolling(3, min_periods=1).mean()
    df["gpu_util_roll60"] = df["gpu_utilization"].rolling(12, min_periods=1).mean()
    df["demand_roll15"]   = df["gpu_demand"].rolling(3, min_periods=1).mean()
    return df

def train():
    df = load_data()
    df = rolling_features(df)

    extended_features = FEATURE_COLS + ["gpu_util_roll15", "gpu_util_roll60", "demand_roll15"]

    # Train on first 6 days, validate on day 7
    split_ts = df["timestamp"].min() + pd.Timedelta(days=6)
    train_df = df[df["timestamp"] < split_ts]
    val_df   = df[df["timestamp"] >= split_ts]

    X_train = train_df[extended_features]
    y_train = train_df[TARGET_COL]
    X_val   = val_df[extended_features]
    y_val   = val_df[TARGET_COL]

    model = XGBRegressor(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_alpha=0.1,
        reg_lambda=1.0,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=False,
    )

    preds = model.predict(X_val)
    mae = mean_absolute_error(y_val, preds)
    r2  = r2_score(y_val, preds)

    print(f"Validation MAE : {mae:.4f} GPU-hours")
    print(f"Validation R²  : {r2:.4f}")

    if mae > 0.5:
        print("WARNING: MAE > 0.5. Consider adding more features or LSTM fallback.")

    joblib.dump({
        "model": model,
        "features": extended_features,
        "mae": mae,
        "r2": r2,
    }, "models/demand_forecaster.joblib")
    print("Model saved to models/demand_forecaster.joblib")

if __name__ == "__main__":
    train()
