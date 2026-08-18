import React, { useState } from 'react';
import { ClusterNode, SchedulingDecision } from '../types';
import { initialSchedulingDecisions, interferenceMatrixData } from '../data/initialData';
import { GpuDieCanvas3D } from '../components/GpuDieCanvas3D';
import {
  Cpu,
  RefreshCw,
  Plus,
  Flame,
  Zap,
  Activity,
  Server,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  X,
} from 'lucide-react';

interface ClusterViewProps {
  nodes: ClusterNode[];
  onProvisionNode?: () => void;
  onRestartCluster?: () => void;
}

export const ClusterView: React.FC<ClusterViewProps> = ({
  nodes,
  onProvisionNode,
  onRestartCluster,
}) => {
  const [schedulingLogs, setSchedulingLogs] = useState<SchedulingDecision[]>(initialSchedulingDecisions);
  const [selectedCellInfo, setSelectedCellInfo] = useState<{
    row: string;
    col: string;
    multiplier: string;
    desc: string;
  } | null>(null);
  const [isRestarting, setIsRestarting] = useState(false);
  const [provisionSuccess, setProvisionSuccess] = useState(false);
  const [inspectingNode, setInspectingNode] = useState<ClusterNode | null>(null);

  const handleRestart = () => {
    if (confirm('RESTART_CLUSTER: Initiate graceful drain and node rolling restart?')) {
      setIsRestarting(true);
      setTimeout(() => {
        setIsRestarting(false);
        alert('CLUSTER RESTARTED: All 24 node daemonsets healthy and reconnected.');
      }, 1200);
    }
  };

  const handleProvision = () => {
    setProvisionSuccess(true);
    setTimeout(() => setProvisionSuccess(false), 2500);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-[#1A1A1A] pb-4">
        <div>
          <h1 className="font-mono text-2xl md:text-3xl font-bold text-[#e5e2e1] uppercase tracking-tight">
            CLUSTER_STATUS
          </h1>
          <p className="font-mono text-xs text-[#A0A0A0] mt-1 flex items-center gap-2">
            <span>SYS.OP: ACTIVE</span>
            <span className="text-[#555]">|</span>
            <span className="text-neon flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-neon rounded-full" />
              NODES: 24/24 ON
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRestart}
            disabled={isRestarting}
            className="bg-[#0A0A0A] border border-neon text-neon px-4 py-2 font-mono text-xs uppercase hover:bg-[#0D1F0D] hover:shadow-[0_0_8px_rgba(0,255,65,0.25)] transition-all flex items-center gap-1.5 active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRestarting ? 'animate-spin' : ''}`} />
            <span>{isRestarting ? 'DRAINING...' : 'RESTART_CLUSTER'}</span>
          </button>

          <button
            onClick={handleProvision}
            className="bg-neon text-[#0A0A0A] px-4 py-2 font-mono text-xs uppercase font-bold hover:bg-[#3ce36a] transition-all shadow-[0_0_10px_rgba(0,255,65,0.25)] flex items-center gap-1.5 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>{provisionSuccess ? 'NODE SPAWNED' : 'PROVISION_NODE'}</span>
          </button>
        </div>
      </header>

      {/* Active Node Telemetry Grid */}
      <section className="flex flex-col gap-4">
        <h2 className="font-mono text-xs text-[#A0A0A0] border-b border-[#1A1A1A] pb-2 uppercase tracking-widest flex justify-between items-center">
          <span>Active Node Telemetry</span>
          <span className="text-neon text-[11px]">4 / 24 TELEMETRY TILES</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {nodes.map((node) => {
            const isWarning = node.tempC >= 85 || node.status === 'WARNING';
            return (
              <div
                key={node.id}
                className={`terminal-panel p-4 relative overflow-hidden transition-all hover:border-[#2b3b28] ${
                  isWarning ? 'border-[#FF3D00]/50' : 'border-[#1A1A1A]'
                }`}
              >
                <div
                  className={`absolute top-0 left-0 w-1 h-full ${
                    isWarning ? 'bg-[#FF3D00] animate-pulse' : 'bg-neon'
                  }`}
                />

                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-mono text-sm text-[#e5e2e1] font-bold flex items-center gap-1.5">
                    <span>{node.name}</span>
                    {isWarning ? (
                      <span className="text-danger text-xs animate-pulse">▲</span>
                    ) : (
                      <span className="text-neon text-xs">●</span>
                    )}
                  </h3>
                  <Server className="w-4 h-4 text-[#A0A0A0]" />
                </div>

                <div className="grid grid-cols-2 gap-y-3.5 gap-x-2 font-mono text-xs">
                  <div>
                    <div className="text-[#A0A0A0] text-[10px] uppercase mb-0.5">Temp</div>
                    <div
                      className={`text-lg font-bold ${
                        isWarning ? 'text-danger' : node.tempC > 75 ? 'text-[#FFB300]' : 'text-neon'
                      }`}
                    >
                      {node.tempC}°C
                    </div>
                  </div>

                  <div>
                    <div className="text-[#A0A0A0] text-[10px] uppercase mb-0.5">Power</div>
                    <div className="text-lg font-bold text-neon">{node.powerW}W</div>
                  </div>

                  <div>
                    <div className="text-[#A0A0A0] text-[10px] uppercase mb-0.5">VRAM</div>
                    <div
                      className={`text-lg font-bold ${
                        node.vramPct > 90 ? 'text-[#FFB300]' : 'text-neon'
                      }`}
                    >
                      {node.vramPct}%
                    </div>
                  </div>

                  <div>
                    <div className="text-[#A0A0A0] text-[10px] uppercase mb-0.5">Fan</div>
                    <div
                      className={`text-lg font-bold ${
                        node.fanPct === 100 ? 'text-danger' : 'text-neon'
                      }`}
                    >
                      {node.fanPct}%
                    </div>
                  </div>
                </div>

                {/* 3D Silicon Inspection Trigger */}
                <button
                  onClick={() => setInspectingNode(node)}
                  className="w-full mt-3 pt-2 border-t border-[#1A1A1A] flex items-center justify-between text-[11px] font-mono text-neon hover:text-white transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-neon" />
                    <span>3D SILICON DIE</span>
                  </span>
                  <span className="text-[9px] bg-[#0D1F0D] px-1 py-0.5 border border-neon/30 text-neon">
                    WebGL
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3D Silicon Inspection Modal */}
      {inspectingNode && (
        <div className="fixed inset-0 z-50 bg-[#000000]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0A0A0A] border-2 border-neon max-w-4xl w-full p-4 flex flex-col gap-3 shadow-[0_0_30px_rgba(0,255,65,0.2)]">
            <div className="flex justify-between items-center border-b border-[#1A1A1A] pb-3">
              <div className="flex items-center gap-2 font-mono text-sm">
                <span className="w-2.5 h-2.5 bg-neon inline-block pulse-green-dot" />
                <span className="text-neon font-bold uppercase">{inspectingNode.name} // 3D SILICON ACCELERATOR</span>
              </div>
              <button
                onClick={() => setInspectingNode(null)}
                className="p-1 text-[#A0A0A0] hover:text-neon cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <GpuDieCanvas3D
              nodeId={inspectingNode.name}
              temperature={inspectingNode.tempC}
              utilization={inspectingNode.gpus[0]?.utilization || 82}
              powerW={inspectingNode.powerW}
              isThrottled={inspectingNode.gpus[0]?.isThrottled}
            />
          </div>
        </div>
      )}

      {/* Bottom Grid: Scheduling Decision Log (7 cols) & Interference Matrix (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Scheduling Decision Log */}
        <section className="lg:col-span-7 flex flex-col gap-4">
          <h2 className="font-mono text-xs text-[#A0A0A0] border-b border-[#1A1A1A] pb-2 uppercase tracking-widest flex justify-between items-center">
            <span>Scheduling Decision Log</span>
            <span className="text-neon font-bold text-[11px] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-neon inline-block pulse-green-dot" />
              TAIL -F
            </span>
          </h2>

          <div className="terminal-panel h-96 overflow-y-auto p-2 font-mono text-xs relative bg-[#0A0A0A]">
            <table className="w-full text-left border-collapse">
              <tbody>
                {schedulingLogs.map((log) => {
                  let scoreColor = 'text-neon';
                  if (log.score < 50) scoreColor = 'text-[#FF3D00]';
                  else if (log.score < 70) scoreColor = 'text-[#FFB300]';

                  let colocColor = 'text-[#e5e2e1]';
                  if (log.colocMultiplier >= 1.2) colocColor = 'text-neon font-bold';
                  else if (log.colocMultiplier < 0.6) colocColor = 'text-[#FF3D00] font-bold';

                  return (
                    <tr
                      key={log.id}
                      className="border-b border-[#141414] hover:bg-[#0D1F0D] transition-colors"
                    >
                      <td className="py-2.5 px-2 text-[#777] w-24 shrink-0">{log.timestamp}</td>
                      <td className="py-2.5 px-2 text-[#e5e2e1]">
                        <span>{log.workload}</span>
                        <span className="text-[#777] mx-1.5">→</span>
                        <span className="text-[#A0A0A0]">{log.targetNode}</span>
                      </td>
                      <td className={`py-2.5 px-2 text-right ${scoreColor}`}>
                        Score: {log.score.toFixed(1)}
                      </td>
                      <td className={`py-2.5 px-2 text-right ${colocColor}`}>
                        CoLoc: {log.colocMultiplier.toFixed(1)}×
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="sticky bottom-0 left-0 w-full h-8 bg-gradient-to-t from-[#0A0A0A] to-transparent pointer-events-none" />
          </div>
        </section>

        {/* Interference Matrix */}
        <section className="lg:col-span-5 flex flex-col gap-4">
          <h2 className="font-mono text-xs text-[#A0A0A0] border-b border-[#1A1A1A] pb-2 uppercase tracking-widest flex justify-between items-center">
            <span>Interference Matrix</span>
            <span className="text-[10px] text-[#777]">PAIRWISE CROSS-TALK</span>
          </h2>

          <div className="terminal-panel p-4 flex flex-col h-96 justify-between">
            <div className="grid grid-cols-5 gap-1 text-center font-mono text-xs h-full">
              {/* Header Row */}
              <div className="flex items-end justify-center pb-2 text-[#A0A0A0]" />
              {interferenceMatrixData.types.map((type) => (
                <div key={type} className="flex items-end justify-center pb-2 text-[#A0A0A0] font-bold">
                  {type}
                </div>
              ))}

              {/* Matrix Rows */}
              {interferenceMatrixData.types.map((rowType, rIdx) => (
                <React.Fragment key={rowType}>
                  <div className="flex items-center justify-end pr-2 text-[#A0A0A0] font-bold text-xs">
                    {rowType}
                  </div>
                  {interferenceMatrixData.grid[rIdx].map((cell, cIdx) => {
                    const colType = interferenceMatrixData.types[cIdx];
                    let cellBg = 'bg-[#111111] text-[#e5e2e1]';
                    let borderClass = 'border border-[#1A1A1A] hover:border-[#333]';

                    if (cell.type === 'danger') {
                      cellBg = 'bg-[#2A0800] text-[#FF3D00] font-bold';
                      borderClass = 'border border-[#1A1A1A] hover:border-[#FF3D00]';
                    } else if (cell.type === 'positive') {
                      cellBg = 'bg-neon-muted text-neon font-bold';
                      borderClass = 'border border-[#1A1A1A] hover:border-neon';
                    }

                    return (
                      <button
                        key={`${rIdx}-${cIdx}`}
                        onClick={() =>
                          setSelectedCellInfo({
                            row: rowType,
                            col: colType,
                            multiplier: cell.label,
                            desc: cell.desc,
                          })
                        }
                        className={`${cellBg} ${borderClass} flex items-center justify-center transition-all cursor-crosshair active:scale-95 text-xs`}
                        title={`${rowType} x ${colType}: ${cell.label}`}
                      >
                        {cell.label}
                      </button>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>

            {/* Explanatory footer or selected cell banner */}
            {selectedCellInfo ? (
              <div className="mt-3 p-2.5 bg-[#0A0A0A] border border-neon/50 font-mono text-[11px] text-[#e5e2e1]">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-neon font-bold">
                    {selectedCellInfo.row} × {selectedCellInfo.col} ({selectedCellInfo.multiplier})
                  </span>
                  <button
                    onClick={() => setSelectedCellInfo(null)}
                    className="text-[#A0A0A0] hover:text-neon text-[10px]"
                  >
                    CLOSE
                  </button>
                </div>
                <div className="text-[#A0A0A0] text-[10px] leading-snug">
                  {selectedCellInfo.desc}
                </div>
              </div>
            ) : (
              <div className="mt-3 flex justify-between items-center text-[10px] font-mono text-[#666] pt-2 border-t border-[#1A1A1A]">
                <span className="text-[#FF3D00]">■ Contention (&lt;1.0×)</span>
                <span className="text-[#888]">■ Neutral (1.0×)</span>
                <span className="text-neon">■ Synergy (&gt;1.0×)</span>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
