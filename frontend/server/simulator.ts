import { GPUState, SimulatedJob, WorkloadType, JobPriority } from './types';

export class GPUSimulator {
  public gpus: Map<string, GPUState> = new Map();
  private timer: NodeJS.Timeout | null = null;
  public onTickListeners: Array<(gpus: GPUState[]) => void> = [];

  constructor() {
    this.initDefaultCluster();
    this.startLoop(2000); // 2-second simulation tick
  }

  private initDefaultCluster() {
    // 4 Nodes with 2 GPUs each (total 8 GPUs as shown in Cluster Overview)
    const initialGpuConfigs: Array<{
      key: string;
      nodeId: string;
      gpuId: number;
      util: number;
      memUtil: number;
      power: number;
      limit: number;
      temp: number;
      fan: number;
      type: WorkloadType;
      jobs?: Partial<SimulatedJob>[];
    }> = [
      {
        key: 'node-1:0',
        nodeId: 'NODE-01',
        gpuId: 0,
        util: 85,
        memUtil: 30,
        power: 160,
        limit: 400,
        temp: 74,
        fan: 65,
        type: 'COMPUTE_BOUND',
        jobs: [
          {
            jobId: '#7892',
            name: 'bert-train',
            workloadType: 'COMPUTE_BOUND',
            priority: 'CRITICAL',
            tenant: 'team-nlp',
            gpuUtilTarget: 85,
            memoryUtilTarget: 25,
            powerTargetWatts: 160,
            durationSeconds: 300,
          },
        ],
      },
      {
        key: 'node-1:1',
        nodeId: 'NODE-01',
        gpuId: 1,
        util: 40,
        memUtil: 75,
        power: 125,
        limit: 240, // Throttled to 60%
        temp: 70,
        fan: 60,
        type: 'MEMORY_BOUND',
        jobs: [
          {
            jobId: '#7893',
            name: 'preproc-dataset',
            workloadType: 'MEMORY_BOUND',
            priority: 'INTERACTIVE',
            tenant: 'team-cv',
            gpuUtilTarget: 40,
            memoryUtilTarget: 75,
            powerTargetWatts: 125,
            durationSeconds: 240,
          },
        ],
      },
      {
        key: 'node-2:0',
        nodeId: 'NODE-02',
        gpuId: 0,
        util: 60,
        memUtil: 45,
        power: 140,
        limit: 320,
        temp: 67,
        fan: 50,
        type: 'MIXED',
        jobs: [
          {
            jobId: '#7894',
            name: 'diffusers-gen',
            workloadType: 'MIXED',
            priority: 'BATCH',
            tenant: 'team-genai',
            gpuUtilTarget: 60,
            memoryUtilTarget: 45,
            powerTargetWatts: 140,
            durationSeconds: 180,
          },
        ],
      },
      {
        key: 'node-2:1',
        nodeId: 'NODE-02',
        gpuId: 1,
        util: 10,
        memUtil: 15,
        power: 110,
        limit: 400,
        temp: 69,
        fan: 45,
        type: 'IDLE',
        jobs: [
          {
            jobId: '#7895',
            name: 'idle-cache-worker',
            workloadType: 'IDLE',
            priority: 'INTERACTIVE',
            tenant: 'default',
            gpuUtilTarget: 10,
            memoryUtilTarget: 15,
            powerTargetWatts: 110,
            durationSeconds: 600,
          },
        ],
      },
      {
        key: 'node-3:0',
        nodeId: 'NODE-03',
        gpuId: 0,
        util: 95,
        memUtil: 88,
        power: 165,
        limit: 400,
        temp: 82,
        fan: 88,
        type: 'COMPUTE_BOUND',
      },
      {
        key: 'node-3:1',
        nodeId: 'NODE-03',
        gpuId: 1,
        util: 88,
        memUtil: 90,
        power: 145,
        limit: 400,
        temp: 80,
        fan: 85,
        type: 'MEMORY_BOUND',
      },
      {
        key: 'node-4:0',
        nodeId: 'NODE-04',
        gpuId: 0,
        util: 98,
        memUtil: 95,
        power: 170,
        limit: 400,
        temp: 86,
        fan: 100,
        type: 'TRAINING',
      },
      {
        key: 'node-4:1',
        nodeId: 'NODE-04',
        gpuId: 1,
        util: 96,
        memUtil: 92,
        power: 150,
        limit: 400,
        temp: 84,
        fan: 100,
        type: 'MIXED',
      },
    ];

    for (const cfg of initialGpuConfigs) {
      const currentJobs: SimulatedJob[] = (cfg.jobs || []).map((j) => ({
        jobId: j.jobId || 'job-init',
        name: j.name || 'tensor-op',
        workloadType: j.workloadType || cfg.type,
        priority: j.priority || 'BATCH',
        tenant: j.tenant || 'default',
        gpuUtilTarget: j.gpuUtilTarget || cfg.util,
        memoryUtilTarget: j.memoryUtilTarget || cfg.memUtil,
        powerTargetWatts: j.powerTargetWatts || cfg.power,
        durationSeconds: j.durationSeconds || 300,
        startedAt: Date.now(),
        status: 'RUNNING',
        powerCapWatts: cfg.limit,
      }));

      const state: GPUState = {
        key: cfg.key,
        gpuId: cfg.gpuId,
        nodeId: cfg.nodeId,
        gpuUtil: cfg.util,
        memoryUtil: cfg.memUtil,
        memoryUsedMb: Math.round((cfg.memUtil / 100) * 40960),
        memoryTotalMb: 40960,
        powerDrawWatts: cfg.power,
        powerLimitWatts: cfg.limit,
        temperatureC: cfg.temp,
        clockMhz: 1410,
        fanPct: cfg.fan,
        workloadType: cfg.type,
        currentJobs,
        isThrottled: cfg.limit < 400 * 0.7,
      };

      this.gpus.set(cfg.key, state);
    }
  }

