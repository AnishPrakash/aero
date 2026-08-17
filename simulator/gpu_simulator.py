"""
GPU Telemetry Simulator
Emits realistic GPU metrics mimicking NVIDIA NVML output.
Supports configurable workload profiles: compute-bound, memory-bound, idle.
Pushes metrics to Prometheus and exposes a REST API for direct querying.
"""

import time
import math
import random
import threading
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from enum import Enum

from fastapi import FastAPI
from prometheus_client import Gauge, start_http_server, CollectorRegistry
import uvicorn

# ──────────────────────────────────────────────
# Enums & Data Structures
# ──────────────────────────────────────────────

class WorkloadType(str, Enum):
    IDLE = "IDLE"
    COMPUTE_BOUND = "COMPUTE_BOUND"
    MEMORY_BOUND = "MEMORY_BOUND"
    MIXED = "MIXED"

class JobPriority(str, Enum):
    CRITICAL = "CRITICAL"
    INTERACTIVE = "INTERACTIVE"
    BATCH = "BATCH"
    IDLE_WARMTH = "IDLE_WARMTH"

@dataclass
class SimulatedJob:
    job_id: str
    workload_type: WorkloadType
    priority: JobPriority
    gpu_util_target: float       # 0–100
    memory_util_target: float    # 0–100
    power_target_watts: float
    duration_seconds: float
    started_at: float = field(default_factory=time.time)

@dataclass
class GPUState:
    gpu_id: int
    node_id: str
    gpu_util: float = 0.0
    memory_util: float = 0.0
    memory_used_mb: float = 0.0
    memory_total_mb: float = 40960.0   # 40 GB (A100-class)
    power_draw_watts: float = 50.0
    power_limit_watts: float = 400.0
    temperature_c: float = 35.0
    clock_mhz: float = 1410.0
    current_jobs: List[SimulatedJob] = field(default_factory=list)
    workload_type: WorkloadType = WorkloadType.IDLE

# ──────────────────────────────────────────────
# Prometheus Metrics Registry
# ──────────────────────────────────────────────

registry = CollectorRegistry()

gpu_util_gauge = Gauge(
    "aero_gpu_utilization_percent",
    "GPU compute utilization (%)",
    ["node", "gpu_id"],
    registry=registry
)
gpu_mem_util_gauge = Gauge(
    "aero_gpu_memory_utilization_percent",
    "GPU memory utilization (%)",
    ["node", "gpu_id"],
    registry=registry
)
gpu_power_gauge = Gauge(
    "aero_gpu_power_draw_watts",
    "GPU power draw in Watts",
    ["node", "gpu_id"],
    registry=registry
)
gpu_temp_gauge = Gauge(
    "aero_gpu_temperature_celsius",
    "GPU temperature in Celsius",
    ["node", "gpu_id"],
    registry=registry
)
gpu_workload_type_gauge = Gauge(
    "aero_gpu_workload_type",
    "GPU workload type encoded: 0=IDLE,1=COMPUTE,2=MEMORY,3=MIXED",
    ["node", "gpu_id"],
    registry=registry
)

# ──────────────────────────────────────────────
# Simulator Engine
# ──────────────────────────────────────────────

WORKLOAD_TYPE_MAP = {
    WorkloadType.IDLE: 0,
    WorkloadType.COMPUTE_BOUND: 1,
    WorkloadType.MEMORY_BOUND: 2,
    WorkloadType.MIXED: 3,
}

