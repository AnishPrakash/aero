import React, { useState, useEffect } from 'react';
import { ClusterNode, Job } from '../types';
import { Zap, Plus, AlertCircle, ArrowUpRight, Cpu, Server, Activity, CheckCircle2, Trash2 } from 'lucide-react';

interface DashboardViewProps {
  nodes: ClusterNode[];
  jobs: Job[];
  onOpenSubmitJob: () => void;
  onNavigateToForecaster: () => void;
  onPrewarmNode: (nodeId: string) => void;
  isNode3Prewarmed: boolean;
  onDeleteJob: (jobId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  nodes,
  jobs,
  onOpenSubmitJob,
  onNavigateToForecaster,
  onPrewarmNode,
  isNode3Prewarmed,
  onDeleteJob,
}) => {
  const [currentTime, setCurrentTime] = useState('2024-05-20T14:32:00Z');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [forecastDemand, setForecastDemand] = useState<number>(3.7);

  // Live ISO time simulation
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toISOString().split('.')[0] + 'Z');
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchForecast = async () => {
      try {
        const res = await fetch('/api/forecast');
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setForecastDemand(data.predictedGpuDemand);
        }
      } catch (e) {
        // ignore
      }
    };
    fetchForecast();
    const timer = setInterval(fetchForecast, 10000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);
  const totalGpus = nodes.reduce((acc, n) => acc + n.gpus.length, 0);
  const activeJobsCount = jobs.filter((j) => j.status === 'RUNNING').length;
  const clusterPowerW = Math.round(nodes.reduce((acc, n) => acc + (n.powerW || 0), 0));
  const maxPowerW = nodes.reduce((acc, n) => acc + (n.gpus.length * 400), 0) || 800;
  const energySavedPct = Math.max(0, Math.round((1 - (clusterPowerW / maxPowerW)) * 100));

  return (
    <div className="flex flex-col gap-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-[#1A1A1A] pb-4">
        <div>
          <h1 className="font-mono text-2xl font-bold uppercase text-[#e5e2e1] tracking-tight">
            Cluster Overview
          </h1>
          <p className="font-mono text-xs text-[#A0A0A0] mt-1 flex items-center gap-2">
            <span>SYS_TIME: {currentTime}</span>
            <span className="text-[#555]">|</span>
            <span className="text-neon flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-neon inline-block" />
              STATUS: OPTIMAL
            </span>
          </p>
        </div>
        <button
          onClick={onOpenSubmitJob}
          className="bg-neon text-[#0A0A0A] font-mono text-xs uppercase px-6 py-3 font-bold hover:bg-[#3ce36a] transition-all flex items-center gap-2 shadow-[0_0_10px_rgba(0,255,65,0.25)] active:scale-95"
        >
          <span>SUBMIT JOB</span>
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="terminal-panel p-4 border-l-4 border-l-neon glow-active transition-all">
          <div className="font-mono text-xs text-[#A0A0A0] uppercase mb-2 tracking-wider">
            Total GPUs
          </div>
          <div className="font-mono text-3xl font-bold text-neon glow-text">
            {totalGpus}
          </div>
        </div>

        <div className="terminal-panel p-4 border-l-4 border-l-neon glow-active transition-all">
          <div className="font-mono text-xs text-[#A0A0A0] uppercase mb-2 tracking-wider">
            Active Jobs
          </div>
          <div className="font-mono text-3xl font-bold text-neon glow-text">
            {activeJobsCount}
          </div>
        </div>

        <div className="terminal-panel p-4 border-l-4 border-l-neon glow-active transition-all">
          <div className="font-mono text-xs text-[#A0A0A0] uppercase mb-2 tracking-wider">
            Cluster Power
          </div>
          <div className="font-mono text-3xl font-bold text-neon glow-text">
            {clusterPowerW}W
          </div>
        </div>

        <div className="terminal-panel p-4 border-l-4 border-l-neon glow-active transition-all">
          <div className="font-mono text-xs text-[#A0A0A0] uppercase mb-2 tracking-wider">
            Energy Saved
          </div>
          <div className="font-mono text-3xl font-bold text-neon glow-text">
            {energySavedPct}%
          </div>
        </div>
      </div>

      {/* Main Grid: GPU Node Map & Energy Monitor (Left 2 cols), Job Queue (Right 1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Map & Energy */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* GPU Node Map */}
          <div className="terminal-panel">
            <div className="p-4 border-b border-[#1A1A1A] flex justify-between items-center">
              <h2 className="font-mono text-xs font-bold uppercase text-[#e5e2e1] tracking-widest flex items-center gap-2">
                <Server className="w-3.5 h-3.5 text-neon" />
                <span>GPU Node Map</span>
              </h2>
              <span className="font-mono text-[11px] text-[#A0A0A0]">2 ONLINE NODES</span>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {nodes.map((node) => (
                <div key={node.id} className="border border-[#1A1A1A] bg-[#0A0A0A] p-3 transition-colors hover:border-[#2b3b28]">
                  <div className="font-mono text-xs text-[#A0A0A0] mb-3 flex justify-between items-center">
                    <span className="text-[#e5e2e1] font-semibold">{node.name}</span>
                    <span className={`text-[11px] font-bold flex items-center gap-1 ${node.status === 'ONLINE' ? 'text-neon' : 'text-[#FFB300]'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${node.status === 'ONLINE' ? 'bg-neon' : 'bg-[#FFB300]'}`} /> {node.status}
                    </span>
                  </div>
                  <div className="space-y-4 font-mono text-xs">
                    {node.gpus.map((gpu) => (
                      <div key={gpu.id}>
                        <div className="flex justify-between mb-1">
                          <span className="text-[#e5e2e1]">
                            {gpu.label} <span className="text-[#A0A0A0] ml-2">{gpu.type}</span>
                          </span>
                          <span className={`${gpu.utilization > 80 ? 'text-neon' : gpu.utilization > 30 ? 'text-[#FFB300]' : 'text-[#A0A0A0]'} font-bold`}>{Math.round(gpu.utilization)}%</span>
                        </div>
                        <div className="h-2 w-full bg-[#1A1A1A] overflow-hidden">
                          <div className={`h-full ${gpu.utilization > 80 ? 'bg-neon shadow-[0_0_8px_#00FF41]' : gpu.utilization > 30 ? 'bg-[#FFB300]' : 'bg-[#A0A0A0]'} transition-all duration-500`} style={{ width: `${Math.round(gpu.utilization)}%` }} />
                        </div>
                        {gpu.isThrottled && (
                          <div className="text-[10px] text-[#FFB300] mt-1 text-right font-bold tracking-wider">
                            THROTTLED ({Math.round(gpu.powerW)}W)
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Energy Monitor */}
          <div className="terminal-panel">
            <div className="p-4 border-b border-[#1A1A1A] flex justify-between items-center">
              <h2 className="font-mono text-xs font-bold uppercase text-[#e5e2e1] tracking-widest flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-neon" />
                <span>Energy Monitor</span>
              </h2>
              <span className="font-mono text-[11px] text-[#A0A0A0]">DYNAMIC DVFS ACTIVE</span>
            </div>
            <div className="p-4 font-mono">
              <div className="flex justify-between items-end mb-2.5 text-xs">
                <div className="text-[#A0A0A0] tracking-wide">CURRENT DRAW VS BUDGET</div>
                <div className="text-neon font-bold text-sm">{clusterPowerW}W / {maxPowerW}W</div>
              </div>

              {/* 20-segment LED Energy Meter (15 green active, 5 inactive) */}
              <div className="flex h-6 gap-[2px] w-full bg-[#0A0A0A] border border-[#1A1A1A] p-[2px]">
                {Array.from({ length: 20 }).map((_, index) => {
                  const utilizationPct = maxPowerW > 0 ? (clusterPowerW / maxPowerW) * 100 : 0;
                  const activeSegments = Math.round((utilizationPct / 100) * 20);
                  const isActive = index < activeSegments;
                  return (
                    <div
                      key={index}
                      className={`flex-1 transition-all duration-300 ${
                        isActive
                          ? 'bg-neon shadow-[0_0_4px_#00FF41]'
                          : 'bg-[#1A1A1A]'
                      }`}
                      title={`Segment ${index + 1} of 20`}
                    />
                  );
                })}
              </div>

              <div className="flex justify-between text-[10px] text-[#666] mt-2">
                <span>0W (IDLE)</span>
                <span className="text-neon">{clusterPowerW}W ({Math.round(maxPowerW > 0 ? (clusterPowerW / maxPowerW) * 100 : 0)}% UTILIZATION)</span>
                <span>{maxPowerW}W (THERMAL CAP)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Job Queue */}
        <div className="terminal-panel flex flex-col h-full">
          <div className="p-4 border-b border-[#1A1A1A] flex justify-between items-center">
            <h2 className="font-mono text-xs font-bold uppercase text-[#e5e2e1] tracking-widest flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-neon" />
              <span>Job Queue</span>
            </h2>
            <span className="font-mono text-[10px] bg-[#0D1F0D] text-neon px-2 py-0.5 border border-neon/30">
              {jobs.length} JOBS
            </span>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse font-mono text-xs">
              <thead>
                <tr className="text-[#A0A0A0] border-b border-[#1A1A1A]">
                  <th className="p-3 font-normal">ID</th>
                  <th className="p-3 font-normal">TYPE</th>
                  <th className="p-3 font-normal text-right">NODE</th>
                </tr>
              </thead>
              <tbody className="text-[#e5e2e1]">
                {jobs.map((job) => {
                  let badge = (
                    <span className="bg-[#2A2A2A] text-[#e5e2e1] px-2 py-0.5 text-[10px] font-bold border border-[#353534]">
                      BATCH
                    </span>
                  );
                  if (job.priority === 'CRITICAL') {
                    badge = (
                      <span className="bg-danger text-[#0A0A0A] px-2 py-0.5 text-[10px] font-bold">
                        CRITICAL
                      </span>
                    );
                  } else if (job.priority === 'INTERACTIVE') {
                    badge = (
                      <span className="bg-neon text-[#0A0A0A] px-2 py-0.5 text-[10px] font-bold">
                        INTERACTIVE
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className="border-b border-[#1A1A1A] hover:bg-[#0D1F0D] transition-colors cursor-pointer group"
                    >
                      <td className="p-3 font-bold text-neon">{job.id}</td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          <div>{badge}</div>
                          <span className="text-[9px] text-[#A0A0A0] uppercase tracking-wider">{job.type}</span>
                        </div>
                      </td>
                      <td className="p-3 flex justify-end items-center gap-3 text-[#A0A0A0]">
                        <span>{job.node}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteJob(job.id);
                          }}
                          className="text-[#A0A0A0] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                          title="Terminate Job"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Quick Selected Job Detail Drawer in queue */}
          {selectedJob && (
            <div className="p-3 bg-[#0A0A0A] border-t border-[#1A1A1A] font-mono text-xs">
              <div className="flex justify-between items-center text-[#A0A0A0] text-[11px] mb-1">
                <span>WORKLOAD: {selectedJob.name}</span>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="text-neon hover:underline"
                >
                  CLOSE
                </button>
              </div>
              <div className="flex justify-between text-[10px] text-[#777]">
                <span>Allocated: {selectedJob.gpuAllocated || 'Automatic'}</span>
                <span>Est. Duration: {selectedJob.durationHours}h</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Forecaster Banner */}
      <div className="border border-[#FFB300] bg-[#1a1200] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 font-mono text-xs text-[#FFB300]">
          <Zap className="w-5 h-5 text-[#FFB300] shrink-0 pulse-amber-dot" />
          <span>Next 15min demand = {forecastDemand ? forecastDemand.toFixed(1) : '3.7'} GPU-hours | Pre-warming node-3 recommended</span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {isNode3Prewarmed ? (
            <span className="font-mono text-xs text-neon flex items-center gap-1.5 px-3 py-1 bg-[#0D1F0D] border border-neon">
              <CheckCircle2 className="w-3.5 h-3.5 text-neon" />
              NODE-3 HYDRATED & READY
            </span>
          ) : (
            <button
              onClick={() => onPrewarmNode('NODE-03')}
              className="bg-[#FFB300] text-[#0A0A0A] font-mono text-xs font-bold px-4 py-1.5 hover:bg-[#ffc107] transition-all uppercase tracking-wider flex items-center gap-1"
            >
              <span>PRE-WARM NODE-3</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={onNavigateToForecaster}
            className="border border-[#FFB300] text-[#FFB300] font-mono text-xs px-3 py-1.5 hover:bg-[#FFB300]/10 transition-all uppercase"
          >
            VIEW FORECAST
          </button>
        </div>
      </div>
    </div>
  );
};
