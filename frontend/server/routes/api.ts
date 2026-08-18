import { Router, Request, Response } from 'express';
import {
  simulator,
  profiler,
  forecaster,
  scoring,
  powerCtrl,
  demoManager,
  logsBuffer,
  logSink,
  jobStore,
  getAggregatedNodes,
} from '../engine';
import {
  IncomingJobSpec,
  SimulatedJob,
  NodeMetrics,
  WorkloadType,
  JobPriority,
} from '../types';

export const apiRouter = Router();

// Health check
apiRouter.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'aero-api-gateway',
    layers: {
      layer0_simulator: 'ACTIVE',
      layer1_interference_profiler: 'ACTIVE',
      layer2_ml_forecaster: 'ACTIVE',
      layer3_scoring_engine: 'ACTIVE',
      layer4_scheduler_extender: 'ACTIVE',
      layer5_power_capping: 'ACTIVE',
    },
    timestamp: new Date().toISOString(),
  });
});

// Cluster Nodes with aggregated telemetry
apiRouter.get('/cluster/nodes', (req: Request, res: Response) => {
  res.json({ nodes: getAggregatedNodes() });
});

// All individual GPUs
apiRouter.get('/cluster/gpus', (req: Request, res: Response) => {
  res.json({ gpus: simulator.snapshot() });
});

// Pending + Running Job Queue
apiRouter.get('/jobs/queue', (req: Request, res: Response) => {
  const gpus = simulator.snapshot();
  const runningJobs: any[] = [];

  for (const g of gpus) {
    for (const j of g.currentJobs) {
      runningJobs.push({
        id: j.jobId,
        name: j.name,
        type: j.workloadType,
        priority: j.priority,
        node: g.nodeId === 'NODE-01' ? 'N-01' : g.nodeId === 'NODE-02' ? 'N-02' : 'N-03',
        durationHours: Number((j.durationSeconds / 3600).toFixed(2)),
        submittedAt: new Date(j.startedAt).toTimeString().split(' ')[0],
        status: j.status || 'RUNNING',
        gpuAllocated: `${g.nodeId} / GPU${g.gpuId}`,
        powerDrawW: g.powerDrawWatts / Math.max(1, g.currentJobs.length),
      });
    }
  }

  res.json({ jobs: runningJobs });
});

