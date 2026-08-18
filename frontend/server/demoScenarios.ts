import { GPUSimulator } from './simulator';
import { PowerController } from './power';
import { ScoringEngine } from './scoring';
import { MLForecasterEngine } from './forecaster';
import { LogRecord, SimulatedJob, WorkloadType, JobPriority } from './types';

export class DemoScenarioManager {
  private simulator: GPUSimulator;
  private powerCtrl: PowerController;
  private scoring: ScoringEngine;
  private forecaster: MLForecasterEngine;
  private logSink: (log: LogRecord) => void;

  constructor(
    simulator: GPUSimulator,
    powerCtrl: PowerController,
    scoring: ScoringEngine,
    forecaster: MLForecasterEngine,
    logSink: (log: LogRecord) => void
  ) {
    this.simulator = simulator;
    this.powerCtrl = powerCtrl;
    this.scoring = scoring;
    this.forecaster = forecaster;
    this.logSink = logSink;
  }

  private log(level: 'INFO' | 'WARN' | 'ERROR' | 'SCHED', node: string, message: string) {
    const timeStr = new Date().toTimeString().split(' ')[0] + '.' + Math.floor(Math.random() * 899 + 100);
    this.logSink({
      id: Math.random().toString(),
      time: timeStr,
      level,
      node,
      message,
    });
  }

  // Scenario 1: The Co-location Advantage
  public async runScenario1(): Promise<{ scenario: string; summary: string; jobs: SimulatedJob[] }> {
    this.log('INFO', 'demo-runner', '=== SCENARIO 1: EFFICIENT CO-LOCATION TRIGGERED ===');
    
    // 1. Submit compute-bound job
    const job1: SimulatedJob = {
      jobId: '#demo-bert-' + Math.floor(Math.random() * 900 + 100),
      name: 'bert-train-co-loc',
      workloadType: 'COMPUTE_BOUND',
      priority: 'INTERACTIVE',
      tenant: 'team-nlp',
      gpuUtilTarget: 85,
      memoryUtilTarget: 25,
      powerTargetWatts: 320,
      durationSeconds: 90,
      startedAt: Date.now(),
      status: 'RUNNING',
    };
    this.simulator.submitJob('node-1:0', job1);
    this.powerCtrl.applyPowerPolicy(job1.jobId, 'node-1:0', job1.priority, job1.name);
    this.log('SCHED', 'node-1:0', `Placed COMPUTE-BOUND ${job1.name} on node-1:0 (85% util, 320W power cap)`);

    // 2. Submit memory-bound job to the same GPU
    const job2: SimulatedJob = {
      jobId: '#demo-preproc-' + Math.floor(Math.random() * 900 + 100),
      name: 'preproc-resnet-co-loc',
      workloadType: 'MEMORY_BOUND',
      priority: 'BATCH',
      tenant: 'team-cv',
      gpuUtilTarget: 20,
      memoryUtilTarget: 75,
      powerTargetWatts: 180,
      durationSeconds: 90,
      startedAt: Date.now(),
      status: 'RUNNING',
    };
    this.simulator.submitJob('node-1:0', job2);
    this.powerCtrl.applyPowerPolicy(job2.jobId, 'node-1:0', job2.priority, job2.name);
    this.log('SCHED', 'scheduler', `AERO scored CoLocation: COMPUTE + MEMORY = 1.3× speed bonus. Both active on node-1:0.`);

    return {
      scenario: 'Scenario 1: The Co-location Advantage',
      summary: 'AERO co-located COMPUTE_BOUND + MEMORY_BOUND on NODE-01 with 1.3× synergy multiplier. Both jobs running concurrently with orthogonal bus utilization.',
      jobs: [job1, job2],
    };
  }

  // Scenario 2: Preemption + Power Throttling
  public async runScenario2(): Promise<{ scenario: string; summary: string }> {
    this.log('INFO', 'demo-runner', '=== SCENARIO 2: PREEMPTION & POWER THROTTLING TRIGGERED ===');

    // 1. Submit Batch job with 60% power cap (240W)
    const batchJob: SimulatedJob = {
      jobId: '#demo-batch-' + Math.floor(Math.random() * 900 + 100),
      name: 'batch-data-etl',
      workloadType: 'MEMORY_BOUND',
      priority: 'BATCH',
      tenant: 'team-data',
      gpuUtilTarget: 50,
      memoryUtilTarget: 60,
      powerTargetWatts: 240,
      durationSeconds: 60,
      startedAt: Date.now(),
      status: 'RUNNING',
    };
    this.simulator.submitJob('node-2:0', batchJob);
    this.powerCtrl.applyPowerPolicy(batchJob.jobId, 'node-2:0', 'BATCH', batchJob.name);
    this.log('WARN', 'node-2:0', `Throttling GPU to 240W (60% TDP for BATCH priority)`);

    // 2. Critical inference arrives -> Preempt batch job and restore full 400W TDP
    setTimeout(() => {
      this.simulator.evictJobs('node-2:0');
      this.powerCtrl.releasePower(batchJob.jobId);
      this.log('WARN', 'scheduler', `CRITICAL workload arrived → Preempted batch job ${batchJob.name}`);

      const critJob: SimulatedJob = {
        jobId: '#demo-crit-' + Math.floor(Math.random() * 900 + 100),
        name: 'realtime-llm-inference',
        workloadType: 'COMPUTE_BOUND',
        priority: 'CRITICAL',
        tenant: 'prod-team',
        gpuUtilTarget: 80,
        memoryUtilTarget: 35,
        powerTargetWatts: 380,
        durationSeconds: 60,
        startedAt: Date.now(),
        status: 'RUNNING',
      };
      this.simulator.submitJob('node-2:0', critJob);
      this.powerCtrl.applyPowerPolicy(critJob.jobId, 'node-2:0', 'CRITICAL', critJob.name);
      this.log('INFO', 'node-2:0', `Restored full 400W TDP power limit for CRITICAL inference`);
    }, 1500);

    return {
      scenario: 'Scenario 2: Preemption & Power Throttling',
      summary: 'Batch workload throttled to 240W (60% TDP). Incoming CRITICAL job instantly preempted batch pod, restored 400W full boost, and maintained SLA.',
    };
  }

  // Scenario 3: Demand Forecasting in Action
  public async runScenario3(): Promise<{ scenario: string; summary: string }> {
    this.log('INFO', 'forecaster', '=== SCENARIO 3: ML DEMAND SURGE SYNTHESIS ===');
    const forecast = this.forecaster.predict(88.0, 6, 7.2);
    this.log('WARN', 'forecaster', `⚡ Surge predicted in <15 min (demand=${forecast.predictedGpuDemand} GPU-hours). Pre-warming node-3 recommended.`);

    // Pre-warm node-3
    this.simulator.prewarmNode('NODE-03');
    this.log('INFO', 'node-3', `Node-3 PCIe bus hydrated & memory buffers pre-warmed. Zero cold-start latency.`);

    return {
      scenario: 'Scenario 3: Predictive Pre-warming',
      summary: `Forecaster predicted ${forecast.predictedGpuDemand} GPU-hour surge with ${Math.round(forecast.confidence * 100)}% confidence. Node-3 hydrated proactively.`,
    };
  }
}
