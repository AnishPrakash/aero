import React from 'react';
import { motion } from 'motion/react';
import { ViewType } from '../types';
import { Bell, Settings, Menu, X, Terminal, Zap, RotateCcw } from 'lucide-react';

interface TopNavProps {
  currentView: ViewType;
  onSelectView: (view: ViewType) => void;
  onOpenSubmitJob: () => void;
  onOpenLogs: () => void;
  onReplayIntro?: () => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  currentView,
  onSelectView,
  onOpenSubmitJob,
  onOpenLogs,
  onReplayIntro,
  mobileMenuOpen,
  setMobileMenuOpen,
}) => {
  const tabs: { id: ViewType; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'forecaster', label: 'Forecaster' },
    { id: 'cluster', label: 'Cluster' },
    { id: 'topology', label: '3D Silicon' },
  ];

  return (
    <>
      {/* Desktop Top Nav Header bar (Matching screens 4 & 5) */}
      <header className="hidden md:flex fixed top-0 w-full z-30 h-16 bg-[#111111] border-b border-[#1A1A1A] px-6 pl-72 justify-between items-center">
        <div className="flex items-center gap-8 h-full">
          <div className="flex items-center h-full gap-6">
            {tabs.map((tab) => {
              const isActive = currentView === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onSelectView(tab.id)}
                  className={`h-full flex items-center font-mono text-sm uppercase transition-colors relative px-1 cursor-pointer ${
                    isActive
                      ? 'text-neon font-semibold'
                      : 'text-[#A0A0A0] hover:text-[#e5e2e1]'
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <motion.span
                      layoutId="activeTabUnderline"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-neon shadow-[0_0_8px_#00FF41]"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 bg-[#0A0A0A] border border-[#1A1A1A] text-xs font-mono text-[#A0A0A0]">
            <span className="w-2 h-2 rounded-none bg-neon inline-block animate-pulse" />
            <span>FABRIC HEALTH: 100%</span>
          </div>

          {onReplayIntro && (
            <button
              onClick={onReplayIntro}
              className="text-[#A0A0A0] hover:text-neon transition-colors p-2 hover:bg-[#1A1A1A] cursor-pointer"
              title="Replay Split-Screen Intro Animation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onOpenLogs}
            className="text-[#A0A0A0] hover:text-neon transition-colors p-2 hover:bg-[#1A1A1A] cursor-pointer"
            title="Open Live Terminal Logs"
          >
            <Terminal className="w-4 h-4" />
          </button>

          <button
            onClick={() => alert('Cluster alerts configured. 0 active critical alarms.')}
            className="text-[#A0A0A0] hover:text-neon transition-colors p-2 hover:bg-[#1A1A1A] cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenSubmitJob}
            className="bg-neon text-[#0A0A0A] font-bold text-xs uppercase px-4 py-2 hover:bg-[#3ce36a] transition-all font-mono shadow-[0_0_8px_rgba(0,255,65,0.15)] flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>SUBMIT JOB</span>
          </button>
        </div>
      </header>

      {/* Mobile Top Navigation */}
      <header className="md:hidden fixed top-0 w-full z-50 flex justify-between items-center px-4 h-16 bg-[#111111] border-b border-[#1A1A1A]">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => onSelectView('dashboard')}>
          <span className="font-mono text-xl font-bold text-neon tracking-tighter">AERO</span>
          <span className="text-[10px] uppercase font-mono px-1 py-0.5 bg-[#0D1F0D] border border-neon/30 text-neon">
            ORCHESTRATOR
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSubmitJob}
            className="bg-neon text-[#0A0A0A] font-bold text-xs uppercase px-3 py-1.5 font-mono cursor-pointer active:scale-95"
          >
            + JOB
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-[#A0A0A0] hover:text-neon p-2 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 z-40 bg-[#0A0A0A]/95 backdrop-blur-sm p-4 flex flex-col gap-2 border-b border-[#1A1A1A] animate-in fade-in slide-in-from-top-2 duration-150">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                onSelectView(tab.id);
                setMobileMenuOpen(false);
              }}
              className={`p-3 text-left font-mono text-sm uppercase flex items-center justify-between border ${
                currentView === tab.id
                  ? 'border-neon bg-[#0D1F0D] text-neon'
                  : 'border-[#1A1A1A] bg-[#111111] text-[#A0A0A0]'
              }`}
            >
              <span>{tab.label}</span>
              {currentView === tab.id && <span className="text-neon text-xs">● ACTIVE</span>}
            </button>
          ))}
          <div className="pt-4 mt-auto border-t border-[#1A1A1A] flex gap-2">
            {onReplayIntro && (
              <button
                onClick={() => {
                  onReplayIntro();
                  setMobileMenuOpen(false);
                }}
                className="flex-1 py-2.5 bg-[#0D1F0D] border border-neon/40 text-neon font-mono text-xs uppercase"
              >
                REPLAY INTRO
              </button>
            )}
            <button
              onClick={() => {
                onOpenLogs();
                setMobileMenuOpen(false);
              }}
              className="flex-1 py-2.5 bg-[#111111] border border-[#1A1A1A] text-[#A0A0A0] font-mono text-xs uppercase"
            >
              SYSTEM LOGS
            </button>
          </div>
        </div>
      )}
    </>
  );
};
