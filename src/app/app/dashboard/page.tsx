'use client';

import React from 'react';
import Link from 'next/link';
import { Activity, Target, TrendingUp, Flame, ArrowRight, Shield, Zap } from 'lucide-react';
import { useLiveMatches, useSignals, usePerformance } from '@/hooks/useApi';
import { useAppStore } from '@/store/appStore';
import { EngineStatusWidget } from '@/components/engine/EngineStatusWidget';
import { EVBadge } from '@/components/ui/EVBadge';
import { PaywallBlurOverlay } from '@/components/ui/PaywallBlurOverlay';

export default function DashboardPage() {
  const { userTier } = useAppStore();
  const { data: liveMatches, isLoading: loadingLive } = useLiveMatches();
  const { data: signals, isLoading: loadingSignals } = useSignals();
  const { data: perf, isLoading: loadingPerf } = usePerformance(7);

  // Compute stat card metrics
  const liveCount = liveMatches ? liveMatches.length : 0;
  const activeSignals = signals ? signals.filter((s) => s.ev > 0) : [];
  const activeSignalsCount = activeSignals.length;
  
  const avgEdge = activeSignalsCount > 0
    ? (activeSignals.reduce((acc, curr) => acc + curr.ev, 0) / activeSignalsCount).toFixed(1)
    : '0.0';

  const pnl7d = perf ? perf.cumulativePnL : 0;

  return (
    <div className="flex flex-col space-y-6 pb-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-[#F0FDF4]">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-[#9CA3AF]">
            Real-time market intelligence, live match momentum, and quantitative value signals.
          </p>
        </div>

        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#10B981] hover:bg-[#10B981]/90 text-black font-bold text-xs transition-colors self-start sm:self-auto shadow-sm"
        >
          <Shield className="h-4 w-4" />
          <span>Active Plan: {userTier.toUpperCase()}</span>
        </Link>
      </div>

      {/* Autonomous Engine Heartbeat */}
      <EngineStatusWidget />

      {/* 4 Stat Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Live Matches */}
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
              Live Matches
            </span>
            <div className="h-8 w-8 rounded-lg bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center text-[#10B981]">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-display font-bold text-[#F0FDF4]">
              {loadingLive ? '...' : liveCount}
            </span>
            <span className="text-xs font-semibold text-[#10B981] flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[#10B981] animate-ping" /> In-play
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[#9CA3AF]">Active fixtures monitored</p>
        </div>

        {/* Card 2: Active Signals */}
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
              Active Signals
            </span>
            <div className="h-8 w-8 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B]">
              <Target className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-display font-bold text-[#F0FDF4]">
              {loadingSignals ? '...' : activeSignalsCount}
            </span>
            <span className="text-xs font-semibold text-[#F59E0B]">EV &gt; 0%</span>
          </div>
          <p className="mt-1 text-[11px] text-[#9CA3AF]">High confidence edges</p>
        </div>

        {/* Card 3: Avg Edge */}
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
              Avg Edge
            </span>
            <div className="h-8 w-8 rounded-lg bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center text-[#10B981]">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-display font-bold text-[#10B981]">
              +{loadingSignals ? '...' : avgEdge}%
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[#9CA3AF]">Model expected value</p>
        </div>

        {/* Card 4: 7-Day P/L */}
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
              7-Day P/L
            </span>
            <div
              className={`h-8 w-8 rounded-lg border flex items-center justify-center ${
                pnl7d >= 0
                  ? 'bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]'
                  : 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]'
              }`}
            >
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={`text-3xl font-display font-bold ${
                pnl7d >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
              }`}
            >
              {loadingPerf ? '...' : `${pnl7d >= 0 ? '+' : ''}${pnl7d} u`}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[#9CA3AF]">Cumulative track record</p>
        </div>
      </div>

      {/* Section: Live Now */}
      <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B]">
              <Flame className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-bold text-[#F0FDF4]">Live Now</h2>
          </div>

          <Link
            href="/app/markets/asian-handicap"
            className="text-xs font-semibold text-[#10B981] hover:text-[#10B981]/80 flex items-center gap-1 transition-colors"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {liveMatches && liveMatches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {liveMatches.slice(0, 3).map((match) => (
              <div
                key={match.id}
                className="rounded-lg border border-[#1F2937] bg-[#0B0F0E] p-4 flex flex-col justify-between space-y-3"
              >
                <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
                  <span>{match.league}</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#10B981]/10 text-[#10B981] font-bold text-[10px]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-ping" />
                    LIVE {match.minute ? `'${match.minute}` : ''}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm font-semibold text-[#F0FDF4]">
                  <div className="flex-1 truncate">{match.homeTeam}</div>
                  <div className="px-3 font-mono font-bold text-[#10B981]">
                    {match.homeScore ?? 0} - {match.awayScore ?? 0}
                  </div>
                  <div className="flex-1 text-right truncate">{match.awayTeam}</div>
                </div>

                <Link
                  href={`/app/markets/asian-handicap?matchId=${match.id}`}
                  className="w-full text-center py-1.5 rounded-md bg-[#111827] border border-[#1F2937] text-xs text-[#9CA3AF] hover:text-[#F0FDF4] hover:border-[#10B981]/50 transition-colors"
                >
                  View Odds Movement
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-xs text-[#9CA3AF]">
            No live fixtures currently in play. Next matches scheduled shortly.
          </div>
        )}
      </div>

      {/* Section: Latest Signals */}
      <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-6 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center text-[#10B981]">
              <Target className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-bold text-[#F0FDF4]">Latest Signals</h2>
          </div>

          <Link
            href="/app/value-bets"
            className="text-xs font-semibold text-[#10B981] hover:text-[#10B981]/80 flex items-center gap-1 transition-colors"
          >
            All signals <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="space-y-3">
          {signals && signals.slice(0, 5).map((sig) => {
            const isLocked = userTier === 'free' && sig.confidence > 70;

            return (
              <div
                key={sig.id}
                className="relative rounded-lg border border-[#1F2937] bg-[#0B0F0E] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className={`flex flex-col sm:flex-row sm:items-center gap-3 flex-1 ${isLocked ? 'filter blur-[4px] opacity-40 select-none pointer-events-none' : ''}`}>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-xs font-bold w-fit">
                    {sig.marketType}
                  </span>

                  <div>
                    <div className="text-sm font-semibold text-[#F0FDF4]">
                      {sig.homeTeam} vs {sig.awayTeam}
                    </div>
                    <div className="text-xs text-[#9CA3AF]">
                      Selection: <span className="text-[#F0FDF4] font-medium">{sig.selection}</span> ({sig.bookmaker})
                    </div>
                  </div>
                </div>

                <div className={`flex items-center gap-3 ${isLocked ? 'filter blur-[4px] opacity-40 select-none pointer-events-none' : ''}`}>
                  <div className="text-right">
                    <div className="text-xs text-[#9CA3AF]">Odds</div>
                    <div className="text-sm font-mono font-bold text-[#F0FDF4]">{sig.odds.toFixed(2)}</div>
                  </div>
                  <EVBadge evPercent={sig.ev} size="md" />
                </div>

                {/* Free Tier Lock Blur Overlay */}
                {isLocked && (
                  <div className="absolute inset-0 z-10 flex items-center justify-between px-4 bg-[#0B0F0E]/40 rounded-lg">
                    <span className="text-xs text-[#9CA3AF] font-medium">High confidence signal locked</span>
                    <Link
                      href="/pricing"
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-[#F59E0B] text-black text-xs font-bold hover:bg-[#F59E0B]/90 transition-colors shadow-sm"
                    >
                      PRO Badge Required
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}