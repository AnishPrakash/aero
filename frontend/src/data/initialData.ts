import { ClusterNode, Job, ForecastPoint, AnomalyLog, SchedulingDecision, ModelParams } from '../types';

export const initialNodes: ClusterNode[] = [
  {
    id: 'NODE-01',
    name: 'NODE-A01',
    status: 'ONLINE',
    tempC: 72,
    powerW: 285,
    vramPct: 78,
    fanPct: 65,
    gpus: [
      {
        id: 'GPU0',
        label: 'GPU0',
        type: 'Compute-Bound',
        utilization: 85,
        powerW: 160,
        tempC: 74,
        vramPct: 82,
      },
      {
        id: 'GPU1',
        label: 'GPU1',
        type: 'Memory-Bound',
        utilization: 40,
        isThrottled: true,
        powerW: 125,
        tempC: 70,
        vramPct: 74,
      },
    ],
  },
  {
    id: 'NODE-02',
    name: 'NODE-A02',
    status: 'ONLINE',
    tempC: 68,
    powerW: 250,
    vramPct: 45,
    fanPct: 50,
    gpus: [
      {
        id: 'GPU0',
        label: 'GPU0',
        type: 'Mixed Workload',
        utilization: 60,
        powerW: 140,
        tempC: 67,
        vramPct: 55,
      },
      {
        id: 'GPU1',
        label: 'GPU1',
        type: 'Idle',
        utilization: 10,
        powerW: 110,
        tempC: 69,
        vramPct: 35,
      },
    ],
  },
  {
    id: 'NODE-03',
    name: 'NODE-A03',
    status: 'ONLINE',
    tempC: 81,
    powerW: 310,
    vramPct: 92,
    fanPct: 88,
    gpus: [
      {
        id: 'GPU0',
        label: 'GPU0',
        type: 'Compute-Bound',
        utilization: 95,
        powerW: 165,
        tempC: 82,
        vramPct: 94,
      },
      {
        id: 'GPU1',
        label: 'GPU1',
        type: 'Memory-Bound',
        utilization: 88,
        powerW: 145,
        tempC: 80,
        vramPct: 90,
      },
    ],
  },
  {
    id: 'NODE-04',
    name: 'NODE-B01',
    status: 'WARNING',
    tempC: 85,
    powerW: 320,
    vramPct: 98,
    fanPct: 100,
    gpus: [
      {
        id: 'GPU0',
        label: 'GPU0',
        type: 'Training',
        utilization: 98,
        powerW: 170,
        tempC: 86,
        vramPct: 99,
      },
      {
        id: 'GPU1',
        label: 'GPU1',
        type: 'Mixed Workload',
        utilization: 96,
        powerW: 150,
        tempC: 84,
        vramPct: 97,
      },
    ],
  },
];

export const initialJobs: Job[] = [
  {
    id: '#7892',
    name: 'bert-train-opt',
    type: 'CRITICAL',
    priority: 'CRITICAL',
    node: 'N-01',
    durationHours: 3.5,
    submittedAt: '14:02:11',
    status: 'RUNNING',
    gpuAllocated: 'NODE-01 / GPU0',
    powerDrawW: 160,
  },
  {
    id: '#7893',
    name: 'llama-interactive-query',
    type: 'INTERACTIVE',
    priority: 'HIGH',
    node: 'N-01',
    durationHours: 1.0,
    submittedAt: '13:52:19',
    status: 'RUNNING',
    gpuAllocated: 'NODE-01 / GPU1',
    powerDrawW: 125,
  },
  {
    id: '#7894',
    name: 'data-prep-etl-batch',
    type: 'BATCH',
    priority: 'STANDARD',
    node: 'N-02',
    durationHours: 6.0,
    submittedAt: '13:45:00',
    status: 'RUNNING',
    gpuAllocated: 'NODE-02 / GPU0',
    powerDrawW: 140,
  },
  {
    id: '#7895',
    name: 'diffusers-realtime-gen',
    type: 'INTERACTIVE',
    priority: 'HIGH',
    node: 'N-02',
    durationHours: 2.0,
    submittedAt: '13:30:14',
    status: 'RUNNING',
    gpuAllocated: 'NODE-02 / GPU1',
    powerDrawW: 110,
  },
  {
    id: '#7896',
    name: 'nightly-checkpoint-eval',
    type: 'BATCH',
    priority: 'STANDARD',
    node: 'Q',
    durationHours: 4.5,
    submittedAt: '14:15:02',
    status: 'QUEUED',
    powerDrawW: 0,
  },
];

