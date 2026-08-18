import React, { useState } from 'react';
import { ModelParams } from '../types';
import { X, Sliders, RefreshCw, Check } from 'lucide-react';

interface AdjustParamsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentParams: ModelParams;
  onSave: (params: ModelParams) => void;
}

export const AdjustParamsModal: React.FC<AdjustParamsModalProps> = ({
  isOpen,
  onClose,
  currentParams,
  onSave,
}) => {
  const [params, setParams] = useState<ModelParams>({ ...currentParams });
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(params);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="terminal-panel w-full max-w-md relative border border-[#1A1A1A] bg-[#111111]">
        <div className="p-4 border-b border-[#1A1A1A] flex justify-between items-center bg-[#0A0A0A]">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-neon" />
            <h2 className="font-mono text-sm font-bold uppercase text-neon tracking-wider">
              Forecaster Hyperparameters
            </h2>
          </div>
          <button onClick={onClose} className="text-[#A0A0A0] hover:text-[#e5e2e1]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 font-mono text-xs">
          <div>
            <div className="flex justify-between text-[#A0A0A0] mb-1">
              <label>EXPONENTIAL SMOOTHING (ALPHA)</label>
              <span className="text-neon">{params.alpha}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.99"
              step="0.01"
              value={params.alpha}
              onChange={(e) => setParams({ ...params, alpha: parseFloat(e.target.value) })}
              className="w-full accent-[#00FF41] bg-[#0A0A0A]"
            />
            <div className="text-[10px] text-[#777] mt-0.5">Higher values react faster to recent GPU traffic bursts</div>
          </div>

          <div>
            <div className="flex justify-between text-[#A0A0A0] mb-1">
              <label>CONFIDENCE INTERVAL</label>
              <span className="text-neon">{params.confidenceInterval}%</span>
            </div>
            <input
              type="range"
              min="80"
              max="99"
              step="1"
              value={params.confidenceInterval}
              onChange={(e) => setParams({ ...params, confidenceInterval: parseInt(e.target.value) })}
              className="w-full accent-[#00FF41] bg-[#0A0A0A]"
            />
            <div className="text-[10px] text-[#777] mt-0.5">Defines upper/lower uncertainty envelope bands</div>
          </div>

          <div>
            <div className="flex justify-between text-[#A0A0A0] mb-1">
              <label>LEARNING RATE</label>
              <span className="text-neon">{params.learningRate}</span>
            </div>
            <input
              type="number"
              step="0.001"
              min="0.0001"
              max="0.1"
              value={params.learningRate}
              onChange={(e) => setParams({ ...params, learningRate: parseFloat(e.target.value) })}
              className="w-full bg-[#0A0A0A] border border-[#1A1A1A] text-[#e5e2e1] p-2 focus:border-neon focus:outline-none"
            />
          </div>

          <div>
            <div className="flex justify-between text-[#A0A0A0] mb-1">
              <label>ANOMALY THRESHOLD (Z-SCORE)</label>
              <span className="text-neon">{params.anomalyThreshold}σ</span>
            </div>
            <input
              type="number"
              step="0.1"
              min="1.0"
              max="5.0"
              value={params.anomalyThreshold}
              onChange={(e) => setParams({ ...params, anomalyThreshold: parseFloat(e.target.value) })}
              className="w-full bg-[#0A0A0A] border border-[#1A1A1A] text-[#e5e2e1] p-2 focus:border-neon focus:outline-none"
            />
          </div>

          <div className="pt-4 border-t border-[#1A1A1A] flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="border border-[#1A1A1A] text-[#A0A0A0] px-4 py-2 hover:bg-[#1A1A1A]"
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="bg-neon text-[#0A0A0A] px-5 py-2 font-bold hover:bg-[#3ce36a] transition-all flex items-center gap-2"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>APPLIED</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>APPLY & RETRAIN</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
