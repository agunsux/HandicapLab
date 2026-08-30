'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Eye, EyeOff, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { EngineStatusWidget } from '@/components/engine/EngineStatusWidget';
import { EVBadge } from '@/components/ui/EVBadge';
import { useMatches, useOdds } from '@/hooks/useApi';
import { useAppStore } from '@/store/appStore';
import { MatchOdds, Match } from '@/types';

type MarketCategory = 'asian-handicap' | 'over-under' | 'btts';

const MARKET_TITLE_MAP: Record<MarketCategory, string> = {
  'asian-handicap': 'Asian Handicap',
  'over-under': 'Over / Under',
  'btts': 'Both Teams to Score (BTTS)',
};

const MARKET_KEY_MAP: Record<MarketCategory, string> = {
  'asian-handicap': 'AH',
  'over-under': 'OU',
  'btts': 'BTTS',
};

const TABS = [
  { slug: 'asian-handicap', label: 'Asian Handicap' },
  { slug: 'over-under', label: 'Over / Under' },
  { slug: 'btts', label: 'BTTS' },
];

interface MarketPageProps {
  market: MarketCategory;
  description: string;
}

export function MarketPage({ market, description }: MarketPageProps) {
  const { watchlist, addToWatchlist, removeFromWatchlist } = useAppStore();
  const { data: matches, isLoading: loadingMatches } = useMatches();
  const { data: oddsData, isLoading: loadingOdds } = useOdds();

  const [expandedMatches, setExpandedMatches] = useState<Record<string, boolean>>({
    'm-101': true,
    'm-102': true,
  });

  const toggleExpand = (id: string) => {
    setExpandedMatches((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const currentMarketKey = MARKET_KEY_MAP[market];

  return (
    <div className="flex flex-col space-y-6 pb-8">
      {/* Page Header & Engine Heartbeat */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-[#F0FDF4]">
            {MARKET_TITLE_MAP[market]}
          </h1>
          <p className="mt-1 text-sm text-[#9CA3AF]">{description}</p>
        </div>
        <EngineStatusWidget compact />
      </div>

      {/* Horizontal Market Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-[#1F2937]">
        {TABS.map((tab) => {
          const isActive = tab.slug === market;
          return (
            <Link
              key={tab.slug}
              href={`/app/markets/${tab.slug}`}
              className={`px-4 py-2 rounded-lg text-xs transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-[#10B981] text-black font-bold shadow-sm'
                  : 'bg-[#111827] text-[#9CA3AF] border border-[#1F2937] hover:text-[#F0FDF4] hover:border-[#10B981]/50'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Match Cards List */}
      {loadingMatches || loadingOdds ? (
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-12 text-center text-sm text-[#9CA3AF] animate-pulse">
          Loading {MARKET_TITLE_MAP[market]} odds movement data...
        </div>
      ) : !matches || matches.length === 0 ? (
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-12 text-center text-sm text-[#9CA3AF]">
          No fixtures available for this market window.
        </div>
      ) : (
        <div className="space-y-4">
          {matches.map((match: Match) => {
            const isExpanded = expandedMatches[match.id] ?? true;
            const isWatched = watchlist.includes(match.id);
            const matchOdds = oddsData?.find((o: any) => o.market === currentMarketKey) || oddsData?.[0];

            return (
              <div
                key={match.id}
                className="rounded-xl border border-[#1F2937] bg-[#111827] overflow-hidden shadow-sm transition-all"
              >
                {/* Collapsible Card Header */}
                <div
                  onClick={() => toggleExpand(match.id)}
                  className="p-4 bg-[#111827] hover:bg-[#111827]/80 flex items-center justify-between cursor-pointer border-b border-[#1F2937]"
                >
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-md bg-[#0B0F0E] border border-[#1F2937] text-[11px] font-semibold text-[#10B981]">
                      {match.league}
                    </span>

                    <span className="text-sm font-bold text-[#F0FDF4]">
                      {match.homeTeam} vs {match.awayTeam}
                    </span>

                    {match.status === 'LIVE' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#10B981]/10 text-[#10B981] text-[10px] font-bold">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-ping" />
                        LIVE {match.score?.home ?? 0}-{match.score?.away ?? 0} ({match.minute}')
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Watchlist Eye Icon */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isWatched) removeFromWatchlist(match.id);
                        else addToWatchlist(match.id);
                      }}
                      title={isWatched ? 'Remove from Watchlist' : 'Add to Watchlist'}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        isWatched
                          ? 'bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]'
                          : 'bg-[#0B0F0E] border-[#1F2937] text-[#9CA3AF] hover:text-[#F0FDF4]'
                      }`}
                    >
                      {isWatched ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>

                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-[#9CA3AF]" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-[#9CA3AF]" />
                    )}
                  </div>
                </div>

                {/* Expanded Odds Comparison Table */}
                {isExpanded && (
                  <div className="p-4 bg-[#0B0F0E] overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-[#1F2937] text-[11px] uppercase tracking-wider text-[#9CA3AF]">
                        <tr>
                          <th className="py-2.5 px-3">Bookmaker</th>
                          <th className="py-2.5 px-3">Selection / Line</th>
                          <th className="py-2.5 px-3 text-right">Market Price</th>
                          <th className="py-2.5 px-3 text-right">Movement %</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1F2937]/50 font-mono">
                        {matchOdds?.items?.map((item: any, idx: number) => {
                          const change = item.changePercent || 0;
                          const isSteamed = change > 0;
                          const isDrifted = change < 0;

                          return (
                            <tr key={idx} className="hover:bg-[#111827]/50 transition-colors">
                              <td className="py-3 px-3 font-sans font-semibold text-[#F0FDF4]">
                                {item.bookmaker}
                              </td>
                              <td className="py-3 px-3 font-sans text-[#9CA3AF]">
                                <span className="text-[#F0FDF4] font-medium">{item.selection}</span>
                                {item.line && <span className="ml-1 text-[11px] text-[#9CA3AF]">({item.line})</span>}
                              </td>
                              <td className="py-3 px-3 text-right font-bold text-[#F0FDF4] text-sm">
                                {item.price.toFixed(2)}
                              </td>
                              <td className="py-3 px-3 text-right">
                                {isSteamed && (
                                  <span className="inline-flex items-center gap-0.5 text-[#10B981] font-semibold text-xs">
                                    <TrendingUp className="h-3 w-3" /> +{change}%
                                  </span>
                                )}
                                {isDrifted && (
                                  <span className="inline-flex items-center gap-0.5 text-[#EF4444] font-semibold text-xs">
                                    <TrendingDown className="h-3 w-3" /> {change}%
                                  </span>
                                )}
                                {!isSteamed && !isDrifted && (
                                  <span className="inline-flex items-center gap-0.5 text-[#9CA3AF] text-xs">
                                    <Minus className="h-3 w-3" /> 0.0%
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-right font-sans">
                                <Link
                                  href={`/app/value-bets?matchId=${match.id}`}
                                  className="px-2.5 py-1 rounded bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-[11px] font-bold hover:bg-[#10B981]/20 transition-colors"
                                >
                                  Analyze Edge
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}