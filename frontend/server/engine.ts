import { GPUSimulator } from './simulator';
import { InterferenceProfiler } from './interference';
import { MLForecasterEngine } from './forecaster';
import { ScoringEngine } from './scoring';
import { PowerController } from './power';
import { DemoScenarioManager } from './demoScenarios';
import { LogRecord, SimulatedJob } from './types';

// In-memory system logs buffer
export const logsBuffer: LogRecord[] = [
  { id: '1', time: '14:32:00.124', level: 'INFO', node: 'fabric-ctrl', message: 'Heartbeat verified on 24 node probes. Latency p99=14ms.' },
  { id: '2', time: '14:31:58.892', level: 'SCHED', node: 'node-a01', message: 'bert-train-opt allocated GPU0 (Compute-Bound, power cap=285W).' },
  { id: '3', time: '14:31:55.201', level: 'WARN', node: 'node-b01', message: 'VRAM utilization at 98%. Fan speed escalated to 100% duty cycle.' },
  { id: '4', time: '14:31:40.540', level: 'INFO', node: 'forecaster-v3', message: 'Demand inference loop updated: Next 15m delta = +3.7 GPU-hours.' },
  { id: '5', time: '14:31:32.110', level: 'SCHED', node: 'scheduler', message: 'Co-location bonus 1.3× applied for async IO-bound tokenizer pipeline.' },
  { id: '6', time: '14:31:12.784', level: 'INFO', node: 'energy-mon', message: 'Cluster draw: 612W / 800W budget (31% reduction vs baseline K8s).' },
];

export const logSink = (rec: LogRecord) => {
  logsBuffer.unshift(rec);
  if (logsBuffer.length > 200) logsBuffer.pop();
};

// Core 5-Layer Backend Architecture Singletons
export const simulator = new GPUSimulator();
export const profiler = new InterferenceProfiler();
export const forecaster = new MLForecasterEngine();
export const scoring = new ScoringEngine(0.4, 0.3, 0.3, profiler);
export const powerCtrl = new PowerController(simulator);
export const demoManager = new DemoScenarioManager(simulator, powerCtrl, scoring, forecaster, logSink);

// Ingest simulator ticks into interference profiler & power controller
simulator.onTickListeners.push((gpus) => {
  for (const g of gpus) {
    profiler.ingest(g.key, g.gpuUtil, g.memoryUtil);
    for (const j of g.currentJobs) {
      powerCtrl.sampleEnergy(j.jobId, g.powerDrawWatts / Math.max(1, g.currentJobs.length));
    }
  }
});

// Track global active jobs
export const jobStore: Map<string, SimulatedJob> = new Map();

// Helper to map simulator GPU state to aggregated Node representation
export const getAggregatedNodes = () => {
  const gpus = simulator.snapshot();
  const nodeMap: Record<
    string,
    {
      id: string;
      name: string;
      status: 'ONLINE' | 'STANDBY' | 'WARNING' | 'OFFLINE';
      gpus: any[];
      tempC: number;
      powerW: number;
      vramPct: number;
      fanPct: number;
    }
  > = {
    'NODE-01': { id: 'NODE-01', name: 'NODE-A01', status: 'ONLINE', gpus: [], tempC: 72, powerW: 285, vramPct: 78, fanPct: 65 },
    'NODE-02': { id: 'NODE-02', name: 'NODE-A02', status: 'ONLINE', gpus: [], tempC: 68, powerW: 250, vramPct: 45, fanPct: 50 },
    'NODE-03': { id: 'NODE-03', name: 'NODE-A03', status: 'ONLINE', gpus: [], tempC: 81, powerW: 310, vramPct: 92, fanPct: 88 },
    'NODE-04': { id: 'NODE-04', name: 'NODE-B01', status: 'WARNING', gpus: [], tempC: 85, powerW: 320, vramPct: 98, fanPct: 100 },
  };

  for (const g of gpus) {
    if (nodeMap[g.nodeId]) {
      nodeMap[g.nodeId].gpus.push({
        id: `GPU${g.gpuId}`,
        label: `GPU${g.gpuId}`,
        type: g.workloadType,
        utilization: g.gpuUtil,
        isThrottled: g.isThrottled,
        powerW: g.powerDrawWatts,
        tempC: g.temperatureC,
        vramPct: g.memoryUtil,
      });
    }
  }

  // Update node averages
  for (const n of Object.values(nodeMap)) {
    if (n.gpus.length > 0) {
      n.powerW = n.gpus.reduce((acc, g) => acc + g.powerW, 0);
      n.tempC = Math.round(n.gpus.reduce((acc, g) => acc + g.tempC, 0) / n.gpus.length);
      n.vramPct = Math.round(n.gpus.reduce((acc, g) => acc + g.vramPct, 0) / n.gpus.length);
      n.fanPct = Math.min(100, Math.max(40, (n.tempC - 40) * 2));
    }
  }

  return Object.values(nodeMap);
};