class GPUSimulator:
    def __init__(self):
        # Initialise 3 simulated nodes, each with 1 GPU
        self.gpus: Dict[str, GPUState] = {
            "node-1:0": GPUState(gpu_id=0, node_id="node-1"),
            "node-2:0": GPUState(gpu_id=0, node_id="node-2"),
            "node-3:0": GPUState(gpu_id=0, node_id="node-3"),
        }
        self._lock = threading.Lock()
        self._running = False

    def _noise(self, value: float, sigma: float = 3.0) -> float:
        """Add realistic Gaussian jitter to a metric."""
        return max(0.0, min(100.0, value + random.gauss(0, sigma)))

    def _compute_workload_type(self, gpu: GPUState) -> WorkloadType:
        if not gpu.current_jobs:
            return WorkloadType.IDLE
        types = {j.workload_type for j in gpu.current_jobs}
        if len(types) == 1:
            return types.pop()
        return WorkloadType.MIXED

    def _update_gpu(self, gpu: GPUState):
        """Recompute GPU metrics from current jobs + noise."""
        now = time.time()

        # Remove expired jobs
        gpu.current_jobs = [
            j for j in gpu.current_jobs
            if now - j.started_at < j.duration_seconds
        ]

        if not gpu.current_jobs:
            # Idle state
            gpu.gpu_util = self._noise(2.0, 1.0)
            gpu.memory_util = self._noise(5.0, 2.0)
            gpu.power_draw_watts = self._noise(50.0, 5.0)
            gpu.temperature_c = self._noise(35.0, 2.0)
            gpu.clock_mhz = 300.0
            gpu.workload_type = WorkloadType.IDLE
        else:
            # Aggregate targets from running jobs
            total_gpu = sum(j.gpu_util_target for j in gpu.current_jobs)
            total_mem = sum(j.memory_util_target for j in gpu.current_jobs)
            total_pwr = sum(j.power_target_watts for j in gpu.current_jobs)

            # Apply power limit cap
            cap_ratio = min(1.0, gpu.power_limit_watts / max(total_pwr, 1))
            total_pwr = min(total_pwr, gpu.power_limit_watts)
            total_gpu = min(99.0, total_gpu * cap_ratio)

            gpu.gpu_util = self._noise(total_gpu, 4.0)
            gpu.memory_util = self._noise(min(total_mem, 95.0), 3.0)
            gpu.memory_used_mb = (gpu.memory_util / 100.0) * gpu.memory_total_mb
            gpu.power_draw_watts = self._noise(total_pwr, 8.0)
            gpu.temperature_c = self._noise(40.0 + total_pwr * 0.1, 2.0)
            gpu.clock_mhz = 1410.0 * cap_ratio
            gpu.workload_type = self._compute_workload_type(gpu)

    def tick(self):
        """Run one simulation tick: update all GPUs and push to Prometheus."""
        with self._lock:
            for key, gpu in self.gpus.items():
                self._update_gpu(gpu)
                gpu_util_gauge.labels(node=gpu.node_id, gpu_id=str(gpu.gpu_id)).set(gpu.gpu_util)
                gpu_mem_util_gauge.labels(node=gpu.node_id, gpu_id=str(gpu.gpu_id)).set(gpu.memory_util)
                gpu_power_gauge.labels(node=gpu.node_id, gpu_id=str(gpu.gpu_id)).set(gpu.power_draw_watts)
                gpu_temp_gauge.labels(node=gpu.node_id, gpu_id=str(gpu.gpu_id)).set(gpu.temperature_c)
                gpu_workload_type_gauge.labels(node=gpu.node_id, gpu_id=str(gpu.gpu_id)).set(
                    WORKLOAD_TYPE_MAP[gpu.workload_type]
                )

    def run_loop(self, interval: float = 5.0):
        self._running = True
        while self._running:
            self.tick()
            time.sleep(interval)

    def stop(self):
        self._running = False

    def submit_job(self, gpu_key: str, job: SimulatedJob) -> bool:
        with self._lock:
            if gpu_key not in self.gpus:
                return False
            self.gpus[gpu_key].current_jobs.append(job)
            return True

    def set_power_limit(self, gpu_key: str, watts: float) -> bool:
        with self._lock:
            if gpu_key not in self.gpus:
                return False
            self.gpus[gpu_key].power_limit_watts = watts
            return True

    def evict_jobs(self, gpu_key: str):
        with self._lock:
            if gpu_key in self.gpus:
                self.gpus[gpu_key].current_jobs.clear()

    def snapshot(self) -> List[dict]:
        with self._lock:
            result = []
            for key, gpu in self.gpus.items():
                result.append({
                    "key": key,
                    "node_id": gpu.node_id,
                    "gpu_id": gpu.gpu_id,
                    "gpu_util": round(gpu.gpu_util, 2),
                    "memory_util": round(gpu.memory_util, 2),
                    "memory_used_mb": round(gpu.memory_used_mb, 0),
                    "memory_total_mb": gpu.memory_total_mb,
                    "power_draw_watts": round(gpu.power_draw_watts, 1),
                    "power_limit_watts": gpu.power_limit_watts,
                    "temperature_c": round(gpu.temperature_c, 1),
                    "clock_mhz": round(gpu.clock_mhz, 0),
                    "workload_type": gpu.workload_type.value,
                    "running_jobs": [
                        {
                            "job_id": j.job_id,
                            "type": j.workload_type.value,
                            "priority": j.priority.value,
                        }
                        for j in gpu.current_jobs
                    ],
                })
            return result


# ──────────────────────────────────────────────
# FastAPI app for REST access to simulator
# ──────────────────────────────────────────────

simulator = GPUSimulator()
app = FastAPI(title="AERO GPU Simulator", version="1.0")

@app.on_event("startup")
def on_startup():
    start_http_server(9091, registry=registry)   # Prometheus metrics port
    t = threading.Thread(target=simulator.run_loop, daemon=True)
    t.start()

@app.get("/gpus")
def get_gpus():
    return {"gpus": simulator.snapshot()}

@app.post("/jobs/submit")
def submit_job(payload: dict):
    job = SimulatedJob(
        job_id=payload["job_id"],
        workload_type=WorkloadType(payload.get("workload_type", "COMPUTE_BOUND")),
        priority=JobPriority(payload.get("priority", "BATCH")),
        gpu_util_target=float(payload.get("gpu_util_target", 70.0)),
        memory_util_target=float(payload.get("memory_util_target", 30.0)),
        power_target_watts=float(payload.get("power_target_watts", 280.0)),
        duration_seconds=float(payload.get("duration_seconds", 120.0)),
    )
    gpu_key = payload.get("gpu_key", "node-1:0")
    ok = simulator.submit_job(gpu_key, job)
    return {"success": ok, "job_id": job.job_id, "gpu_key": gpu_key}

@app.post("/power/throttle/{gpu_key_enc}")
def throttle(gpu_key_enc: str, payload: dict):
    gpu_key = gpu_key_enc.replace("__", ":")
    watts = float(payload.get("watts", 240.0))
    ok = simulator.set_power_limit(gpu_key, watts)
    return {"success": ok, "gpu_key": gpu_key, "new_limit_watts": watts}

@app.post("/jobs/evict/{gpu_key_enc}")
def evict(gpu_key_enc: str):
    gpu_key = gpu_key_enc.replace("__", ":")
    simulator.evict_jobs(gpu_key)
    return {"success": True, "gpu_key": gpu_key}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
