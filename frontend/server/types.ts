export type WorkloadType = 'IDLE' | 'COMPUTE_BOUND' | 'MEMORY_BOUND' | 'MIXED' | 'TRAINING';
export type JobPriority = 'CRITICAL' | 'INTERACTIVE' | 'BATCH' | 'IDLE_WARMTH';

export interface SimulatedJob {
  jobId: string;
  name: string;
  workloadType: WorkloadType;
  priority: JobPriority;
  tenant: string;
  gpuUtilTarget: number;
  memoryUtilTarget: number;
  powerTargetWatts: number;
  durationSeconds: number;
  startedAt: number;
  gpuKey?: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PREEMPTED';
  powerCapWatts?: number;
}

export interface GPUState {
  key: string;
  gpuId: number;
  nodeId: string;
  gpuUtil: number;
  memoryUtil: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  powerDrawWatts: number;
  powerLimitWatts: number;
  temperatureC: number;
  clockMhz: number;
  fanPct: number;
  workloadType: WorkloadType;
  currentJobs: SimulatedJob[];
  isThrottled?: boolean;
}

export interface NodeMetrics {
  nodeName: string;
  gpuUtil: number;
  memoryUtil: number;
  powerDrawWatts: number;
  powerLimitWatts: number;
  powerBudgetRemaining: number;
  powerBudgetTotal: number;
  workloadClass: WorkloadType;
  jobsCompletedByTenant: number;
  totalJobsCompleted: number;
  tempC?: number;
  fanPct?: number;
}

export interface IncomingJobSpec {
  jobId: string;
  name: string;
  tenant: string;
  priority: JobPriority;
  workloadClass: WorkloadType;
  gpuUtilTarget?: number;
  memoryUtilTarget?: number;
  powerTargetWatts?: number;
  durationSeconds?: number;
  preferredGpu?: string;
}

export interface PlacementDecision {
  nodeName: string;
  score: number;
  makespanScore: number;
  fairnessScore: number;
  energyScore: number;
  colocationMultiplier: number;
  rationale: string;
  recommendedGpuKey?: string;
}

export interface EnergyRecord {
  jobId: string;
  name?: string;
  durationSeconds: number;
  energyWh: number;
  baselineWh: number;
  savedWh: number;
  savingPct: number;
  avgWatts: number;
  completedAt: string;
}

export interface LogRecord {
  id: string;
  time: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SCHED';
  node: string;
  message: string;
}

export interface AnomalyRecord {
  id: string;
  timestamp: string;
  title: string;
  detail: string;
  severity: 'warning' | 'success' | 'error' | 'info';
}