export const forecastData24H: ForecastPoint[] = [
  { time: '00:00', actual: 4000, forecast: 4200, lower: 3800, upper: 4600 },
  { time: '04:00', actual: 3000, forecast: 3200, lower: 2900, upper: 3500 },
  { time: '08:00', actual: 2000, forecast: 2400, lower: 2100, upper: 2700 },
  { time: '12:00', actual: 2780, forecast: 2900, lower: 2500, upper: 3300 },
  { time: '16:00', actual: 1890, forecast: 2100, lower: 1800, upper: 2400 },
  { time: '20:00', actual: 2390, forecast: 2500, lower: 2200, upper: 2800 },
  { time: 'Now', actual: 3490, forecast: 3600, lower: 3200, upper: 4000 },
  { time: '+4h', actual: null, forecast: 4300, lower: 3800, upper: 4800 },
  { time: '+8h', actual: null, forecast: 5100, lower: 4400, upper: 5800 },
  { time: '+12h', actual: null, forecast: 4800, lower: 4000, upper: 5600 },
];

export const forecastData1H: ForecastPoint[] = [
  { time: 'T-50m', actual: 3100, forecast: 3150, lower: 2950, upper: 3350 },
  { time: 'T-40m', actual: 3250, forecast: 3200, lower: 3050, upper: 3400 },
  { time: 'T-30m', actual: 3300, forecast: 3320, lower: 3150, upper: 3500 },
  { time: 'T-20m', actual: 3420, forecast: 3400, lower: 3200, upper: 3600 },
  { time: 'T-10m', actual: 3480, forecast: 3510, lower: 3300, upper: 3750 },
  { time: 'Now', actual: 3490, forecast: 3600, lower: 3350, upper: 3850 },
  { time: '+10m', actual: null, forecast: 3850, lower: 3500, upper: 4200 },
  { time: '+20m', actual: null, forecast: 4100, lower: 3700, upper: 4500 },
  { time: '+30m', actual: null, forecast: 4350, lower: 3900, upper: 4800 },
  { time: '+40m', actual: null, forecast: 4400, lower: 3950, upper: 4900 },
];

export const forecastData7D: ForecastPoint[] = [
  { time: 'Mon', actual: 18500, forecast: 19000, lower: 17500, upper: 20500 },
  { time: 'Tue', actual: 21200, forecast: 20800, lower: 19500, upper: 22000 },
  { time: 'Wed', actual: 24500, forecast: 24000, lower: 22500, upper: 25500 },
  { time: 'Thu', actual: 23100, forecast: 23500, lower: 21800, upper: 25000 },
  { time: 'Fri', actual: 26800, forecast: 26000, lower: 24500, upper: 27500 },
  { time: 'Sat', actual: 14200, forecast: 14500, lower: 13000, upper: 16000 },
  { time: 'Sun', actual: null, forecast: 16200, lower: 14500, upper: 18000 },
  { time: '+1D', actual: null, forecast: 22400, lower: 20000, upper: 25000 },
];

export const initialAnomalies: AnomalyLog[] = [
  {
    id: 'a1',
    timestamp: '14:02:11',
    title: 'SPAWN_SURGE_DETECTED',
    detail: 'Cluster A3 - Expected +45% delta in next compute window',
    severity: 'warning',
  },
  {
    id: 'a2',
    timestamp: '13:45:00',
    title: 'MODEL_UPDATE_OK',
    detail: 'Weights synchronized across 24 nodes (latency 12ms)',
    severity: 'success',
  },
  {
    id: 'a3',
    timestamp: '12:10:44',
    title: 'NODE_DROPPED',
    detail: 'Node-7 unreachable during health probe - auto-redistributing',
    severity: 'error',
  },
  {
    id: 'a4',
    timestamp: '11:00:00',
    title: 'CRON_MAINTENANCE',
    detail: 'Routine log rotation and cache cleanup completed',
    severity: 'info',
  },
];

