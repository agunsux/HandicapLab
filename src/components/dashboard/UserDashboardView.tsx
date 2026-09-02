'use client';

import React from 'react';
import Link from 'next/link';
import { UserDashboardPerformance } from '@/lib/dashboardPerformance';
import { Target, TrendingUp, CheckCircle2, BarChart3, ArrowRight, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserDashboardViewProps {
  perf: UserDashboardPerformance;
}

export function UserDashboardView({ perf }: UserDashboardViewProps) {
  const { hasData, totalBets, won, lost, winRate, yieldRoi, byMarket, recentSettled } = perf;

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl pt-24 pb-16 flex-1 space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1F2937] pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#111827] border border-[#1F2937] text-xs font-mono text-[#10B981] mb-2">
            <BarChart3 className="h-3.5 w-3.5" />
            PERFORMANCE AUDIT &bull; REAL SETTLEMENTS
          </div>
          <h1 className="text-3xl font-display font-bold text-white tracking-tight">
            Personal Performance
          </h1>
          <p className="text-sm text-[#9CA3AF] mt-1">
            Audited results across Asian Handicap, Over/Under, and BTTS. No fabricated statistics.
          </p>
        </div>

        <Link
          href="/track-record"
          className="self-start sm:self-auto px-4 py-2 rounded-lg bg-[#111827] border border-[#1F2937] hover:border-[#10B981] text-xs font-mono text-white transition-colors flex items-center gap-2"
        >
          View Public Track Record <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div>
        <h2 className="text-xs font-mono uppercase tracking-widest text-[#9CA3AF] mb-4">
          Overview &bull; How Am I Doing?
        </h2>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 font-mono">
          <div className="p-4 rounded-xl bg-[#111827]/70 border border-[#1F2937]">
            <span className="text-[11px] text-[#9CA3AF] uppercase">Total Bets</span>
            <div className="text-2xl font-bold text-white mt-1">{totalBets}</div>
            <span className="text-[10px] text-[#6B7280]">Settled signals</span>
          </div>

          <div className="p-4 rounded-xl bg-[#111827]/70 border border-[#1F2937]">
            <span className="text-[11px] text-[#9CA3AF] uppercase">Won</span>
            <div className="text-2xl font-bold text-[#10B981] mt-1">{won}</div>
            <span className="text-[10px] text-[#6B7280]">Profitable bets</span>
          </div>

          <div className="p-4 rounded-xl bg-[#111827]/70 border border-[#1F2937]">
            <span className="text-[11px] text-[#9CA3AF] uppercase">Lost</span>
            <div className="text-2xl font-bold text-red-400 mt-1">{lost}</div>
            <span className="text-[10px] text-[#6B7280]">Settled losses</span>
          </div>

          <div className="p-4 rounded-xl bg-[#111827]/70 border border-[#1F2937]">
            <span className="text-[11px] text-[#9CA3AF] uppercase">Win Rate</span>
            <div className="text-2xl font-bold text-white mt-1">
              {hasData ? `${winRate.toFixed(1)}%` : '—'}
            </div>
            <span className="text-[10px] text-[#6B7280]">Won / Decided</span>
          </div>

          <div className="p-4 rounded-xl bg-[#111827]/70 border border-[#1F2937] col-span-2 lg:col-span-1">
            <span className="text-[11px] text-[#9CA3AF] uppercase">Yield / ROI</span>
            <div
              className={cn(
                'text-2xl font-bold mt-1',
                yieldRoi >= 0 ? 'text-[#10B981]' : 'text-red-400'
              )}
            >
              {hasData ? `${yieldRoi >= 0 ? '+' : ''}${yieldRoi.toFixed(2)}%` : '—'}
            </div>
            <span className="text-[10px] text-[#6B7280]">Flat 1u staking</span>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xs font-mono uppercase tracking-widest text-[#9CA3AF] mb-4">
          Performance By Market
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono">
          <div className="p-5 rounded-2xl bg-[#111827]/70 border border-[#1F2937] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-[#10B981]" />
                  <span className="text-sm font-bold text-white font-sans">Asian Handicap</span>
                </div>
                <Link
                  href="/asian-handicap"
                  className="text-[11px] text-[#10B981] hover:underline"
                >
                  Signals →
                </Link>
              </div>

              <div className="space-y-2 mt-4 text-xs">
                <div className="flex justify-between py-1 border-b border-[#1F2937]/50">
                  <span className="text-[#9CA3AF]">Bets Settled</span>
                  <span className="text-white font-bold">{byMarket.asianHandicap.bets}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1F2937]/50">
                  <span className="text-[#9CA3AF]">Win Rate</span>
                  <span className="text-white font-bold">
                    {byMarket.asianHandicap.bets > 0
                      ? `${byMarket.asianHandicap.winRate.toFixed(1)}%`
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#9CA3AF]">Yield / ROI</span>
                  <span
                    className={cn(
                      'font-bold',
                      byMarket.asianHandicap.yieldPct >= 0 ? 'text-[#10B981]' : 'text-red-400'
                    )}
                  >
                    {byMarket.asianHandicap.bets > 0
                      ? `${byMarket.asianHandicap.yieldPct >= 0 ? '+' : ''}${byMarket.asianHandicap.yieldPct.toFixed(2)}%`
                      : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#111827]/70 border border-[#1F2937] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[#10B981]" />
                  <span className="text-sm font-bold text-white font-sans">Over / Under</span>
                </div>
                <Link href="/over-under" className="text-[11px] text-[#10B981] hover:underline">
                  Signals →
                </Link>
              </div>

              <div className="space-y-2 mt-4 text-xs">
                <div className="flex justify-between py-1 border-b border-[#1F2937]/50">
                  <span className="text-[#9CA3AF]">Bets Settled</span>
                  <span className="text-white font-bold">{byMarket.overUnder.bets}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1F2937]/50">
                  <span className="text-[#9CA3AF]">Win Rate</span>
                  <span className="text-white font-bold">
                    {byMarket.overUnder.bets > 0
                      ? `${byMarket.overUnder.winRate.toFixed(1)}%`
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#9CA3AF]">Yield / ROI</span>
                  <span
                    className={cn(
                      'font-bold',
                      byMarket.overUnder.yieldPct >= 0 ? 'text-[#10B981]' : 'text-red-400'
                    )}
                  >
                    {byMarket.overUnder.bets > 0
                      ? `${byMarket.overUnder.yieldPct >= 0 ? '+' : ''}${byMarket.overUnder.yieldPct.toFixed(2)}%`
                      : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#111827]/70 border border-[#1F2937] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
                  <span className="text-sm font-bold text-white font-sans">BTTS</span>
                </div>
                <Link href="/btts" className="text-[11px] text-[#10B981] hover:underline">
                  Signals →
                </Link>
              </div>

              <div className="space-y-2 mt-4 text-xs">
                <div className="flex justify-between py-1 border-b border-[#1F2937]/50">
                  <span className="text-[#9CA3AF]">Bets Settled</span>
                  <span className="text-white font-bold">{byMarket.btts.bets}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1F2937]/50">
                  <span className="text-[#9CA3AF]">Win Rate</span>
                  <span className="text-white font-bold">
                    {byMarket.btts.bets > 0 ? `${byMarket.btts.winRate.toFixed(1)}%` : '—'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#9CA3AF]">Yield / ROI</span>
                  <span
                    className={cn(
                      'font-bold',
                      byMarket.btts.yieldPct >= 0 ? 'text-[#10B981]' : 'text-red-400'
                    )}
                  >
                    {byMarket.btts.bets > 0
                      ? `${byMarket.btts.yieldPct >= 0 ? '+' : ''}${byMarket.btts.yieldPct.toFixed(2)}%`
                      : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-mono uppercase tracking-widest text-[#9CA3AF]">
            Recent Settled Predictions
          </h2>
          <span className="text-xs font-mono text-[#9CA3AF]">
            Showing {recentSettled.length} records
          </span>
        </div>

        {recentSettled.length === 0 ? (
          <div className="rounded-2xl border border-[#1F2937] bg-[#111827]/40 p-12 text-center text-[#9CA3AF] font-mono">
            <Activity className="h-8 w-8 mx-auto mb-3 opacity-30 text-[#10B981]" />
            <h3 className="text-sm font-bold text-white">No settled bets recorded yet.</h3>
            <p className="text-xs text-[#9CA3AF] mt-1 max-w-md mx-auto">
              Your personal performance metrics and settlement log will appear here once upcoming fixtures finish and are audited.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-[#1F2937] bg-[#111827]/70 overflow-hidden font-mono text-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#1F2937] text-[#9CA3AF] bg-[#0B0F0E]/50">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Match</th>
                    <th className="py-3 px-4">Market</th>
                    <th className="py-3 px-4">Pick</th>
                    <th className="py-3 px-4">Odds</th>
                    <th className="py-3 px-4">Result</th>
                    <th className="py-3 px-4 text-right">P/L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F2937]">
                  {recentSettled.map((row) => (
                    <tr key={row.id} className="hover:bg-[#111827]">
                      <td className="py-3 px-4 text-[#9CA3AF] whitespace-nowrap">{row.date}</td>
                      <td className="py-3 px-4 font-bold text-white whitespace-nowrap">{row.match}</td>
                      <td className="py-3 px-4 text-neutral-300 whitespace-nowrap">{row.market}</td>
                      <td className="py-3 px-4 text-[#10B981] whitespace-nowrap">{row.pick}</td>
                      <td className="py-3 px-4 text-white font-bold whitespace-nowrap">
                        {row.odds.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                            row.profitLoss > 0
                              ? 'bg-[#10B981]/15 text-[#10B981]'
                              : row.profitLoss < 0
                              ? 'bg-red-500/15 text-red-400'
                              : 'bg-neutral-800 text-neutral-400'
                          )}
                        >
                          {row.result}
                        </span>
                      </td>
                      <td
                        className={cn(
                          'py-3 px-4 text-right font-bold whitespace-nowrap',
                          row.profitLoss >= 0 ? 'text-[#10B981]' : 'text-red-400'
                        )}
                      >
                        {row.profitLoss >= 0 ? `+${row.profitLoss.toFixed(2)}u` : `${row.profitLoss.toFixed(2)}u`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

