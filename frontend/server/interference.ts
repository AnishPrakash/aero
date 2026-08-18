import { WorkloadType } from './types';

interface TelemetryPoint {
  timestamp: number;
  gpuUtil: number;
  memoryUtil: number;
}

class ProfileWindow {
  public gpuKey: string;
  public windowSize: number;
  public points: TelemetryPoint[] = [];

  constructor(gpuKey: string, windowSize = 6) {
    this.gpuKey = gpuKey;
    this.windowSize = windowSize;
  }

  public add(gpuUtil: number, memoryUtil: number) {
    this.points.push({
      timestamp: Date.now(),
      gpuUtil,
      memoryUtil,
    });
    if (this.points.length > this.windowSize) {
      this.points.shift();
    }
  }

  public classify(): WorkloadType {
    if (this.points.length < 2) {
      return 'IDLE';
    }

    const avgGpu = this.points.reduce((acc, p) => acc + p.gpuUtil, 0) / this.points.length;
    const avgMem = this.points.reduce((acc, p) => acc + p.memoryUtil, 0) / this.points.length;

    if (avgGpu < 15 && avgMem < 20) {
      return 'IDLE';
    }
    if (avgGpu >= 75 && avgMem < 55) {
      return 'COMPUTE_BOUND';
    }
    if (avgMem >= 70 && avgGpu < 55) {
      return 'MEMORY_BOUND';
    }
    return 'MIXED';
  }

  public get avgGpuUtil(): number {
    if (!this.points.length) return 0;
    return this.points.reduce((acc, p) => acc + p.gpuUtil, 0) / this.points.length;
  }

  public get avgMemUtil(): number {
    if (!this.points.length) return 0;
    return this.points.reduce((acc, p) => acc + p.memoryUtil, 0) / this.points.length;
  }
}

export class InterferenceProfiler {
  private windows: Map<string, ProfileWindow> = new Map();

  public ingest(gpuKey: string, gpuUtil: number, memoryUtil: number) {
    if (!this.windows.has(gpuKey)) {
      this.windows.set(gpuKey, new ProfileWindow(gpuKey));
    }
    this.windows.get(gpuKey)!.add(gpuUtil, memoryUtil);
  }

  public classify(gpuKey: string): WorkloadType {
    const w = this.windows.get(gpuKey);
    if (!w) return 'IDLE';
    return w.classify();
  }

  public classifyAll(): Record<string, WorkloadType> {
    const res: Record<string, WorkloadType> = {};
    for (const [k, w] of this.windows.entries()) {
      res[k] = w.classify();
    }
    return res;
  }

  /**
   * Co-location compatibility multiplier:
   * 1.3 = beneficial pairing (COMPUTE + MEMORY complementary)
   * 1.0 = neutral
   * 0.6 = compute + compute (slight core competition)
   * 0.2 = memory + memory (destructive HBM bandwidth thrashing)
   */
  public coLocationScore(existingClass: WorkloadType, incomingClass: WorkloadType): number {
    if (existingClass === 'IDLE' || incomingClass === 'IDLE') {
      return 1.0;
    }

    // Best case: Compute-bound + Memory-bound
    if (
      (existingClass === 'COMPUTE_BOUND' && incomingClass === 'MEMORY_BOUND') ||
      (existingClass === 'MEMORY_BOUND' && incomingClass === 'COMPUTE_BOUND')
    ) {
      return 1.3;
    }

    // Worst case: two memory-bound jobs fighting for HBM memory bus
    if (existingClass === 'MEMORY_BOUND' && incomingClass === 'MEMORY_BOUND') {
      return 0.2;
    }

    // Two compute-bound: slight competition on CUDA cores
    if (existingClass === 'COMPUTE_BOUND' && incomingClass === 'COMPUTE_BOUND') {
      return 0.6;
    }

    return 1.0;
  }
}