export const initialSchedulingDecisions: SchedulingDecision[] = [
  { id: 'sd1', timestamp: '14:02:11', workload: 'bert-train', targetNode: 'node-a01', score: 87.4, colocMultiplier: 1.3 },
  { id: 'sd2', timestamp: '14:02:08', workload: 'gpt2-finetune', targetNode: 'node-a03', score: 92.1, colocMultiplier: 1.5 },
  { id: 'sd3', timestamp: '14:01:45', workload: 'resnet-eval', targetNode: 'node-b01', score: 65.2, colocMultiplier: 1.0 },
  { id: 'sd4', timestamp: '14:00:12', workload: 'db-backup', targetNode: 'node-a02', score: 24.5, colocMultiplier: 0.2 },
  { id: 'sd5', timestamp: '13:58:33', workload: 'vit-train', targetNode: 'node-a01', score: 88.9, colocMultiplier: 1.2 },
  { id: 'sd6', timestamp: '13:55:01', workload: 'data-prep-01', targetNode: 'node-b02', score: 55.0, colocMultiplier: 1.0 },
  { id: 'sd7', timestamp: '13:52:19', workload: 'llama-inf', targetNode: 'node-a03', score: 95.5, colocMultiplier: 1.4 },
  { id: 'sd8', timestamp: '13:48:44', workload: 'diffusers-gen', targetNode: 'node-a02', score: 78.2, colocMultiplier: 1.1 },
  { id: 'sd9', timestamp: '13:45:00', workload: 'metrics-agg', targetNode: 'node-b01', score: 32.1, colocMultiplier: 0.5 },
  { id: 'sd10', timestamp: '13:40:11', workload: 'yolo-train', targetNode: 'node-a01', score: 82.0, colocMultiplier: 1.2 },
];

export const interferenceMatrixData = {
  types: ['LLM', 'CV', 'IO', 'DB'],
  grid: [
    // LLM row
    [
      { label: '0.2×', type: 'danger', desc: 'Severe GPU memory bandwidth contention & cache thrashing' },
      { label: '1.0×', type: 'neutral', desc: 'Orthogonal resource utilization (compute vs memory)' },
      { label: '1.3×', type: 'positive', desc: 'High IO pipelining synergy with async token generation' },
      { label: '1.5×', type: 'positive', desc: 'Zero compute interference with background indexing' },
    ],
    // CV row
    [
      { label: '1.0×', type: 'neutral', desc: 'Standard tensor core scheduling' },
      { label: '0.4×', type: 'danger', desc: 'PCIe bus saturation during heavy video tensor streaming' },
      { label: '1.2×', type: 'positive', desc: 'Complementary CUDA stream interleaving' },
      { label: '1.0×', type: 'neutral', desc: 'Independent storage and NVLink channels' },
    ],
    // IO row
    [
      { label: '1.3×', type: 'positive', desc: 'Kernel overlap during token queue extraction' },
      { label: '1.2×', type: 'positive', desc: 'DMA transfer pipelining during forward pass' },
      { label: '0.1×', type: 'danger', desc: 'Severe NVMe queue lockup & disk head thrashing' },
      { label: '0.3×', type: 'danger', desc: 'Contention on shared POSIX file descriptor table' },
    ],
    // DB row
    [
      { label: '1.5×', type: 'positive', desc: 'CPU bound transactional logging with GPU compute' },
      { label: '1.0×', type: 'neutral', desc: 'Standard host memory isolation' },
      { label: '0.3×', type: 'danger', desc: 'I/O wait stalls affecting write-ahead logging (WAL)' },
      { label: '0.2×', type: 'danger', desc: 'Concurrent lock contention & index rebuilding collisions' },
    ],
  ],
};

export const jobEnergyBarData = [
  { name: 'Job_A', baseline: 210, aero: 110, desc: 'BERT fine-tuning 124M params' },
  { name: 'Job_B', baseline: 155, aero: 90, desc: 'Whisper audio transcription batch' },
  { name: 'Job_C', baseline: 248, aero: 135, desc: 'Stable Diffusion XL inference engine' },
  { name: 'Job_D', baseline: 105, aero: 85, desc: 'Parquet ETL vector compression' },
  { name: 'Job_E', baseline: 175, aero: 75, desc: 'LLaMA 3 8B continuous KV caching' },
];

export const powerPolicies = [
  { class: 'CRITICAL', capW: 400.0, priority: 'P0', color: 'text-neon', dotBg: 'bg-[#00FF41]', desc: 'Unconstrained clock boost, guaranteed zero-throttle execution' },
  { class: 'INTERACTIVE', capW: 320.0, priority: 'P1', color: 'text-on-surface', dotBg: 'bg-[#888888]', desc: 'Dynamic DVFS scaling, prioritized memory burst' },
  { class: 'BATCH', capW: 240.0, priority: 'P2', color: 'text-on-surface', dotBg: 'bg-[#555555]', desc: 'Green energy cap with opportunistic compute bursts' },
  { class: 'Idle', capW: 120.0, priority: 'P3', color: 'text-[#A0A0A0]', dotBg: 'border border-[#555555]', desc: 'Ultra-low C-state standby power gating' },
];

export const defaultModelParams: ModelParams = {
  alpha: 0.85,
  horizonHours: 24,
  confidenceInterval: 95,
  learningRate: 0.003,
  anomalyThreshold: 2.5,
};
