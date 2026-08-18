import React from 'react';
import { X, HelpCircle, Shield, Cpu, Zap, Activity, Terminal } from 'lucide-react';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="terminal-panel w-full max-w-2xl bg-[#111111] border border-[#1A1A1A] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#1A1A1A] flex justify-between items-center bg-[#0A0A0A]">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-neon" />
            <h2 className="font-mono text-sm font-bold uppercase text-neon tracking-wider">
              AERO Orchestration Architecture & Support
            </h2>
          </div>
          <button onClick={onClose} className="text-[#A0A0A0] hover:text-[#e5e2e1]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 font-mono text-xs text-[#e5e2e1]">
          {/* Section 1 */}
          <div className="border border-[#1A1A1A] p-4 bg-[#0A0A0A]">
            <div className="flex items-center gap-2 text-neon font-bold text-sm mb-2">
              <Zap className="w-4 h-4" />
              <span>Energy Optimization Subsystem (31% Savings)</span>
            </div>
            <p className="text-[#A0A0A0] leading-relaxed">
              AERO continuously profiles memory bandwidth and compute intensity of each tensor kernel. It dynamic DVFS throttle non-compute-critical workloads (e.g. Memory-bound or I/O bound pipelines), keeping power draw constrained under the 800W cluster power envelope without degrading SLA latency.
            </p>
          </div>

          {/* Section 2 */}
          <div className="border border-[#1A1A1A] p-4 bg-[#0A0A0A]">
            <div className="flex items-center gap-2 text-[#40e56c] font-bold text-sm mb-2">
              <Cpu className="w-4 h-4" />
              <span>Predictive Compute Allocation (Forecaster V3)</span>
            </div>
            <p className="text-[#A0A0A0] leading-relaxed">
              Using exponential demand synthesis and autoregressive drift detection, Forecaster V3 predicts cluster surges up to 12 hours in advance. If a surge is detected within 15 minutes, AERO triggers automated node pre-warming (PCIe bus pre-allocation & cache hydration) on standby nodes.
            </p>
          </div>

          {/* Section 3 */}
          <div className="border border-[#1A1A1A] p-4 bg-[#0A0A0A]">
            <div className="flex items-center gap-2 text-[#FFB300] font-bold text-sm mb-2">
              <Activity className="w-4 h-4" />
              <span>Co-Location Interference Matrix</span>
            </div>
            <p className="text-[#A0A0A0] leading-relaxed">
              Scheduling decisions evaluate pairwise kernel cross-talk multipliers (LLM, Computer Vision, POSIX IO, DB). Synergy factors range from <span className="text-danger">0.1×</span> (severe queue contention) to <span className="text-neon">1.5×</span> (orthogonal GPU/DMA execution).
            </p>
          </div>

          {/* Diagnostic status */}
          <div className="grid grid-cols-2 gap-3 text-[11px]">
            <div className="p-3 bg-[#161616] border border-[#222]">
              <span className="text-[#888] block mb-1">OPERATOR ROLE:</span>
              <span className="text-neon font-bold">OPERATOR_01 (ROOT_ADMIN)</span>
            </div>
            <div className="p-3 bg-[#161616] border border-[#222]">
              <span className="text-[#888] block mb-1">PROBE LATENCY:</span>
              <span className="text-neon font-bold">12.4ms (NOMINAL)</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1A1A1A] bg-[#0A0A0A] flex justify-end">
          <button
            onClick={onClose}
            className="bg-neon text-[#0A0A0A] font-bold px-6 py-2 hover:bg-[#3ce36a] transition-all font-mono text-xs uppercase"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
};
