import { ClusterNode, Job, ModelParams } from '../types';

export interface ApiForecastResponse {
  windowStart: string;
  windowEnd: string;
  predictedGpuDemand: number;
  confidence: number;
  recommendedAction: string;
  modelMae: number;
  modelR2: number;
  featuresUsed: string[];
}

export interface ApiEnergySummary {
  currentClusterPowerW: number;
  baselineClusterPowerW: number;
  liveSavingsPct: number;
  totalAeroWh: number;
  totalBaselineWh: number;
  totalSavedWh: number;
  cumulativeSavingsPct: number;
  formula: string;
  completedJobs: Array<{
    jobId: string;
    name?: string;
    durationSeconds: number;
    energyWh: number;
    baselineWh: number;
    savedWh: number;
    savingPct: number;
    avgWatts: number;
    completedAt: string;
  }>;
}

export const api = {
  // Check backend health
  async checkHealth() {
    try {
      const res = await fetch('/api/health');
      return await res.json();
    } catch (e) {
      console.warn('Backend health check fallback:', e);
      return { status: 'offline' };
    }
  },

  // Fetch nodes with telemetry
  async getNodes(): Promise<ClusterNode[]> {
    try {
      const res = await fetch('/api/cluster/nodes');
      if (!res.ok) throw new Error('Failed to fetch nodes');
      const data = await res.json();
      return data.nodes.map((n: any) => ({
        id: n.node_id,
        name: n.node_id.toUpperCase(),
        status: 'ONLINE',
        tempC: n.gpus.length > 0 ? n.gpus[0].temperature_c : 35,
        powerW: n.total_power_w,
        vramPct: n.gpus.length > 0 ? n.gpus[0].memory_util : 0,
        fanPct: 50,
        gpus: n.gpus.map((g: any) => ({
          id: `GPU${g.gpu_id}`,
          label: `GPU${g.gpu_id}`,
          type: g.workload_type === 'COMPUTE_BOUND' ? 'Compute-Bound' : 
                g.workload_type === 'MEMORY_BOUND' ? 'Memory-Bound' : 
                g.workload_type === 'MIXED' ? 'Mixed Workload' : 'Idle',
          utilization: g.gpu_util,
          isThrottled: g.power_limit_watts && g.power_draw_watts > 0 && g.power_limit_watts < 300, 
          powerW: g.power_draw_watts,
          tempC: g.temperature_c,
          vramPct: g.memory_util
        }))
      }));
    } catch (e) {
      console.warn('Using local fallback nodes:', e);
      return [];
    }
  },

  // Fetch job queue
  async getJobQueue(): Promise<Job[]> {
    try {
      const res = await fetch('/api/jobs/queue');
      if (!res.ok) throw new Error('Failed to fetch job queue');
      const data = await res.json();
      return data.jobs.map((j: any) => ({
        id: j.job_id,
        name: j.name,
        type: j.workload_type,
        priority: j.priority,
        node: j.gpu_key?.split(':')[0] || 'Unknown',
        durationHours: j.duration_s ? j.duration_s / 3600 : 1,
        submittedAt: new Date(j.submitted_at * 1000).toISOString(),
        status: j.status,
        gpuAllocated: j.gpu_key,
        powerDrawW: j.power_cap_w
      }));
    } catch (e) {
      console.warn('Using local fallback jobs:', e);
      return [];
    }
  },

  // Submit new workload
  async submitJob(payload: {
    name: string;
    workload_type?: string;
    priority?: string;
    tenant?: string;
    duration_seconds?: number;
    node?: string;
    preferred_gpu?: string;
  }) {
    const res = await fetch('/api/jobs/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to submit job');
    return await res.json();
  },

  // Delete job
  async deleteJob(jobId: string) {
    const res = await fetch(`/api/jobs/${jobId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to delete job ${jobId}`);
    return await res.json();
  },

  // Fetch ML Forecast
  async getForecast(): Promise<ApiForecastResponse> {
    const res = await fetch('/api/forecast');
    if (!res.ok) throw new Error('Failed to fetch forecast');
    return await res.json();
  },

  // Fetch Model Info
  async getModelInfo() {
    const res = await fetch('/api/forecast/model-info');
    if (!res.ok) throw new Error('Failed to fetch model info');
    return await res.json();
  },

  // Update Forecaster Hyperparameters
  async updateForecastParams(params: ModelParams) {
    const res = await fetch('/api/forecast/params', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Failed to update forecast params');
    return await res.json();
  },

  // Fetch Energy Summary
  async getEnergySummary(): Promise<ApiEnergySummary> {
    const res = await fetch('/api/energy/summary');
    if (!res.ok) throw new Error('Failed to fetch energy summary');
    return await res.json();
  },

  // Pre-warm node
  async prewarmNode(nodeId = 'NODE-03') {
    const res = await fetch('/api/cluster/prewarm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId }),
    });
    if (!res.ok) throw new Error('Failed to pre-warm node');
    return await res.json();
  },

  // Throttle / set power cap
  async throttlePower(gpuId: string, powerLimitWatts: number) {
    try {
      const formattedGpuId = gpuId.replace(':', '__');
      const res = await fetch(`/api/power/throttle/${formattedGpuId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watts: powerLimitWatts }),
      });
      return await res.json();
    } catch (e) {
      return { success: true, gpuId, powerLimitWatts };
    }
  },

  // Rolling cluster restart
  async restartCluster() {
    const res = await fetch('/api/cluster/restart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Failed to restart cluster');
    return await res.json();
  },

  // Fetch logs
  async getLogs() {
    try {
      const res = await fetch('/api/logs');
      if (!res.ok) throw new Error('Failed to fetch logs');
      const data = await res.json();
      return data.logs;
    } catch (e) {
      return [];
    }
  },

  // Execute demo scenario (Scenario 1, 2, or 3)
  async runDemoScenario(scenarioId: '1' | '2' | '3') {
    const res = await fetch(`/api/demo/run-scenario/${scenarioId}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to run scenario ${scenarioId}`);
    return await res.json();
  },
};
