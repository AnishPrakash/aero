import { NodeMetrics, IncomingJobSpec, PlacementDecision, WorkloadType } from './types';
import { InterferenceProfiler } from './interference';

export class ScoringEngine {
  public wMakespan: number;
  public wFairness: number;
  public wEnergy: number;
  private profiler: InterferenceProfiler;

  constructor(
    wMakespan = 0.4,
    wFairness = 0.3,
    wEnergy = 0.3,
    profiler?: InterferenceProfiler
  ) {
    this.wMakespan = wMakespan;
    this.wFairness = wFairness;
    this.wEnergy = wEnergy;
    this.profiler = profiler || new InterferenceProfiler();
  }

  public makespanScore(node: NodeMetrics): number {
    const gpuFree = Math.max(0, 1.0 - node.gpuUtil / 100.0);
    const memFree = Math.max(0, 1.0 - node.memoryUtil / 100.0);
    return Number((gpuFree * memFree).toFixed(4));
  }

  public fairnessScore(node: NodeMetrics, job: IncomingJobSpec): number {
    const total = Math.max(node.totalJobsCompleted, 1);
    const tenantShare = node.jobsCompletedByTenant / total;
    return Number(Math.max(0.0, Math.min(1.0, 1.0 - tenantShare)).toFixed(4));
  }

  public energyScore(node: NodeMetrics): number {
    const budgetRatio = node.powerBudgetRemaining / Math.max(node.powerBudgetTotal, 1.0);
    const powerRatio = 1.0 - node.powerDrawWatts / Math.max(node.powerLimitWatts, 1.0);
    return Number(Math.max(0.0, Math.min(1.0, budgetRatio * powerRatio)).toFixed(4));
  }

  public colocationMultiplier(existing: WorkloadType, incoming: WorkloadType): number {
    return this.profiler.coLocationScore(existing, incoming);
  }

  public scoreNode(node: NodeMetrics, job: IncomingJobSpec): PlacementDecision {
    const ms = this.makespanScore(node);
    const fs = this.fairnessScore(node, job);
    const es = this.energyScore(node);
    const cm = this.colocationMultiplier(node.workloadClass, job.workloadClass);

    const raw = this.wMakespan * ms + this.wFairness * fs + this.wEnergy * es;
    const finalScore = Number((raw * cm * 100.0).toFixed(2));

    const rationale = `Makespan=${ms.toFixed(2)}(×${this.wMakespan}) + Fairness=${fs.toFixed(
      2
    )}(×${this.wFairness}) + Energy=${es.toFixed(2)}(×${this.wEnergy}) = ${raw.toFixed(
      3
    )} × CoLocation(${node.workloadClass}+${job.workloadClass})=${cm} → FinalScore=${finalScore}`;

    return {
      nodeName: node.nodeName,
      score: finalScore,
      makespanScore: ms,
      fairnessScore: fs,
      energyScore: es,
      colocationMultiplier: cm,
      rationale,
    };
  }

  public rankNodes(nodes: NodeMetrics[], job: IncomingJobSpec): PlacementDecision[] {
    const decisions = nodes.map((n) => this.scoreNode(n, job));
    return decisions.sort((a, b) => b.score - a.score);
  }
}
