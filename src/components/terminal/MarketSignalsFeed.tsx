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

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl pt-24 pb-16 flex-1">
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#111827] border border-[#1F2937] text-xs font-mono text-[#10B981] mb-2">
          <span className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
          QUANTITATIVE SIGNAL FEED &bull; REAL DATA ONLY
        </div>
        <h1 className="text-3xl font-display font-bold text-white tracking-tight">
          {title}
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
        <div className="rounded-2xl border border-[#1F2937] bg-[#111827]/40 p-16 text-center text-[#9CA3AF]">
          <Clock className="h-10 w-10 mx-auto mb-3 opacity-30 text-[#10B981]" />
          <h3 className="text-base font-bold text-white font-mono">
            No qualifying {title} signals right now.
          </h3>
          <p className="text-xs text-[#9CA3AF] mt-1 max-w-md mx-auto">
            Signals are generated strictly when model probability departs from closing market prices by our minimum statistical hurdle. No signals are fabricated.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#1F2937] bg-[#111827]/70 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#1F2937] text-[#9CA3AF] bg-[#0B0F0E]/50">
                  <th className="py-3 px-4">Match</th>
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
                          <td colSpan={8} className="p-4 border-b border-[#1F2937]">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
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

