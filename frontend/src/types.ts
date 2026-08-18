export type ViewType = 'dashboard' | 'analytics' | 'forecaster' | 'cluster' | 'topology';

export type JobType = 'COMPUTE_BOUND' | 'MEMORY_BOUND' | 'MIXED';
export type JobPriority = 'BATCH' | 'INTERACTIVE' | 'CRITICAL';

export interface Job {
  id: string;
  name: string;
  type: JobType;
  priority: JobPriority;
  node: string;
  durationHours: number;
  submittedAt: string;
  status: 'RUNNING' | 'QUEUED' | 'COMPLETED' | 'THROTTLED';
  gpuAllocated?: string;
  powerDrawW?: number;
}

export interface GpuStatus {
  id: string;
  label: string;
  type: 'Compute-Bound' | 'Memory-Bound' | 'Mixed Workload' | 'Idle' | 'Training';
  utilization: number;
  isThrottled?: boolean;
  powerW: number;
  tempC: number;
  vramPct: number;
}

export interface ClusterNode {
  id: string;
  name: string;
  status: 'ONLINE' | 'STANDBY' | 'WARNING' | 'OFFLINE';
  gpus: GpuStatus[];
  tempC: number;
  powerW: number;
  vramPct: number;
  fanPct: number;
  isPrewarming?: boolean;
}

export interface ForecastPoint {
  time: string;
  actual: number | null;
  forecast: number;
  lower: number;
  upper: number;
}

export interface AnomalyLog {
  id: string;
  timestamp: string;
  title: string;
  detail: string;
  severity: 'warning' | 'success' | 'error' | 'info';
}

export interface SchedulingDecision {
  id: string;
  timestamp: string;
  workload: string;
  targetNode: string;
  score: number;
  colocMultiplier: number;
}

export interface ModelParams {
  alpha: number;
  horizonHours: number;
  confidenceInterval: number;
  learningRate: number;
  anomalyThreshold: number;
}
