"""
AERO Public API Gateway
Single entry point for the frontend dashboard.
Proxies and aggregates data from: simulator, telemetry daemon,
forecaster, power controller. Also manages job submission and
energy reporting.

All endpoints listed in the PS32 Backend API Design.
"""

import os
import time
import uuid
import logging
from typing import List, Optional
from collections import defaultdict

import httpx
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

logging.basicConfig(level=logging.INFO, format="%(asctime)s [API] %(message)s")
log = logging.getLogger(__name__)

SIMULATOR_URL   = os.getenv("SIMULATOR_URL",   "http://localhost:8001")
FORECASTER_URL  = os.getenv("FORECASTER_URL",  "http://localhost:8002")
POWER_URL       = os.getenv("POWER_URL",        "http://localhost:8003")
EXTENDER_URL    = os.getenv("EXTENDER_URL",     "http://localhost:8080")

app = FastAPI(title="AERO API Gateway", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────
# In-memory Job Store
# ──────────────────────────────────────────────

_jobs: dict = {}           # job_id → job record
_energy_log: list = []     # completed job energy records

# ──────────────────────────────────────────────
# Pydantic Models
# ──────────────────────────────────────────────

class JobSubmission(BaseModel):
    name: str
    workload_type: str = "COMPUTE_BOUND"   # COMPUTE_BOUND | MEMORY_BOUND | MIXED
    priority: str = "BATCH"               # CRITICAL | INTERACTIVE | BATCH
    tenant: str = "default"
    gpu_util_target: float = 70.0
    memory_util_target: float = 30.0
    power_target_watts: float = 280.0
    duration_seconds: float = 120.0
    preferred_gpu: Optional[str] = None    # e.g. "node-1:0"


class ThrottleRequest(BaseModel):
    watts: float


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

async def _get(url: str) -> dict:
    async with httpx.AsyncClient(timeout=5.0) as c:
        r = await c.get(url)
        r.raise_for_status()
        return r.json()

async def _post(url: str, payload: dict) -> dict:
    async with httpx.AsyncClient(timeout=5.0) as c:
        r = await c.post(url, json=payload)
        r.raise_for_status()
        return r.json()


def _power_policy_watts(priority: str, max_tdp: float = 400.0) -> float:
    return {"CRITICAL": 1.0, "INTERACTIVE": 0.8, "BATCH": 0.6}.get(priority, 0.6) * max_tdp


# ──────────────────────────────────────────────
# API Endpoints — cluster
# ──────────────────────────────────────────────

@app.get("/cluster/nodes")
async def get_nodes():
    """All nodes with aggregated GPU metrics."""
    gpus = (await _get(f"{SIMULATOR_URL}/gpus")).get("gpus", [])
    nodes: dict = defaultdict(lambda: {"node_id": "", "gpus": [], "total_power_w": 0})
    for g in gpus:
        nid = g["node_id"]
        nodes[nid]["node_id"] = nid
        nodes[nid]["gpus"].append(g)
        nodes[nid]["total_power_w"] += g.get("power_draw_watts", 0)
    return {"nodes": list(nodes.values())}


@app.get("/cluster/gpus")
async def get_gpus():
    """All GPUs with utilisation, power, and workload type."""
    return await _get(f"{SIMULATOR_URL}/gpus")


# ──────────────────────────────────────────────
# API Endpoints — jobs
# ──────────────────────────────────────────────

@app.get("/jobs/queue")
def get_job_queue():
    """Pending + running jobs."""
    return {
        "jobs": [
            {
                "job_id":        jid,
                "name":          j["name"],
                "status":        j["status"],
                "priority":      j["priority"],
                "workload_type": j["workload_type"],
                "tenant":        j["tenant"],
                "gpu_key":       j.get("gpu_key"),
                "submitted_at":  j["submitted_at"],
                "power_cap_w":   j.get("power_cap_w"),
            }
            for jid, j in _jobs.items()
            if j["status"] in ("PENDING", "RUNNING")
        ]
    }


@app.post("/jobs/submit")
async def submit_job(job: JobSubmission, bg: BackgroundTasks):
    """
    Submit a job.
    1. Pick target GPU (simplistic: first available, or preferred)
    2. Submit to simulator
    3. Apply power cap
    4. Register in job store
    """
    job_id   = f"{job.name}-{uuid.uuid4().hex[:8]}"
    gpu_key  = job.preferred_gpu or "node-1:0"
    power_w  = _power_policy_watts(job.priority)

    # Submit to simulator
    sim_payload = {
        "job_id":              job_id,
        "workload_type":       job.workload_type,
        "priority":            job.priority,
        "gpu_util_target":     job.gpu_util_target,
        "memory_util_target":  job.memory_util_target,
        "power_target_watts":  job.power_target_watts,
        "duration_seconds":    job.duration_seconds,
        "gpu_key":             gpu_key,
    }
    try:
        await _post(f"{SIMULATOR_URL}/jobs/submit", sim_payload)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Simulator error: {e}")

    # Apply power cap
    try:
        await _post(f"{POWER_URL}/power/apply", {
            "job_id":   job_id,
            "gpu_key":  gpu_key,
            "priority": job.priority,
        })
    except Exception as e:
        log.warning("Power controller unreachable: %s", e)

    _jobs[job_id] = {
        "name":          job.name,
        "status":        "RUNNING",
        "priority":      job.priority,
        "workload_type": job.workload_type,
        "tenant":        job.tenant,
        "gpu_key":       gpu_key,
        "submitted_at":  time.time(),
        "duration_s":    job.duration_seconds,
        "power_cap_w":   power_w,
    }

    # Schedule automatic completion
    bg.add_task(_auto_complete_job, job_id, job.duration_seconds)

    return {
        "job_id":    job_id,
        "gpu_key":   gpu_key,
        "power_cap": power_w,
        "status":    "RUNNING",
    }


async def _auto_complete_job(job_id: str, duration: float):
    import asyncio
    await asyncio.sleep(duration)
    if job_id in _jobs:
        _jobs[job_id]["status"] = "COMPLETED"
        try:
            summary = await _post(f"{POWER_URL}/power/release", {"job_id": job_id})
            _energy_log.append(summary.get("energy_summary", {}))
        except Exception:
            pass
        log.info("Job %s completed", job_id)


# ──────────────────────────────────────────────
# API Endpoints — forecaster
# ──────────────────────────────────────────────

@app.get("/forecast")
async def get_forecast():
    """ML forecaster output for next window."""
    try:
        gpus = (await _get(f"{SIMULATOR_URL}/gpus")).get("gpus", [])
        avg_util  = sum(g["gpu_util"] for g in gpus) / max(len(gpus), 1)
        queue_len = sum(
            len(g.get("running_jobs", [])) for g in gpus
        )
        demand = avg_util / 100.0 * 8.0

        url = (
            f"{FORECASTER_URL}/forecast"
            f"?gpu_utilization={avg_util:.1f}"
            f"&queue_depth={queue_len}"
            f"&gpu_demand={demand:.2f}"
            f"&gpu_util_roll15={avg_util:.1f}"
            f"&gpu_util_roll60={avg_util:.1f}"
            f"&demand_roll15={demand:.2f}"
        )
        return await _get(url)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


# ──────────────────────────────────────────────
# API Endpoints — energy
# ──────────────────────────────────────────────

@app.get("/energy/summary")
async def energy_summary():
    """Energy consumed per job, with savings vs baseline."""
    gpus = (await _get(f"{SIMULATOR_URL}/gpus")).get("gpus", [])
    current_total_w = sum(g.get("power_draw_watts", 0) for g in gpus)
    baseline_total_w = len(gpus) * 400.0   # Full TDP per GPU

    total_aero_wh = sum(e.get("energy_wh", 0) for e in _energy_log)
    total_base_wh = sum(e.get("baseline_wh", 0) for e in _energy_log)
    total_saved_wh = sum(e.get("saved_wh", 0) for e in _energy_log)
    savings_pct = (total_saved_wh / total_base_wh * 100.0) if total_base_wh > 0 else 0.0

    return {
        "current_cluster_power_w": round(current_total_w, 1),
        "baseline_cluster_power_w": round(baseline_total_w, 1),
        "live_savings_pct": round((1 - current_total_w / max(baseline_total_w, 1)) * 100, 1),
        "total_aero_wh": round(total_aero_wh, 3),
        "total_baseline_wh": round(total_base_wh, 3),
        "total_saved_wh": round(total_saved_wh, 3),
        "cumulative_savings_pct": round(savings_pct, 1),
        "completed_jobs": _energy_log[-20:],
    }


# ──────────────────────────────────────────────
# API Endpoints — scheduler extender (pass-through)
# ──────────────────────────────────────────────

@app.post("/scheduler/filter")
async def scheduler_filter(request_body: dict):
    return await _post(f"{EXTENDER_URL}/filter", request_body)

@app.post("/scheduler/score")
async def scheduler_score(request_body: dict):
    return await _post(f"{EXTENDER_URL}/score", request_body)

@app.post("/power/throttle/{gpu_id}")
async def power_throttle(gpu_id: str, body: ThrottleRequest):
    gpu_key_enc = gpu_id.replace(":", "__")
    return await _post(
        f"{SIMULATOR_URL}/power/throttle/{gpu_key_enc}",
        {"watts": body.watts}
    )

@app.get("/metrics")
async def prometheus_metrics():
    """Redirect to Prometheus. Placeholder for scrape endpoint."""
    return {"info": "Prometheus metrics at http://localhost:9091/metrics (simulator) and :9090 (daemon)"}

@app.get("/health")
def health():
    return {"status": "ok", "service": "aero-api-gateway"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
