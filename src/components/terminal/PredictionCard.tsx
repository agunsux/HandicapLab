import React from 'react';
import Link from 'next/link';
import { TerminalPrediction } from '@/lib/terminalData';
import { ShieldAlert, ArrowRight, Activity } from 'lucide-react';

interface PredictionCardProps {
  prediction: TerminalPrediction;
}

export function PredictionCard({ prediction }: PredictionCardProps) {
  const isSettled = prediction.settlement_status === 'SETTLED';
  const isVoid = prediction.settlement_status === 'VOID';
  const dateFormatted = new Date(prediction.kickoff_at).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });

  return (
    <div className="bg-[#111827]/80 border border-[#1F2937] hover:border-[#374151] transition-all rounded-xl p-5 flex flex-col justify-between relative">
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-xs font-mono text-[#9CA3AF] uppercase tracking-wider">
            {prediction.league_name} &bull; {dateFormatted} UTC
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <ShieldAlert className="h-3 w-3" />
            RESEARCH ONLY
          </span>
        </div>

        {/* Fixture Match Title */}
        <div className="mb-4">
          <Link
            href={`/predictions/${prediction.fixture_id}`}
            className="text-base font-bold text-white hover:text-[#10B981] transition-colors flex items-center gap-1.5"
          >
            <span>{prediction.home_team}</span>
            <span className="text-[#9CA3AF] text-xs font-normal">vs</span>
            <span>{prediction.away_team}</span>
          </Link>
          <div className="text-xs font-mono text-[#9CA3AF] mt-0.5">
            Target: <strong className="text-white capitalize">{prediction.side}</strong> ({prediction.line > 0 ? `+${prediction.line}` : prediction.line}) @ {prediction.taken_odds.toFixed(2)}
          </div>
        </div>

        {/* Probabilities & Model Edge Comparison */}
        <div className="grid grid-cols-2 gap-2 bg-[#0B0F0E] border border-[#1F2937] rounded-lg p-3 mb-4 text-xs font-mono">
          <div>
            <span className="text-[#9CA3AF] block text-[10px] uppercase">Model Fair Prob</span>
            <span className="text-sm font-bold text-white">{(prediction.fair_probability * 100).toFixed(1)}%</span>
            <span className="text-[10px] text-[#9CA3AF] block">Fair Odds: {prediction.fair_odds.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-[#9CA3AF] block text-[10px] uppercase">Devig Market Prob</span>
            <span className="text-sm font-bold text-[#9CA3AF]">{(prediction.devig_market_probability * 100).toFixed(1)}%</span>
            <span className="text-[10px] text-[#9CA3AF] block">Taken Odds: {prediction.taken_odds.toFixed(2)}</span>
          </div>
          <div className="pt-2 border-t border-[#1F2937]">
            <span className="text-[#9CA3AF] block text-[10px] uppercase">Statistical Edge</span>
            <span className={prediction.edge > 0 ? 'text-amber-300 font-bold' : 'text-neutral-400 font-bold'}>
              {(prediction.edge * 100).toFixed(2)}%
            </span>
          </div>
          <div className="pt-2 border-t border-[#1F2937]">
            <span className="text-[#9CA3AF] block text-[10px] uppercase">Expected Value (EV)</span>
            <span className={prediction.ev > 0 ? 'text-amber-300 font-bold' : 'text-neutral-400 font-bold'}>
              {prediction.ev > 0 ? `+${prediction.ev.toFixed(2)}%` : `${prediction.ev.toFixed(2)}%`}
            </span>
          </div>
        </div>
      </div>

      {/* Footer & Historical Context Line */}
      <div className="pt-3 border-t border-[#1F2937] space-y-2 text-xs">
        {/* Status / Outcome if settled */}
        {isSettled && (
          <div className="flex items-center justify-between text-xs font-mono py-1 px-2 bg-[#1F2937]/50 rounded">
            <span className="text-[#9CA3AF]">Outcome: <strong className="text-white">{prediction.actual_outcome}</strong></span>
            <span className={(prediction.profit_loss || 0) >= 0 ? 'text-[#10B981] font-bold' : 'text-red-400 font-bold'}>
              {(prediction.profit_loss || 0) >= 0 ? `+${(prediction.profit_loss || 0).toFixed(2)}u` : `${(prediction.profit_loss || 0).toFixed(2)}u`}
            </span>
          </div>
        )}

        {isVoid && (
          <div className="text-xs font-mono py-1 px-2 bg-neutral-800 rounded text-neutral-400">
            Outcome: VOID / REFUNDED
          </div>
        )}

        <div className="text-[11px] text-[#9CA3AF] leading-relaxed">
          <Activity className="inline-block h-3 w-3 mr-1 text-amber-400" />
          Model: <span className="font-mono text-neutral-300">{prediction.model_version}</span> (Backtest: ROI -2.30%, p=0.555)
        </div>

        <div className="flex justify-end pt-1">
          <Link
            href={`/predictions/${prediction.fixture_id}`}
            className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-mono"
          >
            View Model Breakdown <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
