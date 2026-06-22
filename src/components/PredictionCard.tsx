import React from 'react';

interface PredictionCardProps {
  market: string;
  pick: string;
  probability: number;
}

export function PredictionCard({ market, pick, probability }: PredictionCardProps) {
  const probPercent = (probability * 100).toFixed(1);
  return (
    <div className="flex flex-col p-3 bg-slate-50 border border-slate-100 rounded-lg">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-semibold text-slate-500 uppercase">{market}</span>
        <span className="text-sm font-bold text-slate-900">{pick}</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2 mb-1 overflow-hidden">
        <div 
          className="bg-emerald-500 h-2 rounded-full" 
          style={{ width: `${probPercent}%` }}
        ></div>
      </div>
      <span className="text-xs text-right text-slate-500 font-medium">{probPercent}% Prob</span>
    </div>
  );
}
