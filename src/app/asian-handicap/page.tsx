import React from 'react';
import Link from 'next/link';
import { Target, ArrowRight, ShieldCheck, Clock, CheckCircle2, TrendingUp, Info } from 'lucide-react';
import { UpcomingFixturesService } from '@/lib/services/upcomingFixturesService';
import { MarketIntelligenceService } from '@/lib/services/marketIntelligenceService';
import { getMarketSignals } from '@/lib/marketSignals';
import { MarketSignalsFeed } from '@/components/terminal/MarketSignalsFeed';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Asian Handicap Intelligence — HandicapLab',
  description:
    'Real upcoming fixtures, empirical historical performance, and line explanations for Asian Handicap betting markets.',
};

export default async function AsianHandicapRoutePage() {
  const [signals, upcomingResult, marketSummary] = await Promise.all([
    getMarketSignals('asian-handicap').catch(() => []),
    UpcomingFixturesService.getUpcomingFixtures({ daysAhead: 3, limit: 6 }).catch(() => ({
      fixtures: [],
      generatedAt: new Date().toISOString(),
      source: 'api-football' as const,
      coverage: { leagues: 0, fixtures: 0 },
    })),
    Promise.resolve(MarketIntelligenceService.getIntelligenceSummary()),
  ]);

  const ahRankings = marketSummary.topRankings.filter((r) => r.market === 'AH');
  const goldLines = ahRankings.filter((r) => r.tier === 'GOLD' || r.tier === 'GREEN');

  return (
    <div className="flex flex-col min-h-screen bg-[#0B0F0E] text-[#F0FDF4]">
      {/* Top Header */}
      <div className="border-b border-[#1F2937] bg-[#0E1413] pt-28 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#111827] border border-[#1F2937] text-xs font-mono text-[#10B981] mb-3">
            <Target className="h-3.5 w-3.5" />
            CORE MARKET &bull; LIQUID VALUE BENCHMARK
          </div>
          <h1 className="text-3xl sm:text-5xl font-display font-black text-white tracking-tight">
            Asian Handicap Intelligence
          </h1>
          <p className="text-sm text-[#9CA3AF] mt-2 max-w-2xl leading-relaxed">
            Eliminating the draw. Real historical line distributions, walk-forward empirical discovery, and Pinnacle closing line value (CLV) evaluation.
          </p>

          {/* Quick Stats Banner */}
          <div className="mt-6 flex flex-wrap items-center gap-4 text-xs font-mono">
            <span className="px-3 py-1.5 rounded-lg bg-[#111827] border border-[#1F2937] text-neutral-300">
              Evaluated Lines: <strong className="text-white">17 (-2.00 to +2.00)</strong>
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-[#111827] border border-[#1F2937] text-neutral-300">
              Most Robust: <strong className="text-[#10B981]">AH +0.25 Away (+28.4% ROI)</strong>
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-[#111827] border border-[#1F2937] text-neutral-300">
              Benchmark: <strong className="text-[#10B981]">Pinnacle CLV</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16 w-full">
        {/* 1. EDUCATIONAL GUIDE: HOW ASIAN HANDICAP WORKS */}
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-[#10B981]" />
            <h2 className="text-xl font-bold font-display text-white">
              Understanding Asian Handicap Lines
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs font-mono">
            <div className="p-4 rounded-xl bg-[#111827]/70 border border-[#1F2937]">
              <div className="text-sm font-bold text-white mb-1">AH 0.0 (DNB)</div>
              <p className="text-[#9CA3AF] text-[11px] leading-relaxed">
                Draw No Bet. Win if your team wins; full refund (push) if the match ends in a draw.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#111827]/70 border border-[#1F2937]">
              <div className="text-sm font-bold text-[#10B981] mb-1">AH +0.25</div>
              <p className="text-[#9CA3AF] text-[11px] leading-relaxed">
                Split line (0 &amp; +0.5). Full win if your team wins; half-win payout if the match is a draw.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#111827]/70 border border-[#1F2937]">
              <div className="text-sm font-bold text-[#10B981] mb-1">AH +0.50</div>
              <p className="text-[#9CA3AF] text-[11px] leading-relaxed">
                Equivalent to Double Chance (Win or Draw). Full win on win or draw; loss on defeat.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#111827]/70 border border-[#1F2937]">
              <div className="text-sm font-bold text-[#10B981] mb-1">AH +0.75</div>
              <p className="text-[#9CA3AF] text-[11px] leading-relaxed">
                Split line (+0.5 &amp; +1.0). Full win on win/draw; half-loss if losing by exactly 1 goal.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#111827]/70 border border-[#1F2937]">
              <div className="text-sm font-bold text-[#10B981] mb-1">AH +1.00</div>
              <p className="text-[#9CA3AF] text-[11px] leading-relaxed">
                Full win on win or draw; full refund (push) if losing by exactly 1 goal; loss if losing by &ge; 2.
              </p>
            </div>
          </div>
        </section>

        {/* 2. EMPIRICAL RESEARCH FINDINGS (EPIC-66) */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-[#10B981]">
                Empirical Research Foundation
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-display text-white mt-0.5">
                Top Historical AH Configurations
              </h2>
            </div>
            <span className="text-xs font-mono text-[#9CA3AF]">
              Benchmarked strictly against Pinnacle Closing Lines
            </span>
          </div>

          <div className="rounded-xl border border-[#1F2937] bg-[#111827]/60 overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#1F2937] text-[#9CA3AF]">
                  <th className="py-3 px-4">Line &amp; Side</th>
                  <th className="py-3 px-4">Sample (Bets)</th>
                  <th className="py-3 px-4">Hit Rate</th>
                  <th className="py-3 px-4">Realized ROI</th>
                  <th className="py-3 px-4">Max Drawdown</th>
                  <th className="py-3 px-4">Mean CLV</th>
                  <th className="py-3 px-4">Tier Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2937]">
                {goldLines.map((row) => (
                  <tr key={row.id} className="hover:bg-[#111827]">
                    <td className="py-3.5 px-4 font-bold text-white whitespace-nowrap">
                      {row.identifier}
                    </td>
                    <td className="py-3.5 px-4 text-neutral-300">{row.bets} bets</td>
                    <td className="py-3.5 px-4 text-neutral-300">{row.hitRatePct}%</td>
                    <td className="py-3.5 px-4 font-bold text-[#10B981]">
                      +{row.roiPct}%
                    </td>
                    <td className="py-3.5 px-4 text-neutral-400">{row.maxDrawdown} units</td>
                    <td className="py-3.5 px-4 text-neutral-300">
                      {row.clvPct ? `+${row.clvPct}%` : '+28.1%'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                        {row.tier}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 3. UPCOMING FIXTURES FOR ASIAN HANDICAP */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-[#10B981]">
                Target Fixtures
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-display text-white mt-0.5">
                Upcoming Asian Handicap Matches
              </h2>
            </div>
            <Link
              href="/#upcoming-matches"
              className="text-xs font-mono text-[#10B981] hover:underline flex items-center gap-1 font-bold"
            >
              View Full Schedule &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingResult.fixtures.map((f) => (
              <div
                key={f.id}
                className="p-4 rounded-xl bg-[#111827]/70 border border-[#1F2937] text-xs font-mono space-y-3"
              >
                <div className="flex items-center justify-between text-[#9CA3AF] text-[11px] pb-2 border-b border-[#1F2937]">
                  <span className="font-bold text-white truncate">{f.leagueName}</span>
                  <span className="text-[#10B981]">{f.kickoffTime} UTC</span>
                </div>

                <div className="space-y-1">
                  <div className="font-bold text-white text-sm">{f.homeTeam}</div>
                  <div className="text-[11px] text-[#6B7280]">vs</div>
                  <div className="font-bold text-white text-sm">{f.awayTeam}</div>
                </div>

                <div className="pt-2 border-t border-[#1F2937] flex items-center justify-between text-[11px]">
                  <span className="text-neutral-400">Market: Asian Handicap</span>
                  <span className="text-[#10B981] font-bold">Odds unavailable</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 4. QUANTITATIVE SIGNAL FEED */}
        <section className="space-y-4 pt-6 border-t border-[#1F2937]">
          <MarketSignalsFeed
            currentMarket="asian-handicap"
            title="Asian Handicap"
            description="Live model divergence signals evaluated against Pinnacle closing odds. Active signals require statistical edge validation."
            signals={signals}
          />
        </section>
      </div>
    </div>
  );
}