// Job Submission with multi-objective placement scoring & power capping
apiRouter.post('/jobs/submit', (req: Request, res: Response) => {
  const {
    name = 'tensor-job',
    workload_type = 'COMPUTE_BOUND',
    priority = 'INTERACTIVE',
    tenant = 'default',
    duration_seconds = 180,
    gpu_util_target = 75,
    memory_util_target = 35,
    power_target_watts = 280,
    preferred_gpu,
    node,
  } = req.body || {};

  const jobId = `#${Math.floor(Math.random() * 900 + 7900)}`;

  const incomingJob: IncomingJobSpec = {
    jobId,
    name,
    tenant,
    priority: (priority as JobPriority) || 'INTERACTIVE',
    workloadClass: (workload_type as WorkloadType) || 'COMPUTE_BOUND',
    durationSeconds: Number(duration_seconds) || 180,
    gpuUtilTarget: Number(gpu_util_target) || 75,
    memoryUtilTarget: Number(memory_util_target) || 35,
    powerTargetWatts: Number(power_target_watts) || 280,
    preferredGpu: preferred_gpu,
  };

  // Calculate candidate node metrics
  const gpus = simulator.snapshot();
  const candidateNodes: NodeMetrics[] = [
    {
      nodeName: 'node-1:0',
      gpuUtil: gpus.find((g) => g.key === 'node-1:0')?.gpuUtil || 40,
      memoryUtil: gpus.find((g) => g.key === 'node-1:0')?.memoryUtil || 30,
      powerDrawWatts: gpus.find((g) => g.key === 'node-1:0')?.powerDrawWatts || 160,
      powerLimitWatts: 400,
      powerBudgetRemaining: 500,
      powerBudgetTotal: 800,
      workloadClass: gpus.find((g) => g.key === 'node-1:0')?.workloadType || 'COMPUTE_BOUND',
      jobsCompletedByTenant: 2,
      totalJobsCompleted: 10,
    },
    {
      nodeName: 'node-2:0',
      gpuUtil: gpus.find((g) => g.key === 'node-2:0')?.gpuUtil || 30,
      memoryUtil: gpus.find((g) => g.key === 'node-2:0')?.memoryUtil || 20,
      powerDrawWatts: gpus.find((g) => g.key === 'node-2:0')?.powerDrawWatts || 140,
      powerLimitWatts: 400,
      powerBudgetRemaining: 600,
      powerBudgetTotal: 800,
      workloadClass: gpus.find((g) => g.key === 'node-2:0')?.workloadType || 'MIXED',
      jobsCompletedByTenant: 1,
      totalJobsCompleted: 10,
    },
  ];

  const ranking = scoring.rankNodes(candidateNodes, incomingJob);
  const bestDecision = ranking[0];

  // Select target GPU
  let targetGpuKey = preferred_gpu || bestDecision.nodeName || 'node-1:0';
  if (node === 'N-02') targetGpuKey = 'node-2:0';
  if (node === 'N-01') targetGpuKey = 'node-1:0';

  const simJob: SimulatedJob = {
    jobId,
    name,
    workloadType: incomingJob.workloadClass,
    priority: incomingJob.priority,
    tenant: incomingJob.tenant,
    gpuUtilTarget: incomingJob.gpuUtilTarget!,
    memoryUtilTarget: incomingJob.memoryUtilTarget!,
    powerTargetWatts: incomingJob.powerTargetWatts!,
    durationSeconds: incomingJob.durationSeconds!,
    startedAt: Date.now(),
    status: 'RUNNING',
    gpuKey: targetGpuKey,
  };

  simulator.submitJob(targetGpuKey, simJob);
  const appliedCap = powerCtrl.applyPowerPolicy(jobId, targetGpuKey, simJob.priority, simJob.name);
  jobStore.set(jobId, simJob);

  logSink({
    id: Math.random().toString(),
    time: new Date().toTimeString().split(' ')[0] + '.012',
    level: 'SCHED',
    node: targetGpuKey,
    message: `Job ${jobId} (${name}) placed with score ${bestDecision.score}. Power capped to ${appliedCap}W. ${bestDecision.rationale}`,
  });

  res.json({
    success: true,
    jobId,
    name,
    allocatedGpu: targetGpuKey,
    powerCapWatts: appliedCap,
    schedulingDecision: bestDecision,
    status: 'RUNNING',
  });
});

// ML Demand Forecast
apiRouter.get('/forecast', (req: Request, res: Response) => {
  const gpus = simulator.snapshot();
  const avgUtil = gpus.reduce((a, b) => a + b.gpuUtil, 0) / Math.max(1, gpus.length);
  const totalQueue = gpus.reduce((a, b) => a + b.currentJobs.length, 0);

  const forecast = forecaster.predict(avgUtil, totalQueue, 3.7);
  res.json(forecast);
});

apiRouter.get('/forecast/model-info', (req: Request, res: Response) => {
  res.json(forecaster.getModelInfo());
});

apiRouter.get('/forecast/history', (req: Request, res: Response) => {
  res.json({ history: forecaster.getHistory(20) });
});

apiRouter.post('/forecast/params', (req: Request, res: Response) => {
  forecaster.setParams(req.body || {});
  logSink({
    id: Math.random().toString(),
    time: new Date().toTimeString().split(' ')[0] + '.000',
    level: 'INFO',
    node: 'forecaster-v3',
    message: `ML hyperparameters updated: alpha=${req.body?.alpha}, horizon=${req.body?.horizonHours}h. Retrained.`,
  });
  res.json({ success: true, updatedParams: forecaster.getParams() });
});

// Energy Summary & Savings vs Baseline K8s
apiRouter.get('/energy/summary', (req: Request, res: Response) => {
  res.json(powerCtrl.getEnergySummary());
});

