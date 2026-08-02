import React from 'react';
import { MappedPrediction } from '@/lib/utils/predictionMapper';

interface AnalysisPanelProps {
  prediction: MappedPrediction;
}

export function AnalysisPanel({ prediction }: AnalysisPanelProps) {
  if (!prediction.hasPrediction) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
        <div className="text-4xl mb-3">📊</div>
        <h3 className="text-base font-bold text-white font-mono uppercase tracking-wider">
          Analysis Panel
        </h3>
        <p className="text-xs text-slate-500 font-mono mt-2 bg-slate-950/50 py-3 rounded-lg border border-slate-850 max-w-sm mx-auto">
          Prediction not available.
        </p>
      </div>
    );
  }

  const { moneyline, asianHandicap, overUnder, expectedGoals, market, model } = prediction;

  // Formatting utilities
  const formatProb = (val: number) => `${Math.round(val * 100)}%`;
  const formatOdds = (val: any) => {
    if (typeof val === 'number') return val.toFixed(2);
    if (typeof val === 'string') return val;
    return 'N/A';
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Moneyline Card */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 space-y-4 hover:border-slate-700/60 transition-all shadow-lg">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800/60">
            <h3 className="text-xs font-mono font-black text-slate-400 uppercase tracking-widest">
              Moneyline Probabilities
            </h3>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              ML Market
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-950/60 border border-slate-800/50 p-3 rounded-xl">
              <span className="text-[9px] font-mono text-slate-500 uppercase block mb-1">Home Win</span>
              <div className="text-xl font-bold font-mono text-white">{formatProb(moneyline.homeProb)}</div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/50 p-3 rounded-xl">
              <span className="text-[9px] font-mono text-slate-500 uppercase block mb-1">Draw</span>
              <div className="text-xl font-bold font-mono text-slate-400">{formatProb(moneyline.drawProb)}</div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/50 p-3 rounded-xl">
              <span className="text-[9px] font-mono text-slate-500 uppercase block mb-1">Away Win</span>
              <div className="text-xl font-bold font-mono text-white">{formatProb(moneyline.awayProb)}</div>
            </div>
          </div>
        </div>

        {/* Asian Handicap Card */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 space-y-4 hover:border-slate-700/60 transition-all shadow-lg">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800/60">
            <h3 className="text-xs font-mono font-black text-slate-400 uppercase tracking-widest">
              Asian Handicap Value
            </h3>
            <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
              AH Market
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-950/60 border border-slate-800/50 p-3 rounded-xl">
              <span className="text-[9px] font-mono text-slate-500 uppercase block mb-1">Rec. Line</span>
              <div className="text-xl font-bold font-mono text-white">
                {asianHandicap.recommendedLine > 0 ? `+${asianHandicap.recommendedLine}` : asianHandicap.recommendedLine}
              </div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/50 p-3 rounded-xl">
              <span className="text-[9px] font-mono text-slate-500 uppercase block mb-1">Cover Prob</span>
              <div className="text-xl font-bold font-mono text-slate-200">{formatProb(asianHandicap.probability)}</div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/50 p-3 rounded-xl">
              <span className="text-[9px] font-mono text-slate-500 uppercase block mb-1">Model Edge</span>
              <div className={`text-xl font-extrabold font-mono ${
                asianHandicap.edge > 5 ? 'text-emerald-400' : 'text-slate-400'
              }`}>
                +{asianHandicap.edge.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* Over/Under Card */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 space-y-4 hover:border-slate-700/60 transition-all shadow-lg">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800/60">
            <h3 className="text-xs font-mono font-black text-slate-400 uppercase tracking-widest">
              Over / Under Goals
            </h3>
            <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
              O/U Market
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-950/60 border border-slate-800/50 p-3 rounded-xl">
              <span className="text-[9px] font-mono text-slate-500 uppercase block mb-1">Line</span>
              <div className="text-xl font-bold font-mono text-white">{overUnder.line} Goals</div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/50 p-3 rounded-xl">
              <span className="text-[9px] font-mono text-slate-500 uppercase block mb-1">Over Prob</span>
              <div className="text-xl font-bold font-mono text-slate-200">{formatProb(overUnder.overProb)}</div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/50 p-3 rounded-xl">
              <span className="text-[9px] font-mono text-slate-500 uppercase block mb-1">Under Prob</span>
              <div className="text-xl font-bold font-mono text-slate-200">{formatProb(overUnder.underProb)}</div>
            </div>
          </div>
        </div>

        {/* Expected Goals Card */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 space-y-4 hover:border-slate-700/60 transition-all shadow-lg">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800/60">
            <h3 className="text-xs font-mono font-black text-slate-400 uppercase tracking-widest">
              Expected Goals (xG)
            </h3>
            <span className="text-[10px] font-mono text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded">
              Poisson Ingest
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-950/60 border border-slate-800/50 p-3 rounded-xl">
              <span className="text-[9px] font-mono text-slate-500 uppercase block mb-1">Home xG</span>
              <div className="text-xl font-bold font-mono text-white">
                {expectedGoals.homeXg !== null ? expectedGoals.homeXg.toFixed(2) : 'N/A'}
              </div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/50 p-3 rounded-xl">
              <span className="text-[9px] font-mono text-slate-500 uppercase block mb-1">Away xG</span>
              <div className="text-xl font-bold font-mono text-white">
                {expectedGoals.awayXg !== null ? expectedGoals.awayXg.toFixed(2) : 'N/A'}
              </div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/50 p-3 rounded-xl">
              <span className="text-[9px] font-mono text-slate-500 uppercase block mb-1">Total xG</span>
              <div className="text-xl font-bold font-mono text-emerald-400">
                {expectedGoals.totalXg !== null ? expectedGoals.totalXg.toFixed(2) : 'N/A'}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Market Odds & Model Metadata Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Market Odds Snapshot */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 space-y-3">
          <h4 className="text-xs font-mono font-black text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-850">
            Market Odds Snapshot
          </h4>
          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-slate-850/50">
              <span className="text-slate-500">Opening Odds (Entry)</span>
              <span className="text-slate-200 font-bold">{formatOdds(market.openingOdds)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-850/50">
              <span className="text-slate-500">Current Odds Snapshot</span>
              <span className="text-slate-200 font-bold">
                {market.currentOdds ? 'Available (snapshot payload)' : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Closing Odds</span>
              <span className="text-slate-200 font-bold">{formatOdds(market.closingOdds)}</span>
            </div>
          </div>
        </div>

        {/* Model Metadata */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 space-y-3">
          <h4 className="text-xs font-mono font-black text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-850">
            Quantitative Model Details
          </h4>
          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-slate-850/50">
              <span className="text-slate-500">Model Version</span>
              <span className="text-slate-200 font-bold">{model.modelVersion || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-850/50">
              <span className="text-slate-500">Model Confidence</span>
              <span className="text-slate-200 font-bold">{model.confidence || 'Low'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Prediction Generated At</span>
              <span className="text-slate-200 font-bold text-[10px]">
                {model.predictionTime ? new Date(model.predictionTime).toLocaleString() : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
