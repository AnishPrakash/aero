"""
Telemetry Daemon — runs every 5 seconds, scrapes GPU metrics,
feeds the Interference Profiler, and pushes Prometheus metrics.
In simulation mode, reads from the GPU Simulator REST API.
In real mode, reads from PyNVML directly.
"""

import os
import time
import threading
import logging
import requests
from prometheus_client import Gauge, start_http_server, CollectorRegistry

from interference_profiler import InterferenceProfiler, WorkloadClass

logging.basicConfig(level=logging.INFO, format="%(asctime)s [DAEMON] %(message)s")
log = logging.getLogger(__name__)

SIMULATOR_URL = os.getenv("SIMULATOR_URL", "http://localhost:8001")
USE_REAL_GPU = os.getenv("USE_REAL_GPU", "false").lower() == "true"
SCRAPE_INTERVAL = int(os.getenv("SCRAPE_INTERVAL", "5"))
PROMETHEUS_PORT = int(os.getenv("PROMETHEUS_PORT", "9090"))

registry = CollectorRegistry()
workload_class_gauge = Gauge(
    "aero_interference_class",
    "Workload interference class: 0=IDLE 1=COMPUTE 2=MEMORY 3=MIXED",
    ["node", "gpu_id"],
    registry=registry,
)
co_location_compatibility_gauge = Gauge(
    "aero_colocation_score",
    "Co-location compatibility score for incoming job (latest assessment)",
    ["node", "gpu_id"],
    registry=registry,
)

CLASS_MAP = {
    WorkloadClass.IDLE: 0,
    WorkloadClass.COMPUTE_BOUND: 1,
    WorkloadClass.MEMORY_BOUND: 2,
    WorkloadClass.MIXED: 3,
}

profiler = InterferenceProfiler()
_latest_snapshot: list = []
_snapshot_lock = threading.Lock()


def scrape_simulator() -> list:
    try:
        resp = requests.get(f"{SIMULATOR_URL}/gpus", timeout=3)
        resp.raise_for_status()
        return resp.json()["gpus"]
    except Exception as e:
        log.warning("Simulator scrape failed: %s", e)
        return []


def scrape_real_nvml() -> list:
    try:
        import pynvml
        pynvml.nvmlInit()
        count = pynvml.nvmlDeviceGetCount()
        results = []
        for i in range(count):
            handle = pynvml.nvmlDeviceGetHandleByIndex(i)
            util = pynvml.nvmlDeviceGetUtilizationRates(handle)
            mem = pynvml.nvmlDeviceGetMemoryInfo(handle)
            power = pynvml.nvmlDeviceGetPowerUsage(handle) / 1000
            temp = pynvml.nvmlDeviceGetTemperature(handle, 0)
            results.append({
                "key": f"node-local:{i}",
                "node_id": "node-local",
                "gpu_id": i,
                "gpu_util": util.gpu,
                "memory_util": util.memory,
                "memory_used_mb": mem.used / 1024 / 1024,
                "memory_total_mb": mem.total / 1024 / 1024,
                "power_draw_watts": power,
                "temperature_c": temp,
            })
        return results
    except Exception as e:
        log.error("NVML read failed: %s", e)
        return []


def daemon_loop():
    global _latest_snapshot
    while True:
        gpus = scrape_real_nvml() if USE_REAL_GPU else scrape_simulator()
        for g in gpus:
            key = g["key"]
            profiler.ingest(key, g["gpu_util"], g["memory_util"])
            wc = profiler.classify(key)
            workload_class_gauge.labels(
                node=g["node_id"], gpu_id=str(g["gpu_id"])
            ).set(CLASS_MAP[wc])
        with _snapshot_lock:
            _latest_snapshot = gpus
        log.info("Tick: %d GPUs scraped", len(gpus))
        time.sleep(SCRAPE_INTERVAL)


def get_latest_snapshot() -> list:
    with _snapshot_lock:
        return list(_latest_snapshot)


if __name__ == "__main__":
    start_http_server(PROMETHEUS_PORT, registry=registry)
    log.info("Prometheus metrics on port %d", PROMETHEUS_PORT)
    daemon_loop()
