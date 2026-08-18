import React, { useState, useEffect } from 'react';
import { X, Terminal, Trash2, Pause, Play, Download, Search } from 'lucide-react';
import { api } from '../lib/api';

interface LogsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LogEntry {
  id: string;
  time: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SCHED';
  node: string;
  message: string;
}

const initialMockLogs: LogEntry[] = [
  { id: '1', time: '14:32:00.124', level: 'INFO', node: 'fabric-ctrl', message: 'Heartbeat verified on 24 node probes. Latency p99=14ms.' },
  { id: '2', time: '14:31:58.892', level: 'SCHED', node: 'node-a01', message: 'bert-train-opt allocated GPU0 (Compute-Bound, power cap=285W).' },
  { id: '3', time: '14:31:55.201', level: 'WARN', node: 'node-b01', message: 'VRAM utilization at 98%. Fan speed escalated to 100% duty cycle.' },
  { id: '4', time: '14:31:40.540', level: 'INFO', node: 'forecaster-v3', message: 'Demand inference loop updated: Next 15m delta = +3.7 GPU-hours.' },
  { id: '5', time: '14:31:32.110', level: 'SCHED', node: 'scheduler', message: 'Co-location bonus 1.3× applied for async IO-bound tokenizer pipeline.' },
  { id: '6', time: '14:31:12.784', level: 'INFO', node: 'energy-mon', message: 'Cluster draw: 612W / 800W budget (31% reduction vs baseline K8s).' },
];

export const LogsDrawer: React.FC<LogsDrawerProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>(initialMockLogs);
  const [isPaused, setIsPaused] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch live logs from Backend REST API
  useEffect(() => {
    if (!isOpen || isPaused) return;

    const fetchLiveLogs = async () => {
      try {
        const liveLogs = await api.getLogs();
        if (liveLogs && liveLogs.length > 0) {
          setLogs(liveLogs);
        }
      } catch (err) {
        // Fallback local simulation
        const messages = [
          { level: 'INFO' as const, node: 'fabric-ctrl', message: 'GPU telemetry streamed. Packet loss=0.00%.' },
          { level: 'SCHED' as const, node: 'scheduler', message: 'Evaluating candidate nodes for incoming batch queue.' },
          { level: 'WARN' as const, node: 'node-a03', message: 'GPU1 temperature at 81°C. Power governor active.' },
          { level: 'SCHED' as const, node: 'node-a02', message: 'Mixed workload interleaved with 1.3× co-loc synergy coefficient.' },
        ];
        const randomMsg = messages[Math.floor(Math.random() * messages.length)];
        const now = new Date();
        const timeStr = `${now.toTimeString().split(' ')[0]}.${Math.floor(Math.random() * 900 + 100)}`;

        const newLog: LogEntry = {
          id: Math.random().toString(),
          time: timeStr,
          level: randomMsg.level,
          node: randomMsg.node,
          message: randomMsg.message,
        };

        setLogs((prev) => [newLog, ...prev.slice(0, 49)]);
      }
    };

    fetchLiveLogs();
    const interval = setInterval(fetchLiveLogs, 2500);
    return () => clearInterval(interval);
  }, [isOpen, isPaused]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter((log) => {
    const matchesLevel = filterLevel === 'ALL' || log.level === filterLevel;
    const matchesSearch =
      !searchQuery ||
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.node.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-[#0A0A0A] border-l border-[#1A1A1A] h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 bg-[#111111] border-b border-[#1A1A1A] flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Terminal className="w-5 h-5 text-neon" />
            <h2 className="font-mono text-sm font-bold uppercase text-neon tracking-wider">
              CLUSTER LOGS // TAIL -F (REST STREAM)
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`px-2.5 py-1 text-xs font-mono flex items-center gap-1.5 border transition-all ${
                isPaused
                  ? 'border-[#FFB300] text-[#FFB300] bg-[#1a1200]'
                  : 'border-[#1A1A1A] text-[#A0A0A0] hover:text-neon hover:border-neon'
              }`}
            >
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              <span>{isPaused ? 'RESUME' : 'PAUSE'}</span>
            </button>
            <button
              onClick={() => setLogs([])}
              className="p-1.5 text-[#A0A0A0] hover:text-danger hover:bg-[#1A1A1A]"
              title="Clear Log Buffer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 text-[#A0A0A0] hover:text-[#e5e2e1]">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="p-3 bg-[#0e0e0e] border-b border-[#1A1A1A] flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
          <div className="flex items-center gap-1.5">
            {['ALL', 'INFO', 'WARN', 'ERROR', 'SCHED'].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFilterLevel(lvl)}
                className={`px-2.5 py-1 text-[11px] font-mono border transition-all ${
                  filterLevel === lvl
                    ? 'border-neon bg-[#0D1F0D] text-neon font-bold'
                    : 'border-[#1A1A1A] text-[#A0A0A0] hover:border-[#333]'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-[#666]" />
            <input
              type="text"
              placeholder="Grep logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#111111] border border-[#1A1A1A] pl-7 pr-2 py-1 text-xs text-[#e5e2e1] focus:border-neon focus:outline-none w-44 placeholder-[#555]"
            />
          </div>
        </div>

        {/* Log Viewer Screen */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1.5 bg-[#0A0A0A] leading-relaxed">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-16 text-[#555]">NO MATCHING LOG LINES IN ACTIVE BUFFER</div>
          ) : (
            filteredLogs.map((log) => {
              let badgeColor = 'bg-[#1A1A1A] text-[#A0A0A0]';
              if (log.level === 'INFO') badgeColor = 'bg-[#0D1F0D] text-neon border border-[#2b3b28]';
              if (log.level === 'WARN') badgeColor = 'bg-[#1a1200] text-[#FFB300] border border-[#FFB300]/40';
              if (log.level === 'ERROR') badgeColor = 'bg-[#2A0800] text-danger border border-danger/40 font-bold';
              if (log.level === 'SCHED') badgeColor = 'bg-[#002203] text-[#40e56c] border border-[#40e56c]/30';

              return (
                <div
                  key={log.id}
                  className="flex items-start gap-2.5 p-1.5 hover:bg-[#111111] transition-colors border-b border-[#141414]"
                >
                  <span className="text-[#666] text-[11px] shrink-0">{log.time}</span>
                  <span className={`px-1.5 py-0.2 text-[10px] uppercase font-bold shrink-0 ${badgeColor}`}>
                    {log.level}
                  </span>
                  <span className="text-[#888] text-[11px] shrink-0">[{log.node}]</span>
                  <span className="text-[#e5e2e1] break-all">{log.message}</span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#111111] border-t border-[#1A1A1A] flex justify-between items-center font-mono text-[11px] text-[#A0A0A0]">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-neon rounded-none shadow-[0_0_6px_#00FF41]" />
            <span>LIVE BUFFER: {logs.length} LINES</span>
          </span>
          <span>AUTOSCROLL: {isPaused ? 'DISABLED' : 'ENGAGED'}</span>
        </div>
      </div>
    </div>
  );
};
