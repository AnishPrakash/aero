import React, { useState } from 'react';
import { Job, JobPriority, JobType } from '../types';
import { X, Zap, Cpu, Clock, AlertTriangle } from 'lucide-react';

interface SubmitJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (job: Partial<Job>) => void;
}

export const SubmitJobModal: React.FC<SubmitJobModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [workloadName, setWorkloadName] = useState('llama-infer-prod');
  const [workloadType, setWorkloadType] = useState<JobType>('COMPUTE_BOUND');
  const [priority, setPriority] = useState<JobPriority>('INTERACTIVE');
  const [durationValue, setDurationValue] = useState('2.5');
  const [durationUnit, setDurationUnit] = useState<'HOURS' | 'MINUTES' | 'SECONDS'>('MINUTES');
  const [targetNode, setTargetNode] = useState('AUTO');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let duration = parseFloat(durationValue) || 2.0;
    
    if (durationUnit === 'MINUTES') {
      duration = duration / 60.0;
    } else if (durationUnit === 'SECONDS') {
      duration = duration / 3600.0;
    }
    
    // Determine target node label
    let nodeLabel = targetNode;
    if (targetNode === 'AUTO') {
      nodeLabel = workloadType === 'CRITICAL' ? 'N-01' : 'N-02';
    }

    onSubmit({
      name: workloadName || 'custom-compute-task',
      type: workloadType,
      priority,
      durationHours: duration,
      node: nodeLabel,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="terminal-panel w-full max-w-md relative border border-[#1A1A1A] bg-[#111111] shadow-[0_0_24px_rgba(0,0,0,0.9)]">
        {/* Header */}
        <div className="p-4 border-b border-[#1A1A1A] flex justify-between items-center bg-[#0A0A0A]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-neon shadow-[0_0_6px_#00FF41]" />
            <h2 className="font-mono text-sm font-bold uppercase text-neon tracking-wider">
              New Workload Submission
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#A0A0A0] hover:text-[#e5e2e1] transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 font-mono text-xs">
          <div>
            <label className="block text-[#A0A0A0] mb-1.5 uppercase tracking-wide">
              Workload Identifier
            </label>
            <input
              type="text"
              value={workloadName}
              onChange={(e) => setWorkloadName(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-[#1A1A1A] text-[#e5e2e1] p-2.5 focus:border-neon focus:outline-none focus:shadow-[0_0_8px_rgba(0,255,65,0.2)] placeholder-[#555]"
              placeholder="e.g. gpt4-eval-tensor"
              required
            />
          </div>

          <div>
            <label className="block text-[#A0A0A0] mb-1.5 uppercase tracking-wide">
              Workload Type
            </label>
            <select
              value={workloadType}
              onChange={(e) => setWorkloadType(e.target.value as JobType)}
              className="w-full bg-[#0A0A0A] border border-[#1A1A1A] text-[#e5e2e1] p-2.5 focus:border-neon focus:outline-none focus:shadow-[0_0_8px_rgba(0,255,65,0.2)]"
            >
              <option value="COMPUTE_BOUND">COMPUTE_BOUND (Tensor/Math Heavy)</option>
              <option value="MEMORY_BOUND">MEMORY_BOUND (High Bandwidth/ETL)</option>
              <option value="MIXED">MIXED (Balanced)</option>
            </select>
          </div>

          <div>
            <label className="block text-[#A0A0A0] mb-1.5 uppercase tracking-wide">
              Priority Class
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as JobPriority)}
              className="w-full bg-[#0A0A0A] border border-[#1A1A1A] text-[#e5e2e1] p-2.5 focus:border-neon focus:outline-none focus:shadow-[0_0_8px_rgba(0,255,65,0.2)]"
            >
              <option value="BATCH">BATCH (Power-Efficient / Preemptible)</option>
              <option value="INTERACTIVE">INTERACTIVE (Standard SLA)</option>
              <option value="CRITICAL">CRITICAL (Zero Throttle / Max Clock)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#A0A0A0] mb-1.5 uppercase tracking-wide">
                Duration
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={durationValue}
                  onChange={(e) => setDurationValue(e.target.value)}
                  className="flex-1 bg-[#0A0A0A] border border-[#1A1A1A] text-[#e5e2e1] p-2.5 placeholder-[#A0A0A0] focus:border-neon focus:outline-none focus:shadow-[0_0_8px_rgba(0,255,65,0.2)]"
                  placeholder="2.5"
                  required
                />
                <select
                  value={durationUnit}
                  onChange={(e) => setDurationUnit(e.target.value as any)}
                  className="w-24 bg-[#0A0A0A] border border-[#1A1A1A] text-[#e5e2e1] p-2.5 focus:border-neon focus:outline-none focus:shadow-[0_0_8px_rgba(0,255,65,0.2)]"
                >
                  <option value="HOURS">Hrs</option>
                  <option value="MINUTES">Min</option>
                  <option value="SECONDS">Sec</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[#A0A0A0] mb-1.5 uppercase tracking-wide">
                Node Dispatch
              </label>
              <select
                value={targetNode}
                onChange={(e) => setTargetNode(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-[#1A1A1A] text-[#e5e2e1] p-2.5 focus:border-neon focus:outline-none focus:shadow-[0_0_8px_rgba(0,255,65,0.2)]"
              >
                <option value="AUTO">AUTO (AERO Co-Loc Engine)</option>
                <option value="N-01">N-01 (Compute Heavy)</option>
                <option value="N-02">N-02 (Mixed Balanced)</option>
                <option value="N-03">N-03 (Pre-Warmed)</option>
                <option value="Q">QUEUE (Deferred)</option>
              </select>
            </div>
          </div>

          {/* Forecast Hint */}
          <div className="p-2.5 bg-[#0D1F0D] border border-[#2b3b28] text-neon text-[11px] flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 shrink-0" />
            <span>CoLoc engine will assign optimal interference slot automatically.</span>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-[#1A1A1A] flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="border border-[#1A1A1A] text-[#A0A0A0] px-4 py-2 hover:bg-[#1A1A1A] hover:text-[#e5e2e1] transition-all"
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="bg-neon text-[#0A0A0A] px-5 py-2 font-bold hover:bg-[#3ce36a] transition-all shadow-[0_0_10px_rgba(0,255,65,0.3)]"
            >
              INITIATE
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
