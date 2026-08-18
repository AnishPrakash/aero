import React, { useState, useEffect } from 'react';
import { jobEnergyBarData, powerPolicies } from '../data/initialData';
import { Zap, Shield, TrendingDown, Info, Activity } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { api, ApiEnergySummary } from '../lib/api';

const cumulative24hData = [
  { time: '00:00', baseline: 780, aero: 540 },
  { time: '03:00', baseline: 650, aero: 460 },
  { time: '06:00', baseline: 820, aero: 580 },
  { time: '09:00', baseline: 920, aero: 640 },
  { time: '12:00', baseline: 890, aero: 612 },
  { time: '15:00', baseline: 950, aero: 660 },
  { time: '18:00', baseline: 880, aero: 590 },
  { time: '21:00', baseline: 790, aero: 530 },
  { time: '24:00', baseline: 720, aero: 490 },
];

export const AnalyticsView: React.FC = () => {
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [energySummary, setEnergySummary] = useState<ApiEnergySummary | null>(null);

  useEffect(() => {
    const fetchEnergy = async () => {
      try {
        const data = await api.getEnergySummary();
        if (data) setEnergySummary(data);
      } catch (e) {
        // Fallback
      }
    };

    fetchEnergy();
    const interval = setInterval(fetchEnergy, 5000);
    return () => clearInterval(interval);
  }, []);

  const totalAeroWh = energySummary?.totalAeroWh ?? 612;
  const totalBaseWh = energySummary?.totalBaselineWh ?? 890;
  const savingsPct = energySummary?.cumulativeSavingsPct ?? 31.2;
  const savingsWh = totalBaseWh - totalAeroWh;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="border-b border-[#1A1A1A] pb-4">
        <h1 className="font-mono text-2xl md:text-3xl font-bold text-[#e5e2e1] uppercase tracking-tight">
          Analytics Engine
        </h1>
        <p className="font-mono text-xs text-[#A0A0A0] mt-1">
          System performance and NVML dynamic energy consumption diagnostics.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Hero Stat Block */}
        <div className="md:col-span-12 terminal-panel p-6 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center">
          <div className="z-10">
            <div className="font-mono text-xs text-[#A0A0A0] mb-3 uppercase tracking-widest border-b border-[#1A1A1A] pb-1 inline-block">
              Energy Delta Overview
            </div>
            <div className="flex items-baseline gap-4 mb-2">
              <span className="font-mono text-3xl md:text-4xl font-bold text-neon glow-text tracking-tight">
                {savingsPct}% ↓ Energy Reduction
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-6 mt-4 font-mono text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-white block" />
                <span className="text-white font-semibold">AERO: {totalAeroWh} Wh</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-[#333333] block" />
                <span className="text-[#A0A0A0]">Default K8s: {totalBaseWh} Wh</span>
              </div>
              <div className="flex items-center gap-2 text-neon text-[11px] bg-[#0D1F0D] px-2 py-1 border border-neon/30">
                <TrendingDown className="w-3.5 h-3.5" />
                <span>SAVINGS RATE: -{savingsWh} Wh / hr</span>
              </div>
            </div>
          </div>

          <div className="z-10 mt-6 md:mt-0 text-right">
            <div className="font-mono text-xs text-[#A0A0A0] bg-[#0e0e0e] p-3 border border-[#1A1A1A] font-semibold text-left md:text-right">
              <code>Savings = ∫(P_default - P_aero) dt</code>
            </div>
          </div>

          {/* Watermark Icon */}
          <div className="absolute right-0 bottom-0 w-64 h-64 opacity-5 pointer-events-none flex items-center justify-center">
            <Zap className="w-full h-full text-neon" />
          </div>
        </div>

        {/* Grouped Bar Chart */}
        <div className="md:col-span-6 terminal-panel p-5 flex flex-col justify-between">
          <div>
            <div className="font-mono text-xs text-[#A0A0A0] mb-2 uppercase border-b border-[#1A1A1A] pb-2 flex justify-between items-center">
              <span>Job Energy Consumption (Wh)</span>
              <div className="flex gap-4 font-mono text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-[#00FF41]" />
                  <span className="text-neon font-bold">AERO</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-[#333333]" />
                  <span className="text-[#A0A0A0]">Baseline</span>
                </div>
              </div>
            </div>
            <p className="font-mono text-[11px] text-[#777] mb-4">
              Per-job workload power draw comparisons across GPU memory architectures.
            </p>
          </div>

          {/* Grouped Bar Graph */}
          <div className="relative pt-4 pb-8 border-b border-[#1A1A1A]">
            {/* Y-Axis tick markers */}
            <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-[#666] font-mono text-[10px] w-8 border-r border-[#1A1A1A] pr-1.5 items-end">
              <span>250</span>
              <span>125</span>
              <span>0</span>
            </div>

            {/* Bars Column Container */}
            <div className="pl-10 flex w-full h-44 items-end justify-around gap-2 sm:gap-4">
              {jobEnergyBarData.map((item) => {
                const baselineHeightPct = Math.round((item.baseline / 260) * 100);
                const aeroHeightPct = Math.round((item.aero / 260) * 100);
                const isHovered = selectedJob === item.name;

                return (
                  <div
                    key={item.name}
                    onMouseEnter={() => setSelectedJob(item.name)}
                    onMouseLeave={() => setSelectedJob(null)}
                    className={`flex flex-col items-center justify-end h-full flex-1 relative cursor-pointer group ${
                      isHovered ? 'opacity-100' : 'opacity-90'
                    }`}
                  >
                    {/* Tooltip on hover */}
                    {isHovered && (
                      <div className="absolute -top-14 z-30 bg-[#0A0A0A] border border-neon p-2 font-mono text-[10px] text-[#e5e2e1] shadow-[0_0_8px_rgba(0,255,65,0.3)] whitespace-nowrap">
                        <div className="font-bold text-neon">{item.name}</div>
                        <div>AERO: {item.aero} Wh | Base: {item.baseline} Wh</div>
                        <div className="text-[#A0A0A0] text-[9px]">{item.desc}</div>
                      </div>
                    )}

                    <div className="flex items-end gap-1.5 w-full justify-center">
                      {/* Baseline Bar */}
                      <div
                        style={{ height: `${baselineHeightPct}%` }}
                        className="w-3 sm:w-4 bg-[#333333] hover:bg-[#444] transition-all"
                        title={`Baseline: ${item.baseline} Wh`}
                      />
                      {/* AERO Bar */}
                      <div
                        style={{ height: `${aeroHeightPct}%` }}
                        className="w-3 sm:w-4 bg-neon shadow-[0_0_6px_rgba(0,255,65,0.3)] hover:brightness-110 transition-all"
                        title={`AERO: ${item.aero} Wh`}
                      />
                    </div>

                    <span className="font-mono text-[10px] text-[#A0A0A0] mt-2 absolute -bottom-6">
                      {item.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Power Policy Hierarchy Table */}
        <div className="md:col-span-6 terminal-panel p-5 flex flex-col">
          <div className="font-mono text-xs text-[#A0A0A0] mb-4 uppercase border-b border-[#1A1A1A] pb-2 flex justify-between items-center">
            <span>Power Policy Hierarchy</span>
            <Shield className="w-4 h-4 text-neon" />
          </div>

          <div className="overflow-x-auto flex-1 font-mono text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[#A0A0A0] border-b border-[#1A1A1A]">
                  <th className="py-2.5 px-2 font-normal">CLASS</th>
                  <th className="py-2.5 px-2 font-normal text-right">CAP (W)</th>
                  <th className="py-2.5 px-2 font-normal text-right">PRIORITY</th>
                </tr>
              </thead>
              <tbody>
                {powerPolicies.map((policy) => (
                  <tr
                    key={policy.class}
                    className="border-b border-[#1A1A1A] hover:bg-[#0D1F0D] transition-colors"
                  >
                    <td className="py-3 px-2 font-bold flex items-center gap-2">
                      <span className={`w-2 h-2 inline-block ${policy.dotBg}`} />
                      <span className={policy.color}>{policy.class}</span>
                    </td>
                    <td className={`py-3 px-2 text-right ${policy.color}`}>
                      {policy.capW.toFixed(2)}
                    </td>
                    <td className="py-3 px-2 text-right text-[#e5e2e1] font-bold">
                      {policy.priority}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-3 bg-[#0A0A0A] border border-[#1A1A1A] font-mono text-[11px] text-[#A0A0A0] flex items-center gap-2">
            <Info className="w-4 h-4 text-neon shrink-0" />
            <span>Power envelopes enforced via hardware RAPL/NVML power-cap registers in sub-10ms intervals.</span>
          </div>
        </div>

        {/* Cumulative Area Chart (24h) */}
        <div className="md:col-span-12 terminal-panel p-5">
          <div className="font-mono text-xs text-[#A0A0A0] mb-4 uppercase border-b border-[#1A1A1A] pb-2 flex justify-between items-center">
            <span>Cumulative Power Draw (24h)</span>
            <div className="flex gap-4 font-mono text-[11px]">
              <span className="text-neon font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 bg-neon" /> AERO Area
              </span>
              <span className="text-[#A0A0A0] flex items-center gap-1.5">
                <span className="w-2 h-2 bg-[#333333]" /> Baseline Area
              </span>
            </div>
          </div>

          {/* Recharts Area Chart */}
          <div className="w-full h-44 font-mono text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cumulative24hData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke="#A0A0A0"
                  tick={{ fill: '#A0A0A0', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  axisLine={{ stroke: '#1A1A1A' }}
                  tickLine={false}
                />
                <YAxis
                  stroke="#A0A0A0"
                  tick={{ fill: '#A0A0A0', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  axisLine={{ stroke: '#1A1A1A' }}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-[#111111] border border-[#1A1A1A] p-2.5 font-mono text-xs shadow-[0_0_8px_rgba(0,255,65,0.2)]">
                          <div className="text-[#A0A0A0] border-b border-[#1A1A1A] pb-1 mb-1">T: {label}</div>
                          <div className="text-white">Baseline: {payload[0]?.value} W</div>
                          <div className="text-neon font-bold">AERO: {payload[1]?.value} W</div>
                          <div className="text-[#40e56c] text-[10px] mt-1">
                            Delta: -{((payload[0]?.value as number) - (payload[1]?.value as number))} W (Savings)
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="baseline"
                  stroke="#555555"
                  fill="#222222"
                  fillOpacity={0.6}
                  name="Baseline Area"
                />
                <Area
                  type="monotone"
                  dataKey="aero"
                  stroke="#00FF41"
                  strokeWidth={2}
                  fill="#00FF41"
                  fillOpacity={0.25}
                  name="AERO Area"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