  private noise(val: number, sigma = 2.0, min = 0, max = 100): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u1 || 0.0001)) * Math.cos(2.0 * Math.PI * u2);
    const result = val + z * sigma;
    return Math.max(min, Math.min(max, result));
  }

  private computeWorkloadType(gpu: GPUState): WorkloadType {
    if (!gpu.currentJobs || gpu.currentJobs.length === 0) {
      return 'IDLE';
    }
    const types = new Set(gpu.currentJobs.map((j) => j.workloadType));
    if (types.size === 1) {
      return Array.from(types)[0];
    }
    return 'MIXED';
  }

  public tick(): GPUState[] {
    const now = Date.now();

    for (const [key, gpu] of this.gpus.entries()) {
      // Remove expired jobs
      gpu.currentJobs = gpu.currentJobs.filter((job) => {
        const elapsed = (now - job.startedAt) / 1000;
        return elapsed < job.durationSeconds;
      });

      if (gpu.currentJobs.length === 0) {
        // Idle state baseline
        gpu.gpuUtil = Math.round(this.noise(2.0, 1.0, 0, 10));
        gpu.memoryUtil = Math.round(this.noise(5.0, 1.5, 0, 15));
        gpu.powerDrawWatts = Math.round(this.noise(50.0, 4.0, 35, 75));
        gpu.temperatureC = Math.round(this.noise(36.0, 1.5, 30, 45));
        gpu.clockMhz = 300;
        gpu.fanPct = 25;
        gpu.workloadType = 'IDLE';
        gpu.isThrottled = false;
      } else {
        // Aggregate job targets
        let totalGpu = 0;
        let totalMem = 0;
        let totalPwr = 0;

        for (const job of gpu.currentJobs) {
          totalGpu += job.gpuUtilTarget;
          totalMem += job.memoryUtilTarget;
          totalPwr += job.powerTargetWatts;
        }

        // Apply hardware power limit capping
        const capRatio = Math.min(1.0, gpu.powerLimitWatts / Math.max(totalPwr, 1));
        const effectivePower = Math.min(totalPwr, gpu.powerLimitWatts);
        const effectiveGpu = Math.min(99.0, totalGpu * capRatio);

        gpu.gpuUtil = Math.round(this.noise(effectiveGpu, 2.5, 0, 99));
        gpu.memoryUtil = Math.round(this.noise(Math.min(totalMem, 96.0), 2.0, 0, 99));
        gpu.powerDrawWatts = Math.round(this.noise(effectivePower, 5.0, 40, gpu.powerLimitWatts));
        gpu.temperatureC = Math.round(this.noise(42.0 + effectivePower * 0.12, 1.5, 40, 92));
        gpu.clockMhz = Math.round(1410.0 * capRatio);
        gpu.fanPct = Math.round(Math.min(100, Math.max(30, (gpu.temperatureC - 45) * 2.2)));
        gpu.workloadType = this.computeWorkloadType(gpu);
        gpu.isThrottled = gpu.powerLimitWatts < 400 * 0.7;
      }

      gpu.memoryUsedMb = Math.round((gpu.memoryUtil / 100.0) * gpu.memoryTotalMb);
    }

    const snapshot = this.snapshot();
    for (const listener of this.onTickListeners) {
      listener(snapshot);
    }
    return snapshot;
  }

  public submitJob(gpuKey: string, job: SimulatedJob): boolean {
    const gpu = this.gpus.get(gpuKey);
    if (!gpu) return false;
    job.startedAt = Date.now();
    job.gpuKey = gpuKey;
    gpu.currentJobs.push(job);
    this.tick();
    return true;
  }

  public setPowerLimit(gpuKey: string, watts: number): boolean {
    const gpu = this.gpus.get(gpuKey);
    if (!gpu) return false;
    gpu.powerLimitWatts = watts;
    gpu.isThrottled = watts < 400 * 0.7;
    this.tick();
    return true;
  }

  public evictJobs(gpuKey: string): number {
    const gpu = this.gpus.get(gpuKey);
    if (!gpu) return 0;
    const count = gpu.currentJobs.length;
    gpu.currentJobs = [];
    this.tick();
    return count;
  }

  public prewarmNode(nodeId: string): boolean {
    let touched = false;
    for (const [_, gpu] of this.gpus.entries()) {
      if (gpu.nodeId === nodeId) {
        gpu.clockMhz = 1410;
        gpu.powerDrawWatts = Math.max(gpu.powerDrawWatts, 120); // Warm state
        gpu.temperatureC = Math.max(gpu.temperatureC, 45);
        touched = true;
      }
    }
    this.tick();
    return touched;
  }

  public snapshot(): GPUState[] {
    return Array.from(this.gpus.values());
  }

  public startLoop(intervalMs = 3000) {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), intervalMs);
  }

  public stopLoop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
