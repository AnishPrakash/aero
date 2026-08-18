"""
Interference Profiler
Classifies each GPU's running workload as COMPUTE_BOUND, MEMORY_BOUND, or MIXED
based on a sliding window of telemetry metrics.
Used by the scheduling engine to enforce co-location compatibility rules.
"""

from dataclasses import dataclass, field
from collections import deque
from typing import Deque, Dict
from enum import Enum
import time

class WorkloadClass(str, Enum):
    IDLE = "IDLE"
    COMPUTE_BOUND = "COMPUTE_BOUND"
    MEMORY_BOUND = "MEMORY_BOUND"
    MIXED = "MIXED"

@dataclass
class TelemetryPoint:
    timestamp: float
    gpu_util: float           # 0–100
    memory_util: float        # 0–100

@dataclass
class ProfileWindow:
    gpu_key: str
    window_size: int = 6      # 6 × 5s = 30-second window
    points: Deque[TelemetryPoint] = field(default_factory=deque)

    def add(self, gpu_util: float, memory_util: float):
        self.points.append(TelemetryPoint(
            timestamp=time.time(),
            gpu_util=gpu_util,
            memory_util=memory_util,
        ))
        if len(self.points) > self.window_size:
            self.points.popleft()

    def classify(self) -> WorkloadClass:
        if len(self.points) < 2:
            return WorkloadClass.IDLE

        avg_gpu = sum(p.gpu_util for p in self.points) / len(self.points)
        avg_mem = sum(p.memory_util for p in self.points) / len(self.points)

        if avg_gpu < 10 and avg_mem < 15:
            return WorkloadClass.IDLE
        if avg_gpu >= 75 and avg_mem < 55:
            return WorkloadClass.COMPUTE_BOUND
        if avg_mem >= 70 and avg_gpu < 55:
            return WorkloadClass.MEMORY_BOUND
        return WorkloadClass.MIXED

    @property
    def avg_gpu_util(self) -> float:
        if not self.points:
            return 0.0
        return sum(p.gpu_util for p in self.points) / len(self.points)

    @property
    def avg_mem_util(self) -> float:
        if not self.points:
            return 0.0
        return sum(p.memory_util for p in self.points) / len(self.points)


class InterferenceProfiler:
    """
    Maintains sliding-window workload profiles for every GPU in the cluster.
    Thread-safe via the caller controlling ticks.
    """
    def __init__(self):
        self._windows: Dict[str, ProfileWindow] = {}

    def ingest(self, gpu_key: str, gpu_util: float, memory_util: float):
        """Feed one telemetry point for a GPU."""
        if gpu_key not in self._windows:
            self._windows[gpu_key] = ProfileWindow(gpu_key=gpu_key)
        self._windows[gpu_key].add(gpu_util, memory_util)

    def classify(self, gpu_key: str) -> WorkloadClass:
        if gpu_key not in self._windows:
            return WorkloadClass.IDLE
        return self._windows[gpu_key].classify()

    def classify_all(self) -> Dict[str, WorkloadClass]:
        return {k: w.classify() for k, w in self._windows.items()}

    def co_location_score(
        self,
        existing_class: WorkloadClass,
        new_class: WorkloadClass,
    ) -> float:
        """
        Returns a co-location compatibility multiplier.
        1.3 = beneficial pairing (COMPUTE + MEMORY).
        1.0 = neutral.
        0.2 = destructive pairing (two MEMORY_BOUND competing for HBM bandwidth).
        """
        if existing_class == WorkloadClass.IDLE:
            return 1.0
        if new_class == WorkloadClass.IDLE:
            return 1.0

        # Best case: compute + memory complement each other
        if (existing_class == WorkloadClass.COMPUTE_BOUND and new_class == WorkloadClass.MEMORY_BOUND) or \
           (existing_class == WorkloadClass.MEMORY_BOUND and new_class == WorkloadClass.COMPUTE_BOUND):
            return 1.3

        # Worst case: two memory-bound jobs fight for HBM bandwidth
        if existing_class == WorkloadClass.MEMORY_BOUND and new_class == WorkloadClass.MEMORY_BOUND:
            return 0.2

        # Two compute-bound: slight contention on CUDA cores
        if existing_class == WorkloadClass.COMPUTE_BOUND and new_class == WorkloadClass.COMPUTE_BOUND:
            return 0.6

        return 1.0
