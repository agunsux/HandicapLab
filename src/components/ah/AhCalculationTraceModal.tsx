'use client';

import React from 'react';
import { X, ShieldAlert, CheckCircle2, AlertTriangle, HelpCircle, Calculator, TrendingUp, Info } from 'lucide-react';
import type { MatchCalculationTrace } from '@/lib/research/ah-yield/ahHistoryContracts';
import type { UpcomingAhFixtureView } from '@/lib/services/ahUpcomingService';

interface AhCalculationTraceModalProps {
  isOpen: boolean;
  onClose: () => void;
  historicalTrace?: MatchCalculationTrace | null;
  upcomingFixture?: UpcomingAhFixtureView | null;
}

export function AhCalculationTraceModal({
  isOpen,
  onClose,
  historicalTrace,
  upcomingFixture,
}: AhCalculationTraceModalProps) {
  if (!isOpen || (!historicalTrace && !upcomingFixture)) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0E1413] border border-[#1F2937] rounded-2xl p-6 sm:p-8 text-neutral-200 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-[#1F2937]">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#111827] border border-[#1F2937] text-xs font-mono text-[#10B981] mb-2">
              <Calculator className="h-3.5 w-3.5" />
              TRANSPARENT CALCULATION ENGINE
            </div>
            <h2 className="text-xl font-bold font-display text-white">
              {historicalTrace ? 'Historical Settlement Breakdown' : 'Salmo Decision & Value Calculation'}
            </h2>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              {historicalTrace
                ? `${historicalTrace.matchDate} &bull; ${historicalTrace.scoreDisplay}`
                : `${upcomingFixture?.homeTeam} vs ${upcomingFixture?.awayTeam} &bull; ${upcomingFixture?.kickoffDate}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* HISTORICAL MATCH TRACE */}
        {historicalTrace && (
          <div className="space-y-5 text-sm">
            {/* Core Bet Parameters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-[#111827] border border-[#1F2937]">
                <div className="text-xs text-neutral-400">Selected Side</div>
                <div className="text-base font-bold text-white capitalize">{historicalTrace.side}</div>
              </div>
              <div className="p-3 rounded-lg bg-[#111827] border border-[#1F2937]">
                <div className="text-xs text-neutral-400">Handicap Line</div>
                <div className="text-base font-bold text-[#10B981] font-mono">
                  {historicalTrace.selectionLine > 0 ? `+${historicalTrace.selectionLine}` : historicalTrace.selectionLine}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#111827] border border-[#1F2937]">
                <div className="text-xs text-neutral-400">Taken Odds</div>
                <div className="text-base font-bold text-white font-mono">{historicalTrace.odds.toFixed(3)}</div>
              </div>
              <div className="p-3 rounded-lg bg-[#111827] border border-[#1F2937]">
                <div className="text-xs text-neutral-400">Provenance</div>
                <div className="text-base font-bold text-white font-mono capitalize">{historicalTrace.provenance}</div>
              </div>
            </div>

            {/* Quarter Line Decomposition */}
            {historicalTrace.isQuarterLine && historicalTrace.componentLines && historicalTrace.componentOutcomes ? (
              <div className="p-4 rounded-xl bg-[#111827] border border-[#1F2937] space-y-3">
                <div className="text-xs font-bold text-[#10B981] uppercase tracking-wider font-mono">
                  Quarter-Ball Component Split (50% / 50%)
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Asian Handicap {historicalTrace.selectionLine > 0 ? `+${historicalTrace.selectionLine}` : historicalTrace.selectionLine} is a quarter-line bet.
                  The 1.00 unit stake is mathematically divided equally into two adjacent sub-bets:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-lg bg-[#0B0F0E] border border-neutral-800">
                    <div className="text-xs text-neutral-400">Component 1 (0.50 Stake)</div>
                    <div className="text-sm font-bold text-white font-mono mt-1">
                      Line: {historicalTrace.componentLines[0] > 0 ? `+${historicalTrace.componentLines[0]}` : historicalTrace.componentLines[0]}
                    </div>
                    <div className="text-xs font-mono text-[#10B981] mt-0.5">
                      Settlement: {historicalTrace.componentOutcomes[0]}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-[#0B0F0E] border border-neutral-800">
                    <div className="text-xs text-neutral-400">Component 2 (0.50 Stake)</div>
                    <div className="text-sm font-bold text-white font-mono mt-1">
                      Line: {historicalTrace.componentLines[1] > 0 ? `+${historicalTrace.componentLines[1]}` : historicalTrace.componentLines[1]}
                    </div>
                    <div className="text-xs font-mono text-[#10B981] mt-0.5">
                      Settlement: {historicalTrace.componentOutcomes[1]}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[#111827] border border-[#1F2937]">
                <div className="text-xs font-bold text-[#10B981] uppercase tracking-wider font-mono">
                  Single Handicap Settlement
                </div>
                <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                  Standard line evaluated directly against the final match score differential.
                </p>
              </div>
            )}

            {/* Final Math & Result */}
            <div className="p-4 rounded-xl bg-[#16221E] border border-[#10B981]/30 space-y-2 font-mono">
              <div className="text-xs text-neutral-400 uppercase tracking-wider">Exact Settlement Outcome &amp; P&amp;L</div>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-white">{historicalTrace.settlementOutcome}</span>
                <span className={`text-lg font-bold ${historicalTrace.pnl > 0 ? 'text-[#10B981]' : historicalTrace.pnl < 0 ? 'text-rose-400' : 'text-neutral-400'}`}>
                  {historicalTrace.pnl > 0 ? `+${historicalTrace.pnl.toFixed(2)}` : historicalTrace.pnl.toFixed(2)} Units
                </span>
              </div>
              <div className="text-xs text-neutral-300 pt-1 border-t border-neutral-800">
                Formula: {historicalTrace.calculationExplanation}
              </div>
            </div>
          </div>
        )}

        {/* UPCOMING MATCH VALUE EVALUATION */}
        {upcomingFixture && (
          <div className="space-y-5 text-sm">
            {/* Status & Decision Banner */}
            <div className={`p-4 rounded-xl border ${upcomingFixture.decisionHome.badgeColorClass} space-y-1`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold font-mono">
                  <span className="w-2.5 h-2.5 rounded-full bg-current" />
                  {upcomingFixture.decisionHome.statusLabel}
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-black/40 border border-current/20">
                  Confidence: {upcomingFixture.decisionHome.confidence}
                </span>
              </div>
              <p className="text-xs opacity-90 leading-relaxed mt-1">
                {upcomingFixture.decisionHome.reason}
              </p>
            </div>

            {/* Price vs Probability Comparison */}
            <div className="p-4 rounded-xl bg-[#111827] border border-[#1F2937] space-y-3">
              <div className="text-xs font-bold text-[#10B981] uppercase tracking-wider font-mono">
                Market Price vs Probability Balance
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-2.5 rounded-lg bg-[#0B0F0E] border border-neutral-800">
                  <div className="text-[11px] text-neutral-400">Market Odds</div>
                  <div className="text-base font-bold text-white font-mono mt-0.5">
                    {upcomingFixture.homeOdds ? upcomingFixture.homeOdds.toFixed(2) : 'N/A'}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#0B0F0E] border border-neutral-800">
                  <div className="text-[11px] text-neutral-400">Fair Odds (0% EV)</div>
                  <div className="text-base font-bold text-[#10B981] font-mono mt-0.5">
                    {upcomingFixture.homeFairOdds ? upcomingFixture.homeFairOdds.toFixed(2) : 'N/A'}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#0B0F0E] border border-neutral-800">
                  <div className="text-[11px] text-neutral-400">Model Probability</div>
                  <div className="text-base font-bold text-white font-mono mt-0.5">
                    {upcomingFixture.modelProbHome !== null ? `${upcomingFixture.modelProbHome}%` : 'N/A'}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#0B0F0E] border border-neutral-800">
                  <div className="text-[11px] text-neutral-400">Expected Value</div>
                  <div className={`text-base font-bold font-mono mt-0.5 ${upcomingFixture.homeEvPct && upcomingFixture.homeEvPct > 0 ? 'text-[#10B981]' : upcomingFixture.homeEvPct && upcomingFixture.homeEvPct < 0 ? 'text-rose-400' : 'text-neutral-400'}`}>
                    {upcomingFixture.homeEvPct !== null ? `${upcomingFixture.homeEvPct > 0 ? '+' : ''}${upcomingFixture.homeEvPct}%` : 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* Evidence & Assessment */}
            <div className="p-4 rounded-xl bg-[#111827] border border-[#1F2937] space-y-3">
              <div className="text-xs font-bold text-neutral-300 uppercase tracking-wider font-mono">
                Mathematical Evidence &amp; Input Breakdown
              </div>
              <div className="space-y-2 text-xs font-mono text-neutral-300">
                <div className="flex justify-between py-1 border-b border-neutral-800">
                  <span className="text-neutral-400">Home Team Form:</span>
                  <span>{upcomingFixture.evidence.recentFormHome}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800">
                  <span className="text-neutral-400">Away Team Form:</span>
                  <span>{upcomingFixture.evidence.recentFormAway}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800">
                  <span className="text-neutral-400">Venue Adjustment:</span>
                  <span>{upcomingFixture.evidence.homeAdvantageAdjustment}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800">
                  <span className="text-neutral-400">Data Source:</span>
                  <span>{upcomingFixture.evidence.dataSource}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-neutral-400">Timestamp Freshness:</span>
                  <span>{upcomingFixture.evidence.dataFreshness}</span>
                </div>
              </div>
            </div>

            {/* Research Firewall Disclaimer */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs leading-relaxed space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Salmo Production Safety &amp; Integrity Notice
              </div>
              <p>
                HandicapLab does not sell or distribute &quot;guaranteed picks&quot; or &quot;locks&quot;.
                Because current Asian Handicap models have not proven a statistically significant out-of-sample edge over Pinnacle closing lines (Verdict C: NO DEMONSTRATED INFORMATION ADVANTAGE), all candidate signals remain strictly firewalled.
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-[#111827] hover:bg-neutral-800 text-sm font-mono text-white border border-[#1F2937] transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
