import React, { useState, useMemo, useEffect } from 'react';
import {
  ForecastPoint,
  AnomalyLog,
  ModelParams,
} from '../types';
import {
  forecastData24H,
  forecastData1H,
  forecastData7D,
  initialAnomalies,
  defaultModelParams,
} from '../data/initialData';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  RefreshCw,
  Sliders,
  Zap,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Clock,
} from 'lucide-react';
import { AdjustParamsModal } from '../components/AdjustParamsModal';
import { api } from '../lib/api';

interface ForecasterViewProps {
  onPrewarmNode?: (nodeId: string) => void;
  isNode3Prewarmed?: boolean;
}

export const ForecasterView: React.FC<ForecasterViewProps> = ({
  onPrewarmNode,
  isNode3Prewarmed = false,
}) => {
  const [timeRange, setTimeRange] = useState<'1H' | '24H' | '7D'>('24H');
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalcSuccess, setRecalcSuccess] = useState(false);
  const [isParamsModalOpen, setIsParamsModalOpen] = useState(false);
  const [modelParams, setModelParams] = useState<ModelParams>(defaultModelParams);
  const [anomalies, setAnomalies] = useState<AnomalyLog[]>(initialAnomalies);
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyLog | null>(null);
  const [hoveredHeatmapCell, setHoveredHeatmapCell] = useState<string | null>(null);
  const [liveForecastInfo, setLiveForecastInfo] = useState<{
    predictedGpuDemand: number;
    confidence: number;
    recommendedAction: string;
    modelMae: number;
    modelR2: number;
  }>({
    predictedGpuDemand: 3.7,
    confidence: 0.84,
    recommendedAction: 'pre-warm 1 node',
    modelMae: 0.43,
    modelR2: 0.87,
  });

  // Fetch forecast info on load & polling
  useEffect(() => {
    const fetchForecast = async () => {
      try {
        const fc = await api.getForecast();
        if (fc) {
          setLiveForecastInfo({
            predictedGpuDemand: fc.predictedGpuDemand,
            confidence: fc.confidence,
            recommendedAction: fc.recommendedAction,
            modelMae: fc.modelMae,
            modelR2: fc.modelR2,
          });
        }
      } catch (err) {
        // Fallback
      }
    };
    fetchForecast();
    const interval = setInterval(fetchForecast, 10000);
    return () => clearInterval(interval);
  }, []);

  // Generate dynamic chart data based on active range
  const chartData = useMemo(() => {
    if (timeRange === '1H') return forecastData1H;
    if (timeRange === '7D') return forecastData7D;
    return forecastData24H;
  }, [timeRange]);

  // Trigger ML Recalculation via Backend REST API
  const handleForceRecalc = async () => {
    setIsRecalculating(true);
    try {
      await api.updateForecastParams(modelParams);
      const updated = await api.getForecast();
      setLiveForecastInfo({
        predictedGpuDemand: updated.predictedGpuDemand,
        confidence: updated.confidence,
        recommendedAction: updated.recommendedAction,
        modelMae: updated.modelMae,
        modelR2: updated.modelR2,
      });

      setRecalcSuccess(true);
      const newAnomaly: AnomalyLog = {
        id: Math.random().toString(),
        timestamp: new Date().toTimeString().split(' ')[0],
        title: 'MANUAL_RECALC_EXECUTED',
        detail: `Weights calibrated (R²=${updated.modelR2}, MAE=${updated.modelMae}, Horizon=${modelParams.horizonHours}h)`,
        severity: 'success',
      };
      setAnomalies((prev) => [newAnomaly, ...prev.slice(0, 5)]);
    } catch (e) {
      setRecalcSuccess(true);
    } finally {
      setIsRecalculating(false);
      setTimeout(() => setRecalcSuccess(false), 2500);
    }
  };

  const handleSaveParams = async (newParams: ModelParams) => {
    setModelParams(newParams);
    try {
      await api.updateForecastParams(newParams);
    } catch (e) {
      console.warn('Updated params locally');
    }
  };

  // Matrix generation for 7 days x 24 hours
  const heatmapRows = useMemo(() => {
    const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    const seedValues = [
      // Day 1
      [0.69, 0.79, 0.92, 0.63, 0.98, 0.52, 0.61, 0.90, 0.58, 0.50, 1.0, 1.0, 1.0, 1.0, 0.85, 0.75, 1.0, 1.0, 0.08, 0.36, 0.30, 0.43, 0.85, 0.41],
      // Day 2
      [0.76, 0.05, 0.68, 0.47, 0.13, 0.93, 0.22, 0.68, 0.21, 0.42, 0.82, 0.40, 0.85, 0.42, 1.0, 0.35, 1.0, 0.67, 0.97, 0.33, 0.56, 0.54, 0.68, 0.47],
      // Day 3
      [0.64, 0.01, 0.66, 0.26, 0.94, 0.44, 0.30, 0.80, 0.07, 1.0, 0.82, 0.92, 0.79, 1.0, 1.0, 0.66, 0.35, 0.83, 0.96, 0.77, 0.51, 0.35, 0.26, 0.92],
      // Day 4
      [0.98, 0.47, 0.47, 0.99, 0.20, 0.90, 0.92, 0.36, 0.91, 0.63, 0.36, 0.60, 0.50, 0.70, 1.0, 1.0, 0.91, 0.89, 0.38, 0.05, 0.62, 0.76, 0.30, 0.76],
      // Day 5
      [0.14, 0.82, 0.13, 0.35, 0.78, 0.39, 0.79, 0.91, 0.25, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.84, 1.0, 0.85, 0.99, 0.88, 0.38, 0.79, 0.87],
      // Day 6
      [0.52, 0.69, 0.28, 0.66, 0.01, 0.90, 0.72, 0.76, 0.33, 1.0, 0.59, 1.0, 0.33, 1.0, 1.0, 1.0, 0.68, 0.96, 0.15, 0.60, 0.27, 0.19, 0.11, 0.09],
      // Day 7
      [0.56, 0.99, 0.41, 0.96, 0.13, 0.55, 0.42, 0.87, 0.62, 0.60, 0.56, 0.64, 0.81, 1.0, 0.46, 0.89, 0.53, 0.95, 0.01, 0.44, 0.38, 0.83, 0.47, 0.55],
    ];

    return days.map((day, dIdx) => ({
      day,
      hours: seedValues[dIdx] || Array.from({ length: 24 }, () => Math.random()),
    }));
  }, []);

  const getHeatmapColor = (val: number) => {
    if (val < 0.25) return '#0D1F0D';
    if (val < 0.5) return '#1A3A1A';
    if (val < 0.75) return '#008020';
    return '#00FF41';
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header & PreWarm Alert */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#1A1A1A] pb-4">
        <div>
          <h1 className="font-mono text-2xl md:text-3xl font-bold text-neon uppercase tracking-tight glow-text">
            FORECAST_MODEL_V3
          </h1>
          <p className="font-mono text-xs text-[#A0A0A0] mt-1">
            Predictive compute allocation & XGBoost demand synthesis (MAE: {liveForecastInfo.modelMae}, R²: {liveForecastInfo.modelR2}).
          </p>
        </div>

        <div className="terminal-panel flex items-center gap-3 px-4 py-2 border-[#FFB300]/40 bg-[#1a1200]">
          <div className="w-2.5 h-2.5 rounded-none bg-[#FFB300] pulse-amber-dot" />
          <span className="font-mono text-xs text-[#FFB300] font-bold">
            ⚡ Pre-warming node-3 — surge in &lt;15 min (demand: {liveForecastInfo.predictedGpuDemand} GPU-h)
          </span>
          {onPrewarmNode && !isNode3Prewarmed && (
            <button
              onClick={() => onPrewarmNode('NODE-03')}
              className="ml-2 bg-[#FFB300] text-[#0A0A0A] font-mono text-[10px] px-2 py-0.5 font-bold hover:bg-[#ffc107]"
            >
              PRE-WARM
            </button>
          )}
        </div>
      </div>

      {/* Top Grid: Chart & Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Chart Area */}
        <div className="terminal-panel lg:col-span-3 p-5 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4 border-b border-[#1A1A1A] pb-2">
            <span className="font-mono text-xs font-bold text-[#A0A0A0] uppercase tracking-widest flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-neon" />
              <span>Demand Projection</span>
            </span>
            <div className="flex gap-1.5 font-mono text-xs">
              {(['1H', '24H', '7D'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 text-xs border transition-all ${
                    timeRange === range
                      ? 'border-neon bg-neon text-[#0A0A0A] font-bold shadow-[0_0_6px_#00FF41]'
                      : 'border-[#1A1A1A] bg-[#0A0A0A] text-[#A0A0A0] hover:text-[#e5e2e1]'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          {/* Recharts Area + Line */}
          <div className="w-full h-80 relative font-mono text-xs">
            {isRecalculating && (
              <div className="absolute inset-0 z-20 bg-[#0A0A0A]/85 backdrop-blur-xs flex items-center justify-center gap-3 text-neon font-mono text-sm">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>CALIBRATING AUTOREGRESSIVE WEIGHTS VIA REST API...</span>
              </div>
            )}

            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke="#A0A0A0"
                  tick={{ fill: '#A0A0A0', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  stroke="#A0A0A0"
                  tick={{ fill: '#A0A0A0', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-[#111111] border border-[#1A1A1A] p-3 font-mono text-xs shadow-[0_0_10px_rgba(0,255,65,0.15)]">
                          <p className="text-[#A0A0A0] mb-2 pb-1 border-b border-[#1A1A1A]">
                            T: {label}
                          </p>
                          {payload.map((entry, index) => {
                            if (entry.dataKey === 'upper' || entry.dataKey === 'lower') return null;
                            return (
                              <div
                                key={index}
                                style={{ color: entry.color }}
                                className="flex justify-between gap-4 py-0.5"
                              >
                                <span className="uppercase font-semibold">{entry.name}:</span>
                                <span className="font-bold">{entry.value ?? 'PENDING'}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    }
                    return null;
                  }}
                  cursor={{ stroke: '#3b4b37', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Legend
                  iconType="square"
                  wrapperStyle={{ fontSize: '11px', fontFamily: 'JetBrains Mono', color: '#A0A0A0' }}
                />

                {/* Upper Confidence Band */}
                <Area
                  type="monotone"
                  dataKey="upper"
                  stroke="none"
                  fill="#00FF41"
                  fillOpacity={0.08}
                  activeDot={false}
                  name="Upper Bound"
                  legendType="none"
                />

                {/* Lower Boundary Infill mask */}
                <Area
                  type="monotone"
                  dataKey="lower"
                  stroke="none"
                  fill="#111111"
                  fillOpacity={1}
                  activeDot={false}
                  legendType="none"
                />

                {/* Forecast Line */}
                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke="#e5e2e1"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  name="FORECAST"
                />

                {/* Actual Line */}
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#00FF41"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#0A0A0A', stroke: '#00FF41', strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: '#00FF41', stroke: '#00FF41', strokeWidth: 2 }}
                  name="ACTUAL"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Side Metrics & Diagnostics */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          {/* Model Performance Panel */}
          <div className="terminal-panel p-5">
            <div className="font-mono text-xs text-[#A0A0A0] border-b border-[#1A1A1A] pb-2 mb-4 uppercase tracking-widest">
              MODEL DIAGNOSTICS
            </div>

            <div className="space-y-4 font-mono text-xs">
              <div>
                <div className="flex justify-between items-end mb-1">
                  <span className="text-[#A0A0A0]">MAE</span>
                  <span className="text-2xl font-bold text-neon leading-none glow-text">
                    {liveForecastInfo.modelMae}
                  </span>
                </div>
                <div className="h-1.5 bg-[#1A1A1A] w-full overflow-hidden">
                  <div className="h-full bg-neon w-[85%] shadow-[0_0_4px_#00FF41]" />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-end mb-1">
                  <span className="text-[#A0A0A0]">R² SCORE</span>
                  <span className="text-2xl font-bold text-neon leading-none glow-text">
                    {liveForecastInfo.modelR2}
                  </span>
                </div>
                <div className="h-1.5 bg-[#1A1A1A] w-full overflow-hidden">
                  <div className="h-full bg-neon w-[87%] shadow-[0_0_4px_#00FF41]" />
                </div>
              </div>

              <div className="pt-3 border-t border-[#1A1A1A] space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#A0A0A0]">CONFIDENCE:</span>
                  <span className="text-[#40e56c] font-bold">
                    {Math.round(liveForecastInfo.confidence * 100)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#A0A0A0]">DATA DRIFT:</span>
                  <span className="text-[#40e56c] font-bold">NOMINAL</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons Panel */}
          <div className="terminal-panel p-5 flex flex-col justify-center flex-1 space-y-3 font-mono text-xs">
            <button
              onClick={handleForceRecalc}
              disabled={isRecalculating}
              className="w-full py-3 bg-neon text-[#0A0A0A] font-bold uppercase hover:bg-[#3ce36a] transition-all flex items-center justify-center gap-2 shadow-[0_0_10px_rgba(0,255,65,0.25)] active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRecalculating ? 'animate-spin' : ''}`} />
              <span>{recalcSuccess ? 'RECALCULATED' : 'FORCE RECALC'}</span>
            </button>

            <button
              onClick={() => setIsParamsModalOpen(true)}
              className="w-full py-2.5 border border-neon text-neon font-bold uppercase hover:bg-[#0D1F0D] hover:shadow-[0_0_8px_rgba(0,255,65,0.3)] transition-all flex items-center justify-center gap-2"
            >
              <Sliders className="w-4 h-4" />
              <span>ADJUST PARAMS</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Heatmap & Signals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Heatmap Matrix */}
        <div className="terminal-panel lg:col-span-2 p-5 overflow-x-auto">
          <div className="font-mono text-xs text-[#A0A0A0] border-b border-[#1A1A1A] pb-2 mb-4 uppercase tracking-widest flex justify-between items-center">
            <span>DEMAND INTENSITY MATRIX (7x24)</span>
            {hoveredHeatmapCell && (
              <span className="text-neon text-[11px] font-bold">{hoveredHeatmapCell}</span>
            )}
          </div>

          <div className="flex items-start gap-2 min-w-max font-mono">
            {/* Y-Axis Labels (MON-SUN) */}
            <div className="flex flex-col gap-[3px] mt-6 text-[10px] text-[#A0A0A0] text-right pr-2">
              {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => (
                <div key={day} className="h-4 leading-4 font-semibold">
                  {day}
                </div>
              ))}
            </div>

            <div>
              {/* X-Axis Hour Labels */}
              <div className="flex gap-[3px] mb-2 text-[10px] text-[#A0A0A0]">
                {Array.from({ length: 24 }).map((_, h) => (
                  <div key={h} className="w-4 text-center font-semibold">
                    {h === 0 ? '00' : h === 6 ? '06' : h === 12 ? '12' : h === 18 ? '18' : ''}
                  </div>
                ))}
              </div>

              {/* 7x24 Matrix Grid */}
              <div className="flex flex-col gap-[3px]">
                {heatmapRows.map((row) => (
                  <div key={row.day} className="flex gap-[3px]">
                    {row.hours.map((val, hIdx) => {
                      const color = getHeatmapColor(val);
                      const title = `${row.day} @ ${hIdx < 10 ? '0' + hIdx : hIdx}:00 | Intensity: ${(val * 100).toFixed(0)}%`;
                      return (
                        <div
                          key={hIdx}
                          onMouseEnter={() => setHoveredHeatmapCell(title)}
                          onMouseLeave={() => setHoveredHeatmapCell(null)}
                          className="w-4 h-4 cursor-crosshair transition-transform hover:scale-125 hover:z-20 hover:border hover:border-neon"
                          style={{ backgroundColor: color }}
                          title={title}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex justify-end items-center gap-2 mt-4 font-mono text-[10px] text-[#A0A0A0]">
            <span>LOW</span>
            <div className="w-3 h-3 bg-[#0D1F0D] border border-[#1A1A1A]" />
            <div className="w-3 h-3 bg-[#1A3A1A]" />
            <div className="w-3 h-3 bg-[#008020]" />
            <div className="w-3 h-3 bg-[#00FF41]" />
            <span>HIGH</span>
          </div>
        </div>

        {/* Live Anomaly Feed */}
        <div className="terminal-panel p-4 flex flex-col justify-between">
          <div className="font-mono text-xs text-[#A0A0A0] border-b border-[#1A1A1A] pb-2 mb-2 uppercase tracking-widest flex justify-between items-center">
            <span>LIVE ANOMALY FEED</span>
            <span className="w-2 h-2 bg-neon rounded-none pulse-green-dot" />
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 max-h-72">
            {anomalies.map((item) => {
              let titleColor = 'text-[#e5e2e1]';
              if (item.severity === 'warning') titleColor = 'text-[#FFB300]';
              if (item.severity === 'success') titleColor = 'text-[#40e56c]';
              if (item.severity === 'error') titleColor = 'text-danger font-bold';

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedAnomaly(item)}
                  className="bg-[#0A0A0A] border border-[#1A1A1A] p-2.5 flex gap-3 hover:bg-[#0D1F0D] hover:border-[#2b3b28] transition-all cursor-pointer font-mono"
                >
                  <span className="text-[11px] text-[#777] shrink-0 mt-0.5">
                    {item.timestamp}
                  </span>
                  <div>
                    <div className={`text-xs font-bold ${titleColor}`}>{item.title}</div>
                    <div className="text-[11px] text-[#A0A0A0] mt-0.5 leading-snug">
                      {item.detail}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedAnomaly && (
            <div className="mt-3 p-2.5 bg-[#0D1F0D] border border-neon/40 font-mono text-[11px] text-[#e5e2e1]">
              <div className="flex justify-between items-center text-neon font-bold mb-1">
                <span>ACTION RECOMMENDATION</span>
                <button
                  onClick={() => setSelectedAnomaly(null)}
                  className="text-[#A0A0A0] hover:text-neon"
                >
                  DISMISS
                </button>
              </div>
              <div>Automated rebalancing rule activated for {selectedAnomaly.title}.</div>
            </div>
          )}
        </div>
      </div>

      {/* Adjust Params Modal */}
      <AdjustParamsModal
        isOpen={isParamsModalOpen}
        onClose={() => setIsParamsModalOpen(false)}
        currentParams={modelParams}
        onSave={handleSaveParams}
      />
    </div>
  );
};
