"""
Multi-Objective Scoring Engine
Scores each candidate GPU node when placing a new job.
Three objectives: Makespan, Fairness, Energy.
Applies co-location compatibility multiplier from the Interference Profiler.

Score(node_i) = (w1 * Makespan + w2 * Fairness + w3 * Energy) * CoLocation_Multiplier
Default weights: w1=0.4, w2=0.3, w3=0.3
"""

from dataclasses import dataclass
from typing import Dict, List, Optional
from enum import Enum
import logging

log = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# Data Structures
# ──────────────────────────────────────────────

class WorkloadClass(str, Enum):
    IDLE = "IDLE"
    COMPUTE_BOUND = "COMPUTE_BOUND"
    MEMORY_BOUND = "MEMORY_BOUND"
    MIXED = "MIXED"

class JobPriority(str, Enum):
    CRITICAL = "CRITICAL"
    INTERACTIVE = "INTERACTIVE"
    BATCH = "BATCH"

@dataclass
class NodeMetrics:
    node_name: str
    gpu_util: float               # 0–100 (%)
    memory_util: float            # 0–100 (%)
    power_draw_watts: float
    power_limit_watts: float
    power_budget_remaining: float # Watts remaining in hourly budget
    power_budget_total: float
    workload_class: WorkloadClass
    jobs_completed_by_tenant: int  # Last hour
    total_jobs_completed: int      # Last hour across all tenants

@dataclass
class IncomingJob:
    job_id: str
    tenant: str
    priority: JobPriority
    workload_class: WorkloadClass
    tenant_jobs_completed_last_hour: int
    total_jobs_last_hour: int

@dataclass
class PlacementDecision:
    node_name: str
    score: float
    makespan_score: float
    fairness_score: float
    energy_score: float
    colocation_multiplier: float
    rationale: str


# ──────────────────────────────────────────────
# Scoring Engine
# ──────────────────────────────────────────────

class ScoringEngine:
    def __init__(
        self,
        w_makespan: float = 0.4,
        w_fairness: float = 0.3,
        w_energy: float = 0.3,
    ):
        assert abs(w_makespan + w_fairness + w_energy - 1.0) < 1e-6, \
            "Weights must sum to 1.0"
        self.w1 = w_makespan
        self.w2 = w_fairness
        self.w3 = w_energy

    # ── Individual Scorers ───────────────────

    def makespan_score(self, node: NodeMetrics) -> float:
        """
        Higher score = lower utilisation + lower memory pressure → job finishes faster.
        Score: (1 - gpu_util/100) × (1 - memory_util/100)
        """
        gpu_free = 1.0 - (node.gpu_util / 100.0)
        mem_free = 1.0 - (node.memory_util / 100.0)
        score = gpu_free * mem_free
        return round(max(0.0, min(1.0, score)), 4)

    def fairness_score(self, node: NodeMetrics, job: IncomingJob) -> float:
        """
        Tenant fairness: if this tenant has used disproportionately few resources,
        boost their score. Returns higher score for under-served tenants.
        Fair share = 1 / num_tenants (approximated as 1/total_jobs if we assume
        one job per tenant on average).
        """
        total = max(job.total_jobs_last_hour, 1)
        tenant_share = job.tenant_jobs_completed_last_hour / total
        # Invert: under-served tenants (low share) get higher score
        score = 1.0 - tenant_share
        return round(max(0.0, min(1.0, score)), 4)

    def energy_score(self, node: NodeMetrics) -> float:
        """
        Prefer nodes with more remaining power budget and currently drawing less power.
        Score: (budget_remaining / budget_total) × (1 - power_draw/power_limit)
        """
        budget_ratio = node.power_budget_remaining / max(node.power_budget_total, 1.0)
        power_ratio  = 1.0 - (node.power_draw_watts / max(node.power_limit_watts, 1.0))
        score = budget_ratio * power_ratio
        return round(max(0.0, min(1.0, score)), 4)

    def colocation_multiplier(
        self,
        existing: WorkloadClass,
        incoming: WorkloadClass,
    ) -> float:
        """
        See interference_profiler.py for full explanation.
        Compute-bound + Memory-bound = 1.3 (complementary).
        Memory-bound + Memory-bound = 0.2 (destructive HBM contention).
        """
        if existing == WorkloadClass.IDLE:
            return 1.0
        if incoming == WorkloadClass.IDLE:
            return 1.0
        if (existing == WorkloadClass.COMPUTE_BOUND and incoming == WorkloadClass.MEMORY_BOUND) or \
           (existing == WorkloadClass.MEMORY_BOUND  and incoming == WorkloadClass.COMPUTE_BOUND):
            return 1.3
        if existing == WorkloadClass.MEMORY_BOUND and incoming == WorkloadClass.MEMORY_BOUND:
            return 0.2
        if existing == WorkloadClass.COMPUTE_BOUND and incoming == WorkloadClass.COMPUTE_BOUND:
            return 0.6
        return 1.0

    # ── Main Scorer ──────────────────────────

    def score_node(self, node: NodeMetrics, job: IncomingJob) -> PlacementDecision:
        ms = self.makespan_score(node)
        fs = self.fairness_score(node, job)
        es = self.energy_score(node)
        cm = self.colocation_multiplier(node.workload_class, job.workload_class)

        raw = (self.w1 * ms) + (self.w2 * fs) + (self.w3 * es)
        final = round(raw * cm * 100.0, 2)   # Scale to 0–130 for K8s extender

        rationale = (
            f"Makespan={ms:.2f}(×{self.w1}) + "
            f"Fairness={fs:.2f}(×{self.w2}) + "
            f"Energy={es:.2f}(×{self.w3}) = {raw:.3f} "
            f"× CoLocation({node.workload_class.value}+{job.workload_class.value})={cm} "
            f"→ Final={final}"
        )
        log.info("[SCORE] node=%s job=%s | %s", node.node_name, job.job_id, rationale)

        return PlacementDecision(
            node_name=node.node_name,
            score=final,
            makespan_score=ms,
            fairness_score=fs,
            energy_score=es,
            colocation_multiplier=cm,
            rationale=rationale,
        )

    def rank_nodes(
        self,
        nodes: List[NodeMetrics],
        job: IncomingJob,
    ) -> List[PlacementDecision]:
        decisions = [self.score_node(n, job) for n in nodes]
        return sorted(decisions, key=lambda d: d.score, reverse=True)


