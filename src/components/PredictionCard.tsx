import React from 'react';

interface PredictionCardProps {
  market: string;
  pick: string;
  probability: number;
}

export function PredictionCard({ market, pick, probability }: PredictionCardProps) {
  const probPercent = (probability * 100).toFixed(1);
  
  // Dynamic gradient colors based on probability
  let barGradient = 'from-slate-400 to-slate-500';
  let textHighlight = 'text-slate-700';
  if (probability >= 0.70) {
    barGradient = 'from-emerald-400 to-teal-500';
    textHighlight = 'text-emerald-600';
  } else if (probability >= 0.50) {
    barGradient = 'from-amber-400 to-orange-500';
    textHighlight = 'text-amber-600';
  }

  return (
    <div className="flex flex-col p-4 bg-white/70 backdrop-blur-md border border-slate-100/80 rounded-xl shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_16px_-4px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300">
      <div className="flex justify-between items-center mb-3">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{market}</span>
        <span className={`text-sm font-extrabold ${textHighlight} bg-slate-50 px-2 py-0.5 rounded`}>{pick}</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2 mb-2 overflow-hidden border border-slate-200/50">
        <div 
          className={`bg-gradient-to-r ${barGradient} h-2 rounded-full transition-all duration-500 ease-out`} 
          style={{ width: `${probPercent}%` }}
        ></div>
      </div>
      <div className="flex justify-between items-center text-[11px] font-semibold text-slate-500">
        <span className="font-medium">Calculated EV</span>
        <span>{probPercent}% Prob</span>
      </div>
    </div>
  );
}
