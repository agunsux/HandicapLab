export interface HistoricalValidationProps {
  sampleSize: number;
  winRate: number;
  avgOdds: number;
  historicalRoi: number;
}

export function HistoricalValidation({ sampleSize, winRate, avgOdds, historicalRoi }: HistoricalValidationProps) {
  return (
    <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-4 mt-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-widest">Historical Validation</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <div>
          <div className="text-lg font-bold text-white font-mono">{sampleSize.toLocaleString()}</div>
          <div className="text-[10px] font-mono text-slate-500 uppercase">Sample</div>
        </div>
        <div>
          <div className="text-lg font-bold text-emerald-400 font-mono">{winRate.toFixed(1)}%</div>
          <div className="text-[10px] font-mono text-slate-500 uppercase">Win Rate</div>
        </div>
        <div>
          <div className="text-lg font-bold text-white font-mono">{avgOdds.toFixed(2)}</div>
          <div className="text-[10px] font-mono text-slate-500 uppercase">Avg Odds</div>
        </div>
        <div>
          <div className="text-lg font-bold text-emerald-400 font-mono">{historicalRoi >= 0 ? '+' : ''}{historicalRoi.toFixed(1)}%</div>
          <div className="text-[10px] font-mono text-slate-500 uppercase">Historical ROI</div>
        </div>
      </div>
    </div>
  );
}