'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PremierLeagueAhResearchPayload } from '@/lib/research/premierLeagueAhEngine';
import { 
  ShieldCheck, 
  AlertTriangle, 
  BarChart3, 
  Database, 
  Clock, 
  ArrowRight, 
  Target, 
  HelpCircle,
  Percent,
  CheckCircle2,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PremierLeagueAhResearchViewProps {
  data: PremierLeagueAhResearchPayload;
}

export function PremierLeagueAhResearchView({ data }: PremierLeagueAhResearchViewProps) {
  const [selectedSeason, setSelectedSeason] = useState<'combined' | '2024-2025' | '2025-2026'>('combined');
  const [activeTab, setActiveTab] = useState<'overview' | 'thresholds' | 'lineMatrix' | 'coverage' | 'methodology'>('overview');

  const { manifest, coverage, homeAhZero, lineMatrix, providerAudit } = data;
  const currentSummary = homeAhZero.bySeason[selectedSeason];

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl pt-24 pb-20 flex-1 space-y-10">
      {/* 1. Header & Status */}
      <div className="border-b border-[#1F2937] pb-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 text-xs font-mono text-[#10B981]">
            <span className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
            REAL DATA ONLY &bull; ZERO FABRICATED MATCHES
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-[#9CA3AF]">Status:</span>
            <span className="px-2.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold uppercase">
              {manifest.verdict}
            </span>
          </div>
        </div>

        <h1 className="text-3xl sm:text-4xl font-display font-black text-white tracking-tight">
          Premier League Asian Handicap Research
        </h1>
        <p className="text-sm text-[#9CA3AF] max-w-3xl leading-relaxed">
          Quantitative forensic study on the historical performance of <span className="text-white font-bold">Home Asian Handicap +0 (Draw No Bet)</span> and line-level deviations across the 2024/25 and 2025/26 seasons. Benchmarked strictly against Pinnacle opening and closing prices.
        </p>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 pt-4 border-t border-[#1F2937]/60 overflow-x-auto">
          {[
            { id: 'overview', label: 'Primary Backtest' },
            { id: 'thresholds', label: 'EV Threshold Sweep' },
            { id: 'lineMatrix', label: 'AH Line Matrix' },
            { id: 'coverage', label: 'Data Lineage & Coverage' },
            { id: 'methodology', label: 'Methodology & Formulas' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'px-4 py-2 rounded-lg text-xs font-mono transition-all whitespace-nowrap',
                activeTab === tab.id
                  ? 'bg-[#10B981] text-black font-bold shadow-sm'
                  : 'bg-[#111827] text-[#9CA3AF] border border-[#1F2937] hover:text-white'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Executive Question & Verdict Box */}
      <div className="rounded-2xl border border-[#1F2937] bg-[#111827]/70 p-6 sm:p-8 space-y-4 font-mono">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#9CA3AF]">
          <HelpCircle className="h-4 w-4 text-[#10B981]" />
          Primary Research Invariant
        </div>
        <div className="text-sm sm:text-base text-white font-bold leading-relaxed border-l-2 border-[#10B981] pl-4">
          &ldquo;{manifest.primaryQuestion}&rdquo;
        </div>
        <div className="p-4 rounded-xl bg-[#0B0F0E] border border-[#1F2937] text-xs text-[#9CA3AF] space-y-2">
          <div className="text-white font-bold text-sm flex items-center gap-2">
            <span className="text-amber-400">Statistical Answer:</span>
          </div>
          <p className="leading-relaxed text-neutral-300">
            {manifest.answerSentence}
          </p>
          <p className="text-[11px] text-[#9CA3AF] pt-1 border-t border-[#1F2937]/50">
            <span className="text-white font-bold">Conclusion:</span> {manifest.verdictExplanation}
          </p>
        </div>
      </div>

      {/* TAB 1: PRIMARY OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Season Selector */}
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase tracking-widest text-[#9CA3AF]">
              Home AH +0 Performance Summary
            </h2>

            <div className="flex items-center gap-1 bg-[#111827] p-1 rounded-lg border border-[#1F2937] font-mono text-xs">
              <button
                onClick={() => setSelectedSeason('combined')}
                className={cn(
                  'px-3 py-1 rounded transition-all',
                  selectedSeason === 'combined'
                    ? 'bg-[#1F2937] text-white font-bold'
                    : 'text-[#9CA3AF] hover:text-white'
                )}
              >
                Combined (2 Seasons)
              </button>
              <button
                onClick={() => setSelectedSeason('2024-2025')}
                className={cn(
                  'px-3 py-1 rounded transition-all',
                  selectedSeason === '2024-2025'
                    ? 'bg-[#1F2937] text-white font-bold'
                    : 'text-[#9CA3AF] hover:text-white'
                )}
              >
                2024/25
              </button>
              <button
                onClick={() => setSelectedSeason('2025-2026')}
                className={cn(
                  'px-3 py-1 rounded transition-all',
                  selectedSeason === '2025-2026'
                    ? 'bg-[#1F2937] text-white font-bold'
                    : 'text-[#9CA3AF] hover:text-white'
                )}
              >
                2025/26
              </button>
            </div>
          </div>

          {/* Hero Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 font-mono">
            <div className="p-4 rounded-xl bg-[#111827]/70 border border-[#1F2937]">
              <span className="text-[10px] text-[#9CA3AF] uppercase">Qualifying Bets</span>
              <div className="text-2xl font-bold text-white mt-1">{currentSummary.bets}</div>
              <span className="text-[10px] text-[#6B7280]">Home AH 0 matches</span>
            </div>

            <div className="p-4 rounded-xl bg-[#111827]/70 border border-[#1F2937]">
              <span className="text-[10px] text-[#9CA3AF] uppercase">Record (W-P-L)</span>
              <div className="text-lg font-bold text-white mt-1">
                <span className="text-[#10B981]">{currentSummary.wins}W</span>-
                <span className="text-amber-300">{currentSummary.pushes}P</span>-
                <span className="text-red-400">{currentSummary.losses}L</span>
              </div>
              <span className="text-[10px] text-[#6B7280]">Push on Draw</span>
            </div>

            <div className="p-4 rounded-xl bg-[#111827]/70 border border-[#1F2937]">
              <span className="text-[10px] text-[#9CA3AF] uppercase">Win Rate</span>
              <div className="text-2xl font-bold text-white mt-1">{currentSummary.winRate}%</div>
              <span className="text-[10px] text-[#6B7280]">Pushes excluded</span>
            </div>

            <div className="p-4 rounded-xl bg-[#111827]/70 border border-[#1F2937]">
              <span className="text-[10px] text-[#9CA3AF] uppercase">Net Profit (1u Flat)</span>
              <div
                className={cn(
                  'text-2xl font-bold mt-1',
                  currentSummary.profit >= 0 ? 'text-[#10B981]' : 'text-red-400'
                )}
              >
                {currentSummary.profit >= 0 ? `+${currentSummary.profit.toFixed(2)}u` : `${currentSummary.profit.toFixed(2)}u`}
              </div>
              <span className="text-[10px] text-[#6B7280]">Cumulative units</span>
            </div>

            <div className="p-4 rounded-xl bg-[#111827]/70 border border-[#1F2937]">
              <span className="text-[10px] text-[#9CA3AF] uppercase">ROI / Yield</span>
              <div
                className={cn(
                  'text-2xl font-bold mt-1',
                  currentSummary.roi >= 0 ? 'text-[#10B981]' : 'text-red-400'
                )}
              >
                {currentSummary.roi >= 0 ? `+${currentSummary.roi}%` : `${currentSummary.roi}%`}
              </div>
              <span className="text-[10px] text-[#6B7280]">Total profit / total stake</span>
            </div>

            <div className="p-4 rounded-xl bg-[#111827]/70 border border-[#1F2937]">
              <span className="text-[10px] text-[#9CA3AF] uppercase">Mean CLV</span>
              <div
                className={cn(
                  'text-2xl font-bold mt-1',
                  currentSummary.avgClv >= 0 ? 'text-[#10B981]' : 'text-red-400'
                )}
              >
                {currentSummary.avgClv >= 0 ? `+${currentSummary.avgClv}%` : `${currentSummary.avgClv}%`}
              </div>
              <span className="text-[10px] text-[#6B7280]">vs Pinnacle Closing</span>
            </div>
          </div>

          {/* Season Breakdown Comparative Table */}
          <div className="rounded-xl border border-[#1F2937] bg-[#111827]/60 overflow-hidden font-mono text-xs">
            <div className="p-4 bg-[#0B0F0E]/80 border-b border-[#1F2937] flex items-center justify-between">
              <span className="font-bold text-white uppercase tracking-wider">
                Season-By-Season Isolation (Home AH +0)
              </span>
              <span className="text-[#9CA3AF] text-[11px]">Flat 1u Staking &bull; Pinnacle Odds</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#1F2937] text-[#9CA3AF] bg-[#0B0F0E]/40">
                    <th className="py-3 px-4">Season</th>
                    <th className="py-3 px-4">Sample (N)</th>
                    <th className="py-3 px-4">Record (W-P-L)</th>
                    <th className="py-3 px-4">Win Rate</th>
                    <th className="py-3 px-4">Push Rate</th>
                    <th className="py-3 px-4">Net Profit</th>
                    <th className="py-3 px-4">ROI / Yield</th>
                    <th className="py-3 px-4">Mean CLV</th>
                    <th className="py-3 px-4">95% CI</th>
                    <th className="py-3 px-4">Sample Tier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F2937]">
                  {Object.entries(homeAhZero.bySeason).map(([key, item]) => (
                    <tr
                      key={key}
                      className={cn(
                        'hover:bg-[#111827] transition-colors',
                        key === 'combined' ? 'bg-[#10B981]/5 font-bold' : ''
                      )}
                    >
                      <td className="py-3.5 px-4 text-white capitalize">{item.season}</td>
                      <td className="py-3.5 px-4 text-neutral-300">{item.bets}</td>
                      <td className="py-3.5 px-4 text-neutral-300">
                        {item.wins} - {item.pushes} - {item.losses}
                      </td>
                      <td className="py-3.5 px-4 text-white font-bold">{item.winRate}%</td>
                      <td className="py-3.5 px-4 text-[#9CA3AF]">{item.pushRate}%</td>
                      <td
                        className={cn(
                          'py-3.5 px-4 font-bold',
                          item.profit >= 0 ? 'text-[#10B981]' : 'text-red-400'
                        )}
                      >
                        {item.profit >= 0 ? `+${item.profit.toFixed(2)}u` : `${item.profit.toFixed(2)}u`}
                      </td>
                      <td
                        className={cn(
                          'py-3.5 px-4 font-bold',
                          item.roi >= 0 ? 'text-[#10B981]' : 'text-red-400'
                        )}
                      >
                        {item.roi >= 0 ? `+${item.roi}%` : `${item.roi}%`}
                      </td>
                      <td
                        className={cn(
                          'py-3.5 px-4 font-bold',
                          item.avgClv >= 0 ? 'text-[#10B981]' : 'text-red-400'
                        )}
                      >
                        {item.avgClv >= 0 ? `+${item.avgClv}%` : `${item.avgClv}%`}
                      </td>
                      <td className="py-3.5 px-4 text-[#9CA3AF] text-[11px]">
                        [{item.confidenceInterval95.lower}%, {item.confidenceInterval95.upper}%]
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 text-[10px]">
                          {item.sampleTier}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EV THRESHOLD SWEEP */}
      {activeTab === 'thresholds' && (
        <div className="space-y-6 font-mono text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-xs uppercase tracking-widest text-[#9CA3AF]">
                EV Threshold Sweep &bull; Home AH +0
              </h2>
              <p className="text-[11px] text-[#6B7280] mt-0.5">
                Conditioning bets on minimum Model Expected Value (EV). Staking: 1u flat.
              </p>
            </div>
            {homeAhZero.bestThreshold && (
              <div className="px-3 py-1.5 rounded-lg bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-xs font-bold flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" /> Best Hurdle: {homeAhZero.bestThreshold.thresholdLabel} (+{homeAhZero.bestThreshold.roi}% ROI, N={homeAhZero.bestThreshold.bets})
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[#1F2937] bg-[#111827]/70 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#1F2937] text-[#9CA3AF] bg-[#0B0F0E]/50">
                    <th className="py-3 px-4">EV Hurdle</th>
                    <th className="py-3 px-4">Qualifying Bets</th>
                    <th className="py-3 px-4">Record (W-P-L)</th>
                    <th className="py-3 px-4">Win Rate</th>
                    <th className="py-3 px-4">Push Rate</th>
                    <th className="py-3 px-4">Net Profit</th>
                    <th className="py-3 px-4">ROI</th>
                    <th className="py-3 px-4">Mean CLV</th>
                    <th className="py-3 px-4">Avg Model EV</th>
                    <th className="py-3 px-4">Sample Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F2937]">
                  {homeAhZero.evThresholdSweep.map((row) => (
                    <tr
                      key={row.thresholdLabel}
                      className={cn(
                        'hover:bg-[#111827] transition-colors',
                        row.threshold === homeAhZero.bestThreshold?.threshold ? 'bg-[#10B981]/10 font-bold' : ''
                      )}
                    >
                      <td className="py-3 px-4 text-white font-bold">{row.thresholdLabel}</td>
                      <td className="py-3 px-4 text-neutral-300">{row.bets}</td>
                      <td className="py-3 px-4 text-neutral-300">
                        {row.wins} - {row.pushes} - {row.losses}
                      </td>
                      <td className="py-3 px-4 text-white">{row.bets > 0 ? `${row.winRate}%` : '—'}</td>
                      <td className="py-3 px-4 text-[#9CA3AF]">{row.bets > 0 ? `${row.pushRate}%` : '—'}</td>
                      <td
                        className={cn(
                          'py-3 px-4 font-bold',
                          row.profit >= 0 ? 'text-[#10B981]' : 'text-red-400'
                        )}
                      >
                        {row.bets > 0 ? (row.profit >= 0 ? `+${row.profit.toFixed(2)}u` : `${row.profit.toFixed(2)}u`) : '—'}
                      </td>
                      <td
                        className={cn(
                          'py-3 px-4 font-bold',
                          row.roi >= 0 ? 'text-[#10B981]' : 'text-red-400'
                        )}
                      >
                        {row.bets > 0 ? (row.roi >= 0 ? `+${row.roi}%` : `${row.roi}%`) : '—'}
                      </td>
                      <td
                        className={cn(
                          'py-3 px-4',
                          row.avgClv >= 0 ? 'text-[#10B981]' : 'text-red-400'
                        )}
                      >
                        {row.bets > 0 ? (row.avgClv >= 0 ? `+${row.avgClv}%` : `${row.avgClv}%`) : '—'}
                      </td>
                      <td className="py-3 px-4 text-neutral-300">
                        {row.bets > 0 ? `+${row.avgEv}%` : '—'}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-[#9CA3AF]">
                        {row.sampleStatus}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AH LINE MATRIX */}
      {activeTab === 'lineMatrix' && (
        <div className="space-y-6 font-mono text-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs uppercase tracking-widest text-[#9CA3AF]">
                Complete Asian Handicap Line Matrix (-1.5 to +1.5)
              </h2>
              <p className="text-[11px] text-[#6B7280] mt-0.5">
                Comparing Home vs Away performance across all observed Premier League lines (760 fixtures).
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[#1F2937] bg-[#111827]/70 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#1F2937] text-[#9CA3AF] bg-[#0B0F0E]/50">
                    <th className="py-3 px-4">Line</th>
                    <th className="py-3 px-4">Matches (N)</th>
                    <th className="py-3 px-4">Home Win %</th>
                    <th className="py-3 px-4">Home Profit</th>
                    <th className="py-3 px-4">Home ROI</th>
                    <th className="py-3 px-4">Away Win %</th>
                    <th className="py-3 px-4">Away Profit</th>
                    <th className="py-3 px-4">Away ROI</th>
                    <th className="py-3 px-4">Mean CLV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F2937]">
                  {lineMatrix.lines.map((l) => (
                    <tr key={l.line} className="hover:bg-[#111827] transition-colors">
                      <td className="py-3 px-4 font-bold text-white">{l.lineLabel}</td>
                      <td className="py-3 px-4 text-neutral-300">{l.bets}</td>
                      <td className="py-3 px-4 text-neutral-300">{l.homeWinRate}%</td>
                      <td
                        className={cn(
                          'py-3 px-4 font-bold',
                          l.homeProfit >= 0 ? 'text-[#10B981]' : 'text-red-400'
                        )}
                      >
                        {l.homeProfit >= 0 ? `+${l.homeProfit.toFixed(2)}u` : `${l.homeProfit.toFixed(2)}u`}
                      </td>
                      <td
                        className={cn(
                          'py-3 px-4 font-bold',
                          l.homeRoi >= 0 ? 'text-[#10B981]' : 'text-red-400'
                        )}
                      >
                        {l.homeRoi >= 0 ? `+${l.homeRoi}%` : `${l.homeRoi}%`}
                      </td>
                      <td className="py-3 px-4 text-neutral-300">{l.awayWinRate}%</td>
                      <td
                        className={cn(
                          'py-3 px-4 font-bold',
                          l.awayProfit >= 0 ? 'text-[#10B981]' : 'text-red-400'
                        )}
                      >
                        {l.awayProfit >= 0 ? `+${l.awayProfit.toFixed(2)}u` : `${l.awayProfit.toFixed(2)}u`}
                      </td>
                      <td
                        className={cn(
                          'py-3 px-4 font-bold',
                          l.awayRoi >= 0 ? 'text-[#10B981]' : 'text-red-400'
                        )}
                      >
                        {l.awayRoi >= 0 ? `+${l.awayRoi}%` : `${l.awayRoi}%`}
                      </td>
                      <td className="py-3 px-4 text-[#9CA3AF]">{l.avgClv}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DATA COVERAGE & LINEAGE */}
      {activeTab === 'coverage' && (
        <div className="space-y-6 font-mono text-xs">
          <h2 className="text-xs uppercase tracking-widest text-[#9CA3AF]">
            Data Lineage &amp; Coverage Audit
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl bg-[#111827]/70 border border-[#1F2937] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">2024/25 Season</span>
                <span className="px-2 py-0.5 rounded bg-[#10B981]/15 text-[#10B981] font-bold text-[10px]">
                  100% AUDITED
                </span>
              </div>
              <div className="space-y-1.5 text-neutral-300 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#9CA3AF]">Fixtures:</span>
                  <span>{coverage.season2024_2025.discoveredFixtures}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9CA3AF]">Final Results:</span>
                  <span>{coverage.season2024_2025.finalResults}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9CA3AF]">Pinnacle AH Odds:</span>
                  <span>{coverage.season2024_2025.ahOddsAvailable}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9CA3AF]">Pre-match Predictions:</span>
                  <span>{coverage.season2024_2025.prematchPredictions}</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-[#1F2937]">
                  <span className="text-white">Fully Joinable:</span>
                  <span className="text-[#10B981]">{coverage.season2024_2025.fullyJoinable} (100%)</span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-[#111827]/70 border border-[#1F2937] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">2025/26 Season</span>
                <span className="px-2 py-0.5 rounded bg-[#10B981]/15 text-[#10B981] font-bold text-[10px]">
                  99.7% AUDITED
                </span>
              </div>
              <div className="space-y-1.5 text-neutral-300 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#9CA3AF]">Fixtures:</span>
                  <span>{coverage.season2025_2026.discoveredFixtures}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9CA3AF]">Final Results:</span>
                  <span>{coverage.season2025_2026.finalResults}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9CA3AF]">Pinnacle AH Odds:</span>
                  <span>{coverage.season2025_2026.ahOddsAvailable}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9CA3AF]">Pre-match Predictions:</span>
                  <span>{coverage.season2025_2026.prematchPredictions}</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-[#1F2937]">
                  <span className="text-white">Fully Joinable:</span>
                  <span className="text-[#10B981]">{coverage.season2025_2026.fullyJoinable} (99.7%)</span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-[#111827]/70 border border-[#1F2937] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">Combined Dataset</span>
                <span className="px-2 py-0.5 rounded bg-[#10B981]/15 text-[#10B981] font-bold text-[10px]">
                  759 / 760 (99.9%)
                </span>
              </div>
              <div className="space-y-1.5 text-neutral-300 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#9CA3AF]">Total Matches:</span>
                  <span>{coverage.combined.discoveredFixtures}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9CA3AF]">Full Time Outcomes:</span>
                  <span>{coverage.combined.finalResults}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9CA3AF]">Pinnacle AH Pairs:</span>
                  <span>{coverage.combined.ahOddsAvailable}</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-[#1F2937]">
                  <span className="text-white">Out-of-Sample Cohort:</span>
                  <span className="text-[#10B981]">Complete 2 Seasons</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-[#0B0F0E] border border-[#1F2937] space-y-3">
            <span className="font-bold text-white text-xs uppercase tracking-wider block">
              Provider Limitations &amp; Verification Manifest
            </span>
            <div className="space-y-2 text-[11px] text-[#9CA3AF]">
              <p>
                &bull; <span className="text-white font-bold">API-Football Pro:</span> {providerAudit.apiFootball.retentionNote}
              </p>
              <p>
                &bull; <span className="text-white font-bold">OddsPapi:</span> {providerAudit.oddsPapi.coverageNote}
              </p>
              <p>
                &bull; <span className="text-white font-bold">Ground Truth Layer:</span> Sourced from {providerAudit.goldDataset.source} ({providerAudit.goldDataset.fileReference}).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: METHODOLOGY */}
      {activeTab === 'methodology' && (
        <div className="space-y-6 font-mono text-xs">
          <h2 className="text-xs uppercase tracking-widest text-[#9CA3AF]">
            Mathematical &amp; Statistical Formulas
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-xl bg-[#111827]/70 border border-[#1F2937] space-y-3">
              <span className="font-bold text-white text-sm block">1. Fair Odds for AH +0 (Draw No Bet)</span>
              <p className="text-[#9CA3AF] text-[11px] leading-relaxed">
                Because AH +0 returns the full stake on a draw (push), the fair decimal price removes the draw probability from the loss denominator:
              </p>
              <div className="p-3 bg-[#0B0F0E] rounded-lg border border-[#1F2937] text-[#10B981] font-bold">
                O_fair = (1 - P(Draw)) / P(Home Win)
              </div>
            </div>

            <div className="p-5 rounded-xl bg-[#111827]/70 border border-[#1F2937] space-y-3">
              <span className="font-bold text-white text-sm block">2. Expected Value (EV)</span>
              <p className="text-[#9CA3AF] text-[11px] leading-relaxed">
                Calculated per 1-unit flat stake using point-in-time bivariate Poisson / Dixon-Coles goal probabilities:
              </p>
              <div className="p-3 bg-[#0B0F0E] rounded-lg border border-[#1F2937] text-[#10B981] font-bold">
                EV = P(Home Win) * (Odds - 1) - P(Away Win)
              </div>
            </div>

            <div className="p-5 rounded-xl bg-[#111827]/70 border border-[#1F2937] space-y-3">
              <span className="font-bold text-white text-sm block">3. Closing Line Value (CLV)</span>
              <p className="text-[#9CA3AF] text-[11px] leading-relaxed">
                Closing line efficiency benchmarked against Pinnacle closing decimal odds:
              </p>
              <div className="p-3 bg-[#0B0F0E] rounded-lg border border-[#1F2937] text-[#10B981] font-bold">
                CLV = (Odds_taken / Odds_closing) - 1
              </div>
            </div>

            <div className="p-5 rounded-xl bg-[#111827]/70 border border-[#1F2937] space-y-3">
              <span className="font-bold text-white text-sm block">4. Flat Staking Settlement</span>
              <div className="p-3 bg-[#0B0F0E] rounded-lg border border-[#1F2937] text-neutral-300 space-y-1 text-[11px]">
                <div>&bull; Home Win: <span className="text-[#10B981] font-bold">+ (Odds - 1) units</span></div>
                <div>&bull; Draw (Push): <span className="text-amber-300 font-bold">0.00 units (Stake returned)</span></div>
                <div>&bull; Away Win: <span className="text-red-400 font-bold">- 1.00 unit</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
