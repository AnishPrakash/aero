import React from 'react';
import { motion } from 'motion/react';
import { ViewType } from '../types';
import { 
  LayoutDashboard, 
  BarChart3, 
  TrendingUp, 
  Cpu, 
  HelpCircle, 
  Terminal,
  RotateCcw,
  Sparkles
} from 'lucide-react';

interface SidebarProps {
  currentView: ViewType;
  onSelectView: (view: ViewType) => void;
  onOpenSupport: () => void;
  onOpenLogs: () => void;
  onReplayIntro?: () => void;
  isPrewarmingActive?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  onOpenSupport,
  onOpenLogs,
  onReplayIntro,
  isPrewarmingActive = false,
}) => {
  const navItems = [
    { id: 'dashboard' as ViewType, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'analytics' as ViewType, label: 'Analytics', icon: BarChart3 },
    { id: 'forecaster' as ViewType, label: 'Forecaster', icon: TrendingUp, hasAlert: isPrewarmingActive },
    { id: 'cluster' as ViewType, label: 'Cluster', icon: Cpu },
    { id: 'topology' as ViewType, label: '3D Silicon', icon: Sparkles },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-64 z-40 hidden md:flex flex-col bg-[#111111] border-r border-[#1A1A1A]">
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[#1A1A1A]">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onSelectView('dashboard')}>
          <span className="font-mono text-2xl font-bold tracking-tighter text-neon glow-text">AERO</span>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-[#0D1F0D] border border-neon/30 text-neon">
            v3.4-prod
          </span>
        </div>
      </div>

      {/* Operator Info Card */}
      <div className="p-4 border-b border-[#1A1A1A]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1A1A1A] flex items-center justify-center border border-neon relative">
            <Terminal className="w-5 h-5 text-neon" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-neon rounded-none shadow-[0_0_6px_#00FF41]" />
          </div>
          <div>
            <div className="font-mono text-sm font-semibold text-neon tracking-wide">OPERATOR_01</div>
            <div className="font-mono text-xs text-[#A0A0A0] flex items-center gap-1.5">
              <span>System Admin</span>
              <span className="inline-block w-1.5 h-1.5 bg-neon rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 py-4 flex flex-col gap-1 relative">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors text-sm uppercase tracking-wider font-mono relative cursor-pointer ${
                isActive
                  ? 'text-neon font-bold'
                  : 'text-[#A0A0A0] hover:bg-[#1A1A1A]/60 hover:text-neon'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeSidebarIndicator"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  className="absolute inset-0 bg-[#0D1F0D] border-l-4 border-neon shadow-[inset_0_0_12px_rgba(0,255,65,0.08)] pointer-events-none"
                />
              )}
              <div className="flex items-center gap-4 relative z-10">
                <Icon className={`w-4 h-4 ${isActive ? 'text-neon' : 'text-[#A0A0A0]'}`} />
                <span>{item.label}</span>
              </div>
              {item.hasAlert && (
                <span className="w-2 h-2 bg-[#FFB300] pulse-amber-dot relative z-10" title="Surge Alert Active" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Cluster Quick Status Bar */}
      <div className="p-4 border-t border-[#1A1A1A] bg-[#0A0A0A]">
        <div className="flex items-center justify-between font-mono text-[11px] text-[#A0A0A0] mb-2">
          <span>K8S FABRIC</span>
          <span className="text-neon flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-neon inline-block" /> 24 NODES
          </span>
        </div>
        <div className="w-full bg-[#1A1A1A] h-1.5 overflow-hidden">
          <div className="bg-neon h-full w-[76%] transition-all duration-500" />
        </div>
      </div>

      {/* Secondary Bottom Links */}
      <div className="border-t border-[#1A1A1A] py-2">
        {onReplayIntro && (
          <button
            onClick={onReplayIntro}
            className="w-full flex items-center gap-4 text-[#A0A0A0] px-4 py-2.5 hover:bg-[#0D1F0D] hover:text-neon transition-colors font-mono text-xs uppercase cursor-pointer"
            title="Re-run the boot preloader sequence"
          >
            <RotateCcw className="w-4 h-4 text-neon" />
            <span className="flex items-center justify-between w-full">
              <span>Replay Boot Sequence</span>
              <span className="text-[9px] bg-[#0D1F0D] px-1 text-neon border border-neon/40">SPLIT FX</span>
            </span>
          </button>
        )}
        <button
          onClick={onOpenSupport}
          className="w-full flex items-center gap-4 text-[#A0A0A0] px-4 py-2.5 hover:bg-[#1A1A1A] hover:text-neon transition-colors font-mono text-xs uppercase cursor-pointer"
        >
          <HelpCircle className="w-4 h-4" />
          <span>Support & Diagnostics</span>
        </button>
        <button
          onClick={onOpenLogs}
          className="w-full flex items-center gap-4 text-[#A0A0A0] px-4 py-2.5 hover:bg-[#1A1A1A] hover:text-neon transition-colors font-mono text-xs uppercase cursor-pointer"
        >
          <Terminal className="w-4 h-4" />
          <span className="flex items-center justify-between w-full">
            <span>Logs</span>
            <span className="text-[10px] bg-[#1A1A1A] px-1 text-neon border border-[#2b3b28]">TAIL -F</span>
          </span>
        </button>
      </div>
    </aside>
  );
};