// Kubernetes Extender Endpoints (Filter, Score, Preempt)
apiRouter.post('/scheduler/filter', (req: Request, res: Response) => {
  const { Nodes } = req.body || {};
  const items = Nodes?.items || Nodes || [];
  res.json({
    Nodes: { items },
    FailedNodes: {},
    Error: '',
  });
});

apiRouter.post('/scheduler/score', (req: Request, res: Response) => {
  const { Nodes } = req.body || {};
  const items = Nodes?.items || Nodes || [];
  const scores = items.map((node: any, idx: number) => ({
    Host: node.metadata?.name || `node-${idx + 1}`,
    Score: Math.round(75 + Math.random() * 20),
  }));
  res.json({ HostPriorityList: scores, Error: '' });
});

apiRouter.post('/scheduler/preempt', (req: Request, res: Response) => {
  res.json({
    nominatedNodeName: 'node-1',
    preemptionVictims: {
      'node-1': {
        pods: [{ namespace: 'aero', name: 'batch-preproc-01' }],
        numPDBViolations: 0,
      },
    },
    Error: '',
  });
});

// Power throttle control (REST with parameter)
apiRouter.post('/power/throttle/:gpu_id', (req: Request, res: Response) => {
  const gpuKey = req.params.gpu_id.replace('__', ':');
  const watts = Number(req.body?.watts) || 240;
  const ok = simulator.setPowerLimit(gpuKey, watts);
  logSink({
    id: Math.random().toString(),
    time: new Date().toTimeString().split(' ')[0] + '.100',
    level: 'WARN',
    node: gpuKey,
    message: `Manual power cap enforced: ${watts}W (DVFS throttle)`,
  });
  res.json({ success: ok, gpuKey, newLimitWatts: watts });
});

// Power cap route (JSON body)
apiRouter.post('/power/cap', (req: Request, res: Response) => {
  const { gpuId = 'NODE-01:0', powerLimitWatts = 320 } = req.body || {};
  const gpuKey = String(gpuId).toLowerCase().replace('node-0', 'node-').replace('node-a0', 'node-');
  const watts = Number(powerLimitWatts) || 320;
  const ok = simulator.setPowerLimit(gpuKey, watts);
  logSink({
    id: Math.random().toString(),
    time: new Date().toTimeString().split(' ')[0] + '.100',
    level: 'WARN',
    node: gpuKey,
    message: `Dynamic NVML power envelope updated: ${watts}W`,
  });
  res.json({ success: ok, gpuId, powerLimitWatts: watts });
});

// Pre-warm node
apiRouter.post('/cluster/prewarm', (req: Request, res: Response) => {
  const { nodeId = 'NODE-03' } = req.body || {};
  const ok = simulator.prewarmNode(nodeId);
  logSink({
    id: Math.random().toString(),
    time: new Date().toTimeString().split(' ')[0] + '.400',
    level: 'INFO',
    node: nodeId,
    message: `⚡ Node ${nodeId} PCIe bus pre-warmed & memory buffers hydrated. Surge ready.`,
  });
  res.json({ success: ok, nodeId, status: 'WARM_STANDBY' });
});

// Cluster restart
apiRouter.post('/cluster/restart', (req: Request, res: Response) => {
  logSink({
    id: Math.random().toString(),
    time: new Date().toTimeString().split(' ')[0] + '.000',
    level: 'WARN',
    node: 'k8s-master',
    message: 'Rolling restart initiated on 24 daemonsets. Draining healthy.',
  });
  res.json({ success: true, message: 'Cluster rolling restart initiated.' });
});

// Logs stream
apiRouter.get('/logs', (req: Request, res: Response) => {
  res.json({ logs: logsBuffer });
});

// Demo Scenarios runner
apiRouter.post('/demo/run-scenario/:id', async (req: Request, res: Response) => {
  const id = req.params.id;
  if (id === '1') {
    const result = await demoManager.runScenario1();
    return res.json(result);
  } else if (id === '2') {
    const result = await demoManager.runScenario2();
    return res.json(result);
  } else if (id === '3') {
    const result = await demoManager.runScenario3();
    return res.json(result);
  }
  res.status(400).json({ error: 'Invalid scenario ID. Expected 1, 2, or 3.' });
});
