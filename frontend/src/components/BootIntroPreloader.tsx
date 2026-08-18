import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, Zap, Shield, Cpu, Activity, ArrowRight } from 'lucide-react';

interface BootIntroPreloaderProps {
  onComplete: () => void;
}

const BOOT_LOGS = [
  { time: '0.012s', text: 'INIT NVML HARDWARE DAEMON & CUDA RUNTIME v12.4', ok: true },
  { time: '0.048s', text: 'DETECTING ACCELERATOR CLUSTER (24x H100 SXM5 / A100)', ok: true },
  { time: '0.092s', text: 'CALIBRATING DVFS CORE CLOCK & POWER ENVELOPES (120W-400W)', ok: true },
  { time: '0.145s', text: 'LOADING XGBOOST DEMAND FORECASTER (MAE: 0.43, R²: 0.87)', ok: true },
  { time: '0.198s', text: 'PROFILING CO-LOCATION MATRIX (COMPUTE + MEMORY = 1.3x)', ok: true },
  { time: '0.240s', text: 'BINDING K8S SCHEDULER EXTENDER TO PORT 3000', ok: true },
  { time: '0.290s', text: 'ORCHESTRATION FABRIC READY // TELEMETRY SYNC COMPLETE', ok: true },
];

export const BootIntroPreloader: React.FC<BootIntroPreloaderProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [logIndex, setLogIndex] = useState(0);
  const [isSplitting, setIsSplitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const completedRef = useRef(false);

  const finishAndReveal = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    setIsSplitting(true);
    setTimeout(() => {
      setIsDone(true);
      onComplete();
    }, 700);
  };

  useEffect(() => {
    // Smooth progress ticker
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        // Rapid step progress with variable speed
        const increment = Math.floor(Math.random() * 10) + 4;
        const next = Math.min(prev + increment, 100);
        return next;
      });
    }, 40);

    // Hard fallback: Ensure screen always unlocks within 2.5s maximum
    const fallbackTimer = setTimeout(() => {
      finishAndReveal();
    }, 2500);

    return () => {
      clearInterval(interval);
      clearTimeout(fallbackTimer);
    };
  }, []);

  // When progress reaches 100%, trigger split animation
  useEffect(() => {
    const targetLogIndex = Math.min(
      Math.floor((progress / 100) * BOOT_LOGS.length),
      BOOT_LOGS.length - 1
    );
    setLogIndex(targetLogIndex);

    if (progress >= 100 && !completedRef.current) {
      const timer = setTimeout(() => {
        finishAndReveal();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [progress]);

  // Handle manual skip
  const handleSkip = () => {
    setProgress(100);
    finishAndReveal();
  };

  if (isDone) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] overflow-hidden select-none font-mono transition-opacity duration-300 ${
        isSplitting ? 'pointer-events-none' : 'pointer-events-auto'
      }`}
    >
      {/* Laser Seam Line (Center Split Axis) */}
      <AnimatePresence>
        {!isSplitting && (
          <motion.div
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 0.8 }}
            exit={{ scaleY: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute top-0 bottom-0 left-1/2 w-[2px] -ml-[1px] bg-neon z-50 shadow-[0_0_12px_#00FF41]"
          />
        )}
      </AnimatePresence>

      {/* LEFT SPLIT SHUTTER PANEL */}
      <motion.div
        initial={{ x: 0 }}
        animate={{ x: isSplitting ? '-100%' : 0 }}
        transition={{
          duration: 0.65,
          ease: [0.77, 0, 0.175, 1],
        }}
        className="absolute top-0 left-0 w-1/2 h-full bg-[#070707] border-r border-neon/40 flex flex-col justify-between p-6 md:p-12 overflow-hidden shadow-[10px_0_30px_rgba(0,0,0,0.9)]"
      >
        {/* CRT Scanline & Grid pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#00ff41_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />
        <div className="absolute inset-0 scanline pointer-events-none opacity-40" />

        {/* Top left identity */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-8 h-8 bg-[#0D1F0D] border border-neon flex items-center justify-center">
            <Cpu className="w-4 h-4 text-neon animate-pulse" />
          </div>
          <div>
            <div className="text-sm font-bold text-neon tracking-widest uppercase glow-text">
              AERO_OS // CORE
            </div>
            <div className="text-[10px] text-[#A0A0A0]">
              SYS_REV_3.4.19 / REGION: ASIA-SE1
            </div>
          </div>
        </div>

        {/* Center-left graphic: Hexagon Radar */}
        <div className="relative z-10 flex flex-col items-center justify-center my-auto">
          <div className="relative w-36 h-36 md:w-48 md:h-48 flex items-center justify-center">
            {/* Outer rotating ring */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 border border-dashed border-neon/30 rounded-full"
            />
            {/* Inner counter-rotating ring */}
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-4 border border-neon/50 rounded-full border-t-transparent border-b-transparent"
            />
            {/* Core Box */}
            <div className="w-16 h-16 bg-[#0D1F0D] border-2 border-neon flex flex-col items-center justify-center shadow-[0_0_15px_rgba(0,255,65,0.4)]">
              <Zap className="w-7 h-7 text-neon animate-bounce" />
            </div>
          </div>

          <div className="mt-4 text-center">
            <span className="text-[11px] text-[#A0A0A0] uppercase tracking-wider block">
              CO-LOCATION MATRIX ENGINE
            </span>
            <span className="text-xs text-neon font-bold">
              SYNERGY ACCELERATION: 1.30×
            </span>
          </div>
        </div>

        {/* Bottom Left System Specs */}
        <div className="relative z-10 text-[10px] text-[#666] flex flex-wrap gap-4 border-t border-[#1A1A1A] pt-3">
          <span>TDP CAP: 400W</span>
          <span>MEMORY HBM3: 80GB/GPU</span>
          <span>NVLINK: 900 GB/s</span>
        </div>
      </motion.div>

      {/* RIGHT SPLIT SHUTTER PANEL */}
      <motion.div
        initial={{ x: 0 }}
        animate={{ x: isSplitting ? '100%' : 0 }}
        transition={{
          duration: 0.65,
          ease: [0.77, 0, 0.175, 1],
        }}
        className="absolute top-0 right-0 w-1/2 h-full bg-[#070707] border-l border-neon/40 flex flex-col justify-between p-6 md:p-12 overflow-hidden shadow-[-10px_0_30px_rgba(0,0,0,0.9)]"
      >
        {/* CRT Scanline & Grid pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#00ff41_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />
        <div className="absolute inset-0 scanline pointer-events-none opacity-40" />

        {/* Top Right Controls */}
        <div className="relative z-10 flex justify-end items-center gap-3">
          <button
            onClick={handleSkip}
            className="px-3 py-1.5 bg-[#0D1F0D] border border-neon text-neon text-xs font-bold hover:bg-neon hover:text-[#0A0A0A] transition-all flex items-center gap-1.5 cursor-pointer shadow-[0_0_8px_rgba(0,255,65,0.2)] active:scale-95"
          >
            <span>ENTER CLUSTER</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Center Right: Realtime Diagnostic Boot Log & Big Progress Number */}
        <div className="relative z-10 my-auto flex flex-col justify-center gap-4 max-w-md ml-auto w-full">
          {/* Progress Percentage Display */}
          <div className="flex items-baseline justify-between border-b border-[#1A1A1A] pb-2">
            <div>
              <span className="text-[10px] text-[#A0A0A0] uppercase block">SYSTEM HYDRATION</span>
              <span className="text-xs text-[#40e56c] font-bold">
                {progress >= 100 ? 'ACCESS GRANTED // SYNCHRONIZED' : 'INITIALIZING CLUSTER DAEMON...'}
              </span>
            </div>
            <div className="font-mono text-4xl md:text-5xl font-black text-neon glow-text tracking-tighter">
              {progress < 10 ? `00${progress}` : progress < 100 ? `0${progress}` : '100'}%
            </div>
          </div>

          {/* Segmented Neon Progress Bar */}
          <div className="w-full bg-[#111111] p-1 border border-[#222222]">
            <div className="h-3 bg-[#0A0A0A] relative overflow-hidden flex gap-[2px]">
              {Array.from({ length: 24 }).map((_, i) => {
                const filled = i / 24 < progress / 100;
                return (
                  <div
                    key={i}
                    className={`flex-1 h-full transition-all duration-75 ${
                      filled
                        ? 'bg-neon shadow-[0_0_4px_#00FF41]'
                        : 'bg-[#1A1A1A]'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Realtime Boot Log Box */}
          <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-3 h-40 overflow-hidden flex flex-col justify-end text-[11px] space-y-1">
            {BOOT_LOGS.slice(0, logIndex + 1).map((log, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between text-[#A0A0A0] leading-tight"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="text-neon font-bold">[{log.time}]</span>
                  <span className="text-[#e5e2e1] truncate">{log.text}</span>
                </div>
                <span className="text-neon font-bold shrink-0 ml-2">OK</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom Right Equalizer Activity Bars */}
        <div className="relative z-10 flex items-center justify-between border-t border-[#1A1A1A] pt-3 text-[10px] text-[#666]">
          <span>NVML PROTOCOL: ACTIVE</span>
          <div className="flex items-end gap-1 h-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={i}
                animate={{ height: ['20%', '100%', '40%', '80%', '30%'] }}
                transition={{
                  duration: 0.8 + (i * 0.1),
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="w-1 bg-neon shadow-[0_0_3px_#00FF41]"
              />
            ))}
          </div>
          <span>K8S EXTENDER: READY</span>
        </div>
      </motion.div>

      {/* CENTER GLITCH FLASH ON UNLOCK */}
      <AnimatePresence>
        {isSplitting && (
          <motion.div
            initial={{ opacity: 0.9 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 bg-neon pointer-events-none z-[10000] mix-blend-screen"
          />
        )}
      </AnimatePresence>
    </div>
  );
};