# ──────────────────────────────────────────────
# Unit Tests (run with: python scoring_engine.py)
# ──────────────────────────────────────────────

if __name__ == "__main__":
    engine = ScoringEngine()

    nodes = [
        NodeMetrics(
            node_name="node-1",
            gpu_util=85.0,
            memory_util=30.0,
            power_draw_watts=320.0,
            power_limit_watts=400.0,
            power_budget_remaining=200.0,
            power_budget_total=800.0,
            workload_class=WorkloadClass.COMPUTE_BOUND,
            jobs_completed_by_tenant=2,
            total_jobs_completed=10,
        ),
        NodeMetrics(
            node_name="node-2",
            gpu_util=40.0,
            memory_util=70.0,
            power_draw_watts=180.0,
            power_limit_watts=400.0,
            power_budget_remaining=500.0,
            power_budget_total=800.0,
            workload_class=WorkloadClass.MEMORY_BOUND,
            jobs_completed_by_tenant=2,
            total_jobs_completed=10,
        ),
        NodeMetrics(
            node_name="node-3",
            gpu_util=5.0,
            memory_util=5.0,
            power_draw_watts=50.0,
            power_limit_watts=400.0,
            power_budget_remaining=700.0,
            power_budget_total=800.0,
            workload_class=WorkloadClass.IDLE,
            jobs_completed_by_tenant=2,
            total_jobs_completed=10,
        ),
    ]

    # Incoming: compute-bound job
    job = IncomingJob(
        job_id="bert-train-001",
        tenant="team-nlp",
        priority=JobPriority.INTERACTIVE,
        workload_class=WorkloadClass.COMPUTE_BOUND,
        tenant_jobs_completed_last_hour=2,
        total_jobs_last_hour=10,
    )

    ranked = engine.rank_nodes(nodes, job)
    print("\n=== Scoring Results (COMPUTE_BOUND job) ===")
    for d in ranked:
        print(f"  {d.node_name}: score={d.score:.2f}")
        print(f"    {d.rationale}")

    print("\n=== Expected: node-2 (MEMORY_BOUND) gets highest score due to 1.3× bonus ===")
