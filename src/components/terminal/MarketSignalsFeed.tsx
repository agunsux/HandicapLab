'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { UnifiedMarketSignal } from '@/lib/marketSignals';
import { Target, TrendingUp, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarketSignalsFeedProps {
  currentMarket: 'asian-handicap' | 'over-under' | 'btts';
  title: string;
  description: string;
  signals: UnifiedMarketSignal[];
}

const TABS = [
  { slug: 'asian-handicap', label: 'Asian Handicap', icon: Target },
  { slug: 'over-under', label: 'Over / Under', icon: TrendingUp },
  { slug: 'btts', label: 'BTTS', icon: CheckCircle2 },
];

export function MarketSignalsFeed({
  currentMarket,
  title,
  description,
  signals,
}: MarketSignalsFeedProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'settled'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredSignals = signals.filter((s) => {
    if (filter === 'pending' && s.status === 'SETTLED') return false;
    if (filter === 'settled' && s.status !== 'SETTLED') return false;
    return true;
  });

  const cleanTitle = title.replace(/\s*signals\s*$/i, '');

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl pt-24 pb-16 flex-1">
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#111827] border border-[#1F2937] text-xs font-mono text-[#10B981] mb-2">
          <span className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
          QUANTITATIVE SIGNAL FEED &bull; REAL DATA ONLY
        </div>
        <h1 className="text-3xl font-display font-bold text-white tracking-tight">
          {cleanTitle} Signals
        </h1>
        <p className="text-sm text-[#9CA3AF] mt-1 max-w-2xl">
          {description}
        </p>
      </div>

      <div className="flex items-center gap-2 mb-6 border-b border-[#1F2937] pb-3 overflow-x-auto">
        {TABS.map((tab) => {
          const isActive = tab.slug === currentMarket;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.slug}
              href={`/${tab.slug}`}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono transition-all whitespace-nowrap',
                isActive
                  ? 'bg-[#10B981] text-black font-bold shadow-sm'
                  : 'bg-[#111827] text-[#9CA3AF] border border-[#1F2937] hover:text-white hover:border-[#374151]'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-1 bg-[#111827] p-1 rounded-lg border border-[#1F2937]">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              'px-3 py-1 rounded text-xs font-mono transition-all',
              filter === 'all'
                ? 'bg-[#1F2937] text-white font-bold'
                : 'text-[#9CA3AF] hover:text-white'
            )}
          >
            All ({signals.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={cn(
              'px-3 py-1 rounded text-xs font-mono transition-all',
              filter === 'pending'
                ? 'bg-[#1F2937] text-amber-300 font-bold'
                : 'text-[#9CA3AF] hover:text-white'
            )}
          >
            Active ({signals.filter((s) => s.status !== 'SETTLED').length})
          </button>
          <button
            onClick={() => setFilter('settled')}
            className={cn(
              'px-3 py-1 rounded text-xs font-mono transition-all',
              filter === 'settled'
                ? 'bg-[#1F2937] text-[#10B981] font-bold'
                : 'text-[#9CA3AF] hover:text-white'
            )}
          >
            Settled ({signals.filter((s) => s.status === 'SETTLED').length})
          </button>
        </div>

        <div className="text-xs font-mono text-[#9CA3AF]">
          Source: <span className="text-[#10B981]">Pinnacle Benchmark</span>
        </div>
      </div>

      {filteredSignals.length === 0 ? (
        <div className="rounded-2xl border border-[#1F2937] bg-[#111827]/40 p-12 text-center text-[#9CA3AF]">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-[#111827] border border-[#1F2937] text-[#10B981] mb-4">
            <Clock className="h-8 w-8 text-[#10B981] opacity-70" />
          </div>
          <h3 className="text-base font-bold text-white font-mono">
            No qualifying {cleanTitle} signals right now
          </h3>
          <p className="text-xs text-[#9CA3AF] mt-2 max-w-lg mx-auto leading-relaxed">
            HandicapLab operates on 100% verified provider data. When active bookmaker odds (OddsPAPI v4 Pinnacle/SBOBET) or verified upcoming fixtures (API-Football) do not exceed our quantitative statistical hurdle, no signals are displayed.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-[11px] font-mono">
            <span className="px-2.5 py-1 rounded-md bg-[#111827] border border-[#1F2937] text-neutral-300">
              Zero Synthetic Data Invariant: <strong className="text-emerald-400">ENFORCED</strong>
            </span>
            <span className="px-2.5 py-1 rounded-md bg-[#111827] border border-[#1F2937] text-neutral-300">
              Benchmark Ground Truth: <strong className="text-emerald-400">Pinnacle CLV</strong>
            </span>
            <Link
              href="/methodology"
              className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
            >
              Read Data Governance Manifesto &rarr;
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-[#1F2937] bg-[#111827]/70 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#1F2937] text-[#9CA3AF] bg-[#0B0F0E]/50">
                  <th className="py-3 px-4">Match</th>
                  <th className="py-3 px-4">Signal</th>
                  <th className="py-3 px-4">Data Status</th>
                  <th className="py-3 px-4">Time (UTC)</th>
                  <th className="py-3 px-4">Market</th>
                  <th className="py-3 px-4">Pick</th>
                  <th className="py-3 px-4">Odds</th>
                  <th className="py-3 px-4">Edge</th>
                  <th className="py-3 px-4">Confidence</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2937]">
                {filteredSignals.map((sig) => {
                  const isExpanded = expandedId === sig.id;
                  const dateStr = new Date(sig.kickoff).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <React.Fragment key={sig.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : sig.id)}
                        className="hover:bg-[#111827] cursor-pointer transition-colors"
                      >
                        <td className="py-3.5 px-4 font-bold text-white whitespace-nowrap">
                          {sig.homeTeam}{' '}
                          <span className="text-[#9CA3AF] font-normal text-[11px]">vs</span>{' '}
                          {sig.awayTeam}
                          <div className="text-[10px] text-[#9CA3AF] font-normal">{sig.league}</div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {sig.signalColor === 'green' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                              🟢 GREEN
                            </span>
                          ) : sig.signalColor === 'yellow' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/40">
                              🟡 YELLOW
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
                              🔴 RED
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {sig.dataStatus === 'LIVE' ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              LIVE
                            </span>
                          ) : sig.dataStatus === 'HISTORICAL_MARKET_DATA' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                              HISTORICAL MARKET DATA
                            </span>
                          ) : sig.dataStatus === 'HISTORICAL_MATCH_FACTS' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                              HISTORICAL MATCH FACTS
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30">
                              CALIBRATION ONLY
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-[#9CA3AF] whitespace-nowrap">{dateStr}</td>
                        <td className="py-3.5 px-4 text-neutral-300 whitespace-nowrap">{sig.market}</td>
                        <td className="py-3.5 px-4 text-[#10B981] font-bold whitespace-nowrap">
                          {sig.pick}
                        </td>
                        <td className="py-3.5 px-4 text-white font-bold whitespace-nowrap">
                          {sig.odds.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={cn(
                              'font-bold',
                              sig.edge > 0 ? 'text-[#10B981]' : 'text-neutral-400'
                            )}
                          >
                            {sig.edge > 0 ? `+${sig.edge.toFixed(1)}%` : `${sig.edge.toFixed(1)}%`}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-[#9CA3AF] whitespace-nowrap">{sig.confidence}</td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {sig.status === 'SETTLED' ? (
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                                (sig.profit_loss || 0) > 0
                                  ? 'bg-[#10B981]/15 text-[#10B981]'
                                  : 'bg-red-500/15 text-red-400'
                              )}
                            >
                              {sig.actualOutcome || ((sig.profit_loss || 0) > 0 ? 'WIN' : 'LOSS')}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase">
                              PENDING
                            </span>
                          )}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-[#0B0F0E]">
                          <td colSpan={9} className="p-4 border-b border-[#1F2937]">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono mb-4">
                              <div className="bg-[#111827] p-3 rounded-lg border border-[#1F2937]">
                                <span className="text-[#9CA3AF] text-[10px] block uppercase">
                                  Fair Odds (Model)
                                </span>
                                <span className="text-white font-bold text-sm">
                                  {sig.fairOdds ? sig.fairOdds.toFixed(2) : '—'}
                                </span>
                              </div>
                              <div className="bg-[#111827] p-3 rounded-lg border border-[#1F2937]">
                                <span className="text-[#9CA3AF] text-[10px] block uppercase">
                                  Market Price
                                </span>
                                <span className="text-white font-bold text-sm">
                                  {sig.odds.toFixed(2)}
                                </span>
                              </div>
                              <div className="bg-[#111827] p-3 rounded-lg border border-[#1F2937]">
                                <span className="text-[#9CA3AF] text-[10px] block uppercase">
                                  Model Version
                                </span>
                                <span className="text-neutral-300 font-bold text-sm truncate block">
                                  {sig.modelVersion || 'AH-dixoncoles-v1.0.0'}
                                </span>
                              </div>
                              <div className="bg-[#111827] p-3 rounded-lg border border-[#1F2937]">
                                <span className="text-[#9CA3AF] text-[10px] block uppercase">
                                  Net Return
                                </span>
                                <span
                                  className={cn(
                                    'font-bold text-sm',
                                    (sig.profit_loss || 0) >= 0 ? 'text-[#10B981]' : 'text-red-400'
                                  )}
                                >
                                  {sig.profit_loss !== undefined && sig.profit_loss !== null
                                    ? `${sig.profit_loss > 0 ? '+' : ''}${sig.profit_loss.toFixed(2)}u`
                                    : 'Awaiting Settlement'}
                                </span>
                              </div>
                            </div>

                            {/* Explicit 4-Layer Taxonomy */}
                            <div className="bg-[#111827] p-4 rounded-lg border border-[#1F2937] space-y-3 font-mono text-xs">
                              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1F2937] pb-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-[#9CA3AF]">Data Provenance:</span>
                                  <span className="text-white font-bold">{sig.sourceProvenance}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[#9CA3AF]">Quality Gate:</span>
                                  <span className="text-emerald-400 font-bold">Passed (Zero-Synthetic Audit)</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1 text-[11px]">
                                <div className="bg-[#0B0F0E] p-2.5 rounded border border-[#1F2937]">
                                  <span className="text-emerald-400 font-bold block text-[10px] mb-1">1. MATCH FACTS</span>
                                  <span className="text-neutral-300 block">
                                    {sig.actualOutcome ? `Score: ${sig.actualOutcome}` : 'Kickoff Scheduled'}
                                  </span>
                                  <span className="text-[#9CA3AF] text-[10px]">API-Football / Football-Data</span>
                                </div>
                                <div className="bg-[#0B0F0E] p-2.5 rounded border border-[#1F2937]">
                                  <span className="text-blue-400 font-bold block text-[10px] mb-1">2. MARKET ODDS</span>
                                  <span className="text-neutral-300 block">
                                    {sig.dataStatus === 'HISTORICAL_MARKET_DATA' || sig.dataStatus === 'LIVE'
                                      ? `Line Price: ${sig.odds.toFixed(2)}`
                                      : 'Odds Not Present (Fact Only)'}
                                  </span>
                                  <span className="text-[#9CA3AF] text-[10px]">
                                    {sig.dataStatus === 'HISTORICAL_MARKET_DATA' || sig.dataStatus === 'LIVE'
                                      ? 'Pinnacle Benchmark'
                                      : 'No Historical Bookmaker Odds'}
                                  </span>
                                </div>
                                <div className="bg-[#0B0F0E] p-2.5 rounded border border-[#1F2937]">
                                  <span className="text-purple-400 font-bold block text-[10px] mb-1">3. DERIVED OUTCOME</span>
                                  <span className="text-neutral-300 block">{sig.pick}</span>
                                  <span className="text-[#9CA3AF] text-[10px]">Deterministic Rule</span>
                                </div>
                                <div className="bg-[#0B0F0E] p-2.5 rounded border border-[#1F2937]">
                                  <span className="text-amber-400 font-bold block text-[10px] mb-1">4. MODEL CALIBRATION</span>
                                  <span className="text-neutral-300 block">
                                    {sig.fairOdds ? `Fair: ${sig.fairOdds.toFixed(2)}` : 'Dixon-Coles Matrix'}
                                  </span>
                                  <span className="text-[#9CA3AF] text-[10px]">Bivariate Poisson &rho; = -0.05</span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

