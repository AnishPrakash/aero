"""
AERO Kubernetes Scheduler Extender
Implements the K8s Extender Filter + Score API.
K8s calls /filter to prune impossible nodes, then /score to rank remaining ones.
Also implements /preempt for priority-based eviction recommendations.

Run: uvicorn scheduler.main:app --host 0.0.0.0 --port 8080
"""

import os
import sys
import logging
from typing import List, Optional
import httpx
from fastapi import FastAPI, Request, HTTPException
import uvicorn

# Add parent to path for shared modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scoring.scoring_engine import (
    ScoringEngine, NodeMetrics, IncomingJob, WorkloadClass, JobPriority
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [EXTENDER] %(message)s")
log = logging.getLogger(__name__)

SIMULATOR_URL = os.getenv("SIMULATOR_URL", "http://localhost:8001")
TELEMETRY_URL = os.getenv("TELEMETRY_URL", "http://localhost:8003")

app = FastAPI(title="AERO Scheduler Extender", version="1.0")
engine = ScoringEngine(w_makespan=0.4, w_fairness=0.3, w_energy=0.3)

# ──────────────────────────────────────────────
# Helpers: fetch live cluster state
# ──────────────────────────────────────────────

async def fetch_gpu_snapshot() -> list:
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(f"{SIMULATOR_URL}/gpus")
            return r.json().get("gpus", [])
    except Exception as e:
        log.warning("Could not fetch GPU snapshot: %s", e)
        return []


def gpu_snapshot_to_node_metrics(gpus: list) -> dict:
    """Convert simulator snapshot to NodeMetrics keyed by node name."""
    metrics = {}
    for g in gpus:
        node = g["node_id"]
        wc_str = g.get("workload_type", "IDLE")
        try:
            wc = WorkloadClass(wc_str)
        except ValueError:
            wc = WorkloadClass.IDLE

        metrics[node] = NodeMetrics(
            node_name=node,
            gpu_util=g.get("gpu_util", 0.0),
            memory_util=g.get("memory_util", 0.0),
            power_draw_watts=g.get("power_draw_watts", 50.0),
            power_limit_watts=g.get("power_limit_watts", 400.0),
            power_budget_remaining=max(0.0, 800.0 - g.get("power_draw_watts", 50.0)),
            power_budget_total=800.0,
            workload_class=wc,
            jobs_completed_by_tenant=2,
            total_jobs_completed=10,
        )
    return metrics


def extract_job_from_pod(pod: dict) -> IncomingJob:
    """Extract scheduling metadata from a Kubernetes pod spec."""
    labels = pod.get("metadata", {}).get("labels", {})
    annotations = pod.get("metadata", {}).get("annotations", {})

    wc_str = annotations.get("aero.dev/workload-class", "COMPUTE_BOUND")
    pri_str = labels.get("aero.dev/priority", "BATCH")
    tenant = labels.get("aero.dev/tenant", pod.get("metadata", {}).get("namespace", "default"))

    try:
        wc = WorkloadClass(wc_str)
    except ValueError:
        wc = WorkloadClass.COMPUTE_BOUND

    try:
        priority = JobPriority(pri_str)
    except ValueError:
        priority = JobPriority.BATCH

    return IncomingJob(
        job_id=pod.get("metadata", {}).get("name", "unknown"),
        tenant=tenant,
        priority=priority,
        workload_class=wc,
        tenant_jobs_completed_last_hour=2,
        total_jobs_last_hour=10,
    )


# ──────────────────────────────────────────────
# K8s Extender Endpoints
# ──────────────────────────────────────────────

@app.post("/filter")
async def filter_nodes(request: Request):
    """
    K8s calls this with all feasible nodes.
    We filter out nodes where co-location would be destructive
    (e.g., memory-bound job → node already running memory-bound workload).
    """
    body = await request.json()
    pod   = body.get("Pod", {})
    nodes = body.get("Nodes", {}).get("items", [])

    gpus = await fetch_gpu_snapshot()
    node_metrics = gpu_snapshot_to_node_metrics(gpus)
    job = extract_job_from_pod(pod)

    filtered_nodes = []
    failed_nodes   = {}

    for node in nodes:
        node_name = node.get("metadata", {}).get("name", "")
        nm = node_metrics.get(node_name)

        if nm is None:
            # Unknown node — pass through (conservative)
            filtered_nodes.append(node)
            continue

        cm = engine.colocation_multiplier(nm.workload_class, job.workload_class)
        if cm <= 0.2:
            failed_nodes[node_name] = (
                f"Co-location conflict: existing={nm.workload_class.value} "
                f"incoming={job.workload_class.value} (multiplier={cm})"
            )
            log.info("[FILTER] Rejected %s: %s", node_name, failed_nodes[node_name])
        else:
            filtered_nodes.append(node)

    return {
        "Nodes": {"items": filtered_nodes},
        "FailedNodes": failed_nodes,
        "Error": "",
    }


@app.post("/score")
async def score_nodes(request: Request):
    """
    K8s calls this after filtering. We return a score (0–100) per node.
    K8s picks the highest-scored node.
    """
    body = await request.json()
    pod   = body.get("Pod", {})
    nodes = body.get("Nodes", [])

    gpus = await fetch_gpu_snapshot()
    node_metrics = gpu_snapshot_to_node_metrics(gpus)
    job = extract_job_from_pod(pod)

    node_scores = []
    for node in nodes:
        node_name = node.get("metadata", {}).get("name", "")
        nm = node_metrics.get(node_name)

        if nm is None:
            node_scores.append({"Host": node_name, "Score": 50})
            continue

        decision = engine.score_node(nm, job)
        # K8s expects integer 0–100
        clamped_score = int(min(100, max(0, decision.score)))
        node_scores.append({"Host": node_name, "Score": clamped_score})
        log.info("[SCORE] %s → %d | %s", node_name, clamped_score, decision.rationale)

    return {"HostPriorityList": node_scores, "Error": ""}


@app.post("/preempt")
async def preempt(request: Request):
    """
    For high-priority jobs: suggest which low-priority pod to evict.
    Returns the pod to preempt (or empty if not needed).
    """
    body = await request.json()
    pod = body.get("Pod", {})
    job = extract_job_from_pod(pod)

    if job.priority != JobPriority.CRITICAL:
        return {"nominatedNodeName": "", "preemptionVictims": {}, "Error": ""}

    # Simplistic: evict the first BATCH job found in the cluster
    # A production implementation would query the K8s API for pod priorities
    return {
        "nominatedNodeName": "node-1",
        "preemptionVictims": {
            "node-1": {
                "pods": [{"namespace": "aero", "name": "batch-job-placeholder"}],
                "numPDBViolations": 0,
            }
        },
        "Error": "",
    }


@app.get("/health")
def health():
    return {"status": "ok", "service": "aero-scheduler-extender"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
