"""
Synthetic telemetry generator.
Produces 7 days of realistic GPU cluster usage data with:
  - Morning burst (09:00–11:00): training jobs spike
  - Afternoon steady load (13:00–18:00): mixed workloads
  - Night valley (22:00–06:00): idle / batch only
  - Weekly pattern: Mon–Fri heavier than Sat–Sun
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta

SEED = 42
np.random.seed(SEED)

def daily_load_curve(hour: float, is_weekday: bool) -> float:
    """Returns base GPU demand (0–1) for a given hour."""
    base = 0.1
    if is_weekday:
        # Morning burst
        if 8.5 <= hour <= 11.5:
            base = 0.8 + 0.15 * np.sin(np.pi * (hour - 8.5) / 3.0)
        # Lunch dip
        elif 12 <= hour <= 13:
            base = 0.45
        # Afternoon load
        elif 13 <= hour <= 18:
            base = 0.65 + 0.1 * np.sin(np.pi * (hour - 13) / 5.0)
        # Evening batch
        elif 20 <= hour <= 24:
            base = 0.55
    else:
        # Weekend: lighter, mostly batch
        if 10 <= hour <= 16:
            base = 0.4
        elif 20 <= hour <= 24:
            base = 0.3
    return base

def generate_dataset(days: int = 7, interval_minutes: int = 5) -> pd.DataFrame:
    start = datetime(2026, 8, 10, 0, 0, 0)
    rows = []

    for minute_offset in range(0, days * 24 * 60, interval_minutes):
        ts = start + timedelta(minutes=minute_offset)
        hour = ts.hour + ts.minute / 60.0
        is_weekday = ts.weekday() < 5

        base_load = daily_load_curve(hour, is_weekday)
        noise = np.random.normal(0, 0.04)
        load = float(np.clip(base_load + noise, 0.0, 1.0))

        # GPU demand: 0–8 GPUs (3-node cluster, max 8 usable)
        gpu_demand = load * 8.0 + np.random.normal(0, 0.3)
        gpu_demand = float(np.clip(gpu_demand, 0.0, 8.0))

        # Queue depth: correlated with demand
        queue_depth = int(np.clip(gpu_demand * 1.5 + np.random.poisson(0.5), 0, 20))

        rows.append({
            "timestamp": ts,
            "hour": ts.hour,
            "minute": ts.minute,
            "day_of_week": ts.weekday(),
            "is_weekday": int(is_weekday),
            "hour_sin": np.sin(2 * np.pi * hour / 24),
            "hour_cos": np.cos(2 * np.pi * hour / 24),
            "dow_sin": np.sin(2 * np.pi * ts.weekday() / 7),
            "dow_cos": np.cos(2 * np.pi * ts.weekday() / 7),
            "gpu_utilization": round(load * 100, 2),
            "queue_depth": queue_depth,
            "gpu_demand": round(gpu_demand, 3),           # current
            "gpu_demand_next_15m": None,                  # filled below (label)
        })

    df = pd.DataFrame(rows)

    # Label: demand in next 15-minute window (3 rows ahead)
    steps_ahead = 15 // interval_minutes
    df["gpu_demand_next_15m"] = df["gpu_demand"].shift(-steps_ahead)
    df = df.dropna(subset=["gpu_demand_next_15m"]).reset_index(drop=True)

    return df

if __name__ == "__main__":
    df = generate_dataset(days=7)
    df.to_csv("forecaster/data/synthetic_telemetry.csv", index=False)
    print(f"Generated {len(df)} rows of synthetic telemetry.")
    print(df.head(10))
