import React, { useState } from 'react';
import { GpuDieCanvas3D } from '../components/GpuDieCanvas3D';
import { ClusterNode, Job } from '../types';
import {
  Cpu,
  Zap,
  Activity,
  Layers,
  Flame,
  Shield,
  Sliders,
  Play,
  RotateCw,
  TrendingDown,
  Info,
} from 'lucide-react';
import { api } from '../lib/api';

interface Topology3DViewProps {
  nodes: ClusterNode[];
  jobs: Job[];
}

export const Topology3DView: React.FC<Topology3DViewProps> = ({ nodes, jobs }) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string>('NODE-01');
  const [selectedComponent, setSelectedComponent] = useState<string>('Logic Compute Die');
  const [selectedSpecs, setSelectedSpecs] = useState<Record<string, string | number>>({});
  const [activePowerCap, setActivePowerCap] = useState<number>(320);

  const activeNode = nodes.find((n) => n.name === selectedNodeId || n.id === selectedNodeId) || nodes[0];
  const activeGpu = activeNode?.gpus[0] || {
    id: 'GPU-0',
    label: 'GPU0 - H100 SXM5',
    type: 'Compute-Bound',
    utilization: 88,
    powerW: activePowerCap,
    tempC: 68,
    vramPct: 82,
  };

  const handleThrottleChange = async (newCap: number) => {
    setActivePowerCap(newCap);
    try {
      await api.throttlePower(`${selectedNodeId}:0`, newCap);
    } catch (e) {
      // Local fallback
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* View Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#1A1A1A] pb-4">
        <div>
          <h1 className="font-mono text-2xl md:text-3xl font-bold text-neon uppercase tracking-tight glow-text">
            3D SILICON TOPOLOGY & DIE EXPLORER
          </h1>
          <p className="font-mono text-xs text-[#A0A0A0] mt-1">
            Interactive WebGL 3D hardware inspection, microarchitecture layer decomposition & real-time thermal telemetry.
          </p>
        </div>

        {/* Node Switcher Tabs */}
        <div className="flex gap-1.5 font-mono text-xs">
          {nodes.map((node) => {
            const isSelected = selectedNodeId === node.name;
            return (
              <button
                key={node.id}
                onClick={() => setSelectedNodeId(node.name)}
                className={`px-3 py-1.5 border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-neon bg-neon text-[#0A0A0A] font-bold shadow-[0_0_8px_#00FF41]'
                    : 'border-[#1A1A1A] bg-[#111111] text-[#A0A0A0] hover:text-[#e5e2e1]'
                }`}
              >
                {node.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main 3D Canvas Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 flex flex-col gap-4">
          <GpuDieCanvas3D
            nodeId={selectedNodeId}
            temperature={activeGpu.tempC}
            utilization={activeGpu.utilization}
            powerW={activePowerCap}
            isThrottled={activeGpu.isThrottled}
            onSelectComponent={(comp, specs) => {
              setSelectedComponent(comp);
              setSelectedSpecs(specs);
            }}
          />
        </div>

        {/* Real-time Hardware Controls & Microarchitecture Sidebar */}
        <div className="lg:col-span-4 flex flex-col gap-6 font-mono text-xs">
          {/* Dynamic NVML Power-Capping Slider */}
          <div className="terminal-panel p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-[#1A1A1A] pb-2 text-[#A0A0A0] uppercase tracking-wider">
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-neon" />
                <span>NVML Power Envelope</span>
              </span>
              <span className="text-neon font-bold">{activePowerCap} W</span>
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-[#888] mb-1">
                <span>120W (IDLE)</span>
                <span>240W (BATCH)</span>
                <span>320W (INTERACTIVE)</span>
                <span>400W (MAX TDP)</span>
              </div>
              <input
                type="range"
                min="120"
                max="400"
                step="20"
                value={activePowerCap}
                onChange={(e) => handleThrottleChange(Number(e.target.value))}
                className="w-full accent-[#00FF41] cursor-pointer"
              />
            </div>

            <div className="p-2.5 bg-[#0A0A0A] border border-[#1A1A1A] text-[11px] text-[#A0A0A0] flex items-center justify-between">
              <span>ACTIVE DVFS FREQUENCY:</span>
              <span className="text-neon font-bold">
                {(600 + (activePowerCap / 400) * 810).toFixed(0)} MHz
              </span>
            </div>
          </div>

          {/* Co-Location Synergy Matrix on Node */}
          <div className="terminal-panel p-5 space-y-3">
            <div className="flex justify-between items-center border-b border-[#1A1A1A] pb-2 text-[#A0A0A0] uppercase tracking-wider">
              <span className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-neon" />
                <span>Node Synergy State</span>
              </span>
              <span className="text-[#40e56c] font-bold">1.30× BOOST</span>
            </div>

            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between p-2 bg-[#0A0A0A] border border-[#1A1A1A]">
                <span className="text-[#888]">WORKLOAD 1:</span>
                <span className="text-[#00e5ff] font-bold">LLM-ATTENTION (COMPUTE)</span>
              </div>
              <div className="flex justify-between p-2 bg-[#0A0A0A] border border-[#1A1A1A]">
                <span className="text-[#888]">WORKLOAD 2:</span>
                <span className="text-neon font-bold">EMBEDDING-FETCH (MEMORY)</span>
              </div>
              <div className="flex justify-between p-2 bg-[#0D1F0D] border border-neon/30 text-[#e5e2e1]">
                <span>HBM3 BANDWIDTH SATURATION:</span>
                <span className="text-neon font-bold">94.2%</span>
              </div>
            </div>
          </div>

          {/* Silicon Die Layer Hierarchy Info */}
          <div className="terminal-panel p-5 space-y-3 flex-1">
            <div className="font-mono text-xs text-[#A0A0A0] border-b border-[#1A1A1A] pb-2 uppercase tracking-wider flex items-center gap-2">
              <Info className="w-4 h-4 text-neon" />
              <span>3D Architecture Layers</span>
            </div>

            <div className="space-y-2 text-[11px] text-[#888]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#333] inline-block" />
                <span className="text-[#e5e2e1]">Layer 5: Micro-fin Heat Sink Assembly</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#b87333] inline-block" />
                <span className="text-[#e5e2e1]">Layer 4: Phase-Change Vapor Chamber</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#00e5ff] inline-block" />
                <span className="text-[#e5e2e1]">Layer 3: 6x HBM3 3D Stacked Cubes (80GB)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#00ff41] inline-block" />
                <span className="text-[#e5e2e1]">Layer 2: 4nm Logic Monolith Die</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#d4af37] inline-block" />
                <span className="text-[#e5e2e1]">Layer 1: TSV Interposer & SXM5 Substrate</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
