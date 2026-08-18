"""
Dynamic Power Capping Controller
Watches for new pod scheduling events and applies power limits per job priority.
In simulation mode: calls the GPU Simulator's /power/throttle endpoint.
In real mode: calls NVML directly.

Power Policy:
  CRITICAL   → 100% TDP  (400 W)
  INTERACTIVE → 80% TDP  (320 W)
  BATCH       → 60% TDP  (240 W)
  IDLE_WARMTH → 30% TDP  (120 W)
"""

import os
import sys
import time
import logging
import threading
from typing import Dict, Optional
import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s [POWER] %(message)s")
log = logging.getLogger(__name__)

SIMULATOR_URL  = os.getenv("SIMULATOR_URL", "http://localhost:8001")
USE_REAL_GPU   = os.getenv("USE_REAL_GPU", "false").lower() == "true"
MAX_TDP_WATTS  = float(os.getenv("MAX_TDP_WATTS", "400.0"))
POLL_INTERVAL  = int(os.getenv("POLL_INTERVAL", "5"))

# Power limits as fraction of TDP
POWER_POLICY: Dict[str, float] = {
    "CRITICAL":     1.00,
    "INTERACTIVE":  0.80,
    "BATCH":        0.60,
    "IDLE_WARMTH":  0.30,
}

# Energy tracking per job: {job_id: {start, watts_readings}}
_energy_ledger: Dict[str, dict] = {}
_ledger_lock = threading.Lock()

# ──────────────────────────────────────────────
# Power Cap Backends
# ──────────────────────────────────────────────

def set_power_cap_simulated(gpu_key: str, watts: float):
    gpu_key_enc = gpu_key.replace(":", "__")
    try:
        resp = requests.post(
            f"{SIMULATOR_URL}/power/throttle/{gpu_key_enc}",
            json={"watts": watts},
            timeout=3,
        )
        resp.raise_for_status()
        log.info("Throttle OK  gpu=%s → %.0fW", gpu_key, watts)
    except Exception as e:
        log.error("Throttle FAIL gpu=%s: %s", gpu_key, e)


def set_power_cap_real(gpu_index: int, watts: float):
    try:
        import pynvml
        pynvml.nvmlInit()
        handle = pynvml.nvmlDeviceGetHandleByIndex(gpu_index)
        pynvml.nvmlDeviceSetPowerManagementLimit(handle, int(watts * 1000))
        log.info("NVML throttle gpu=%d → %.0fW", gpu_index, watts)
    except Exception as e:
        log.error("NVML throttle FAIL gpu=%d: %s", gpu_index, e)


def apply_power_policy(gpu_key: str, priority: str, gpu_index: int = 0):
    fraction = POWER_POLICY.get(priority, 0.6)
    watts = MAX_TDP_WATTS * fraction
    if USE_REAL_GPU:
        set_power_cap_real(gpu_index, watts)
    else:
        set_power_cap_simulated(gpu_key, watts)
    return watts


# ──────────────────────────────────────────────
# Energy Tracking
# ──────────────────────────────────────────────

def start_energy_tracking(job_id: str, initial_watts: float):
    with _ledger_lock:
        _energy_ledger[job_id] = {
            "start_time":    time.time(),
            "last_time":     time.time(),
            "energy_joules": 0.0,
            "applied_watts":   initial_watts,
            "readings":      [initial_watts],
        }

def record_energy_sample(job_id: str, watts: float):
    with _ledger_lock:
        if job_id not in _energy_ledger:
            return
        entry = _energy_ledger[job_id]
        now  = time.time()
        dt   = now - entry["last_time"]
        entry["energy_joules"] += watts * dt   # Joules = Watts × seconds
        entry["last_time"]  = now
        entry["readings"].append(watts)

def finish_energy_tracking(job_id: str) -> Optional[dict]:
    with _ledger_lock:
        entry = _energy_ledger.pop(job_id, None)
    if not entry:
        return None

    duration_s    = time.time() - entry["start_time"]
    applied_watts = entry.get("applied_watts", MAX_TDP_WATTS)   # ← use stored watts

    # Deterministic energy: policy-applied watts × actual wall-clock duration
    energy_wh   = round((applied_watts  * duration_s) / 3600.0, 3)
    baseline_wh = round((MAX_TDP_WATTS  * duration_s) / 3600.0, 3)
    saved_wh    = round(max(0.0, baseline_wh - energy_wh), 3)
    saving_pct  = round((saved_wh / baseline_wh * 100.0) if baseline_wh > 0 else 0.0, 1)

    result = {
        "job_id":      job_id,
        "duration_s":  round(duration_s, 1),
        "energy_wh":   energy_wh,
        "baseline_wh": baseline_wh,
        "saved_wh":    saved_wh,
        "saving_pct":  saving_pct,
        "avg_watts":   applied_watts,
    }
    log.info("[ENERGY] %s", result)
    return result


# ──────────────────────────────────────────────
# FastAPI REST Interface
# ──────────────────────────────────────────────

from fastapi import FastAPI
import uvicorn


# --- Background Energy Sampler ---
# Calls record_energy_sample every POLL_INTERVAL
# seconds for all active jobs in _jobs_state
def _energy_sampling_loop():
    while True:
        time.sleep(POLL_INTERVAL)
        with _ledger_lock:
            active = list(_jobs_state.items())
        for job_id, state in active:
            record_energy_sample(job_id, state["watts"])

_sampler_thread = threading.Thread(target=_energy_sampling_loop, daemon=True)
_sampler_thread.start()

app = FastAPI(title="AERO Power Controller", version="1.0")

_jobs_state: Dict[str, dict] = {}   # job_id → {gpu_key, priority, watts, start}

@app.post("/power/apply")
def apply_power(payload: dict):
    """Called when a job is placed. Applies the correct power cap."""
    job_id   = payload["job_id"]
    gpu_key  = payload.get("gpu_key", "node-1:0")
    priority = payload.get("priority", "BATCH")
    watts = apply_power_policy(gpu_key, priority)
    start_energy_tracking(job_id, watts)
    _jobs_state[job_id] = {
        "gpu_key":  gpu_key,
        "priority": priority,
        "watts":    watts,
        "start":    time.time(),
    }
    return {"job_id": job_id, "applied_watts": watts, "priority": priority}


@app.post("/power/release")
def release_power(payload: dict):
    """Called when a job finishes. Restores full TDP and records energy."""
    job_id = payload["job_id"]
    state  = _jobs_state.pop(job_id, {})
    gpu_key = state.get("gpu_key", "node-1:0")

    # Restore full TDP
    set_power_cap_simulated(gpu_key, MAX_TDP_WATTS)
    summary = finish_energy_tracking(job_id)
    return {"job_id": job_id, "energy_summary": summary}


@app.post("/power/throttle/{gpu_key_enc}")
def manual_throttle(gpu_key_enc: str, payload: dict):
    """Manual throttle for demo purposes."""
    gpu_key = gpu_key_enc.replace("__", ":")
    watts   = float(payload.get("watts", 240.0))
    set_power_cap_simulated(gpu_key, watts)
    return {"gpu_key": gpu_key, "new_limit_watts": watts}


@app.get("/energy/summary")
def energy_summary():
    return {"active_jobs": list(_jobs_state.keys()), "ledger_size": len(_energy_ledger)}


@app.get("/health")
def health():
    return {"status": "ok", "service": "aero-power-controller"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8003)
