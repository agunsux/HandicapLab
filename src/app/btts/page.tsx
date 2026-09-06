import React from 'react';
import Link from 'next/link';
import { CheckCircle2, ArrowRight, ShieldCheck, Clock, Info, Activity } from 'lucide-react';
import { UpcomingFixturesService } from '@/lib/services/upcomingFixturesService';
import { MarketIntelligenceService } from '@/lib/services/marketIntelligenceService';
import { getMarketSignals } from '@/lib/marketSignals';
import { MarketSignalsFeed } from '@/components/terminal/MarketSignalsFeed';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Both Teams To Score (BTTS) — HandicapLab',
  description:
    'Real upcoming fixtures, joint probability evaluation, and empirical BTTS league frequencies.',
};

export default async function BttsRoutePage() {
  const [signals, upcomingResult, marketSummary] = await Promise.all([
    getMarketSignals('btts').catch(() => []),
    UpcomingFixturesService.getUpcomingFixtures({ daysAhead: 3, limit: 6 }).catch(() => ({
      fixtures: [],
      generatedAt: new Date().toISOString(),
      source: 'api-football' as const,
      coverage: { leagues: 0, fixtures: 0 },
    })),
    Promise.resolve(MarketIntelligenceService.getIntelligenceSummary()),
  ]);

  const bttsRankings = marketSummary.topRankings.filter((r) => r.market === 'BTTS');

  return (
    <div className="flex flex-col min-h-screen bg-[#0B0F0E] text-[#F0FDF4]">
      {/* Top Header */}
      <div className="border-b border-[#1F2937] bg-[#0E1413] pt-28 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#111827] border border-[#1F2937] text-xs font-mono text-[#10B981] mb-3">
            <CheckCircle2 className="h-3.5 w-3.5" />
            JOINT PROBABILITIES &bull; ATTACKING TEMPO
          </div>
          <h1 className="text-3xl sm:text-5xl font-display font-black text-white tracking-tight">
            Both Teams To Score (BTTS)
          </h1>
          <p className="text-sm text-[#9CA3AF] mt-2 max-w-2xl leading-relaxed">
            Joint probability evaluation derived from defensive pace decay and attacking shot volumes across 30 global leagues.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-4 text-xs font-mono">
            <span className="px-3 py-1.5 rounded-lg bg-[#111827] border border-[#1F2937] text-neutral-300">
              Evaluated Leagues: <strong className="text-white">Covered Global Competitions</strong>
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-[#111827] border border-[#1F2937] text-neutral-300">
              Scoring Model: <strong className="text-[#10B981]">Joint Poisson &bull; Mutual Expectancy</strong>
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-[#111827] border border-[#1F2937] text-neutral-300">
              Benchmark: <strong className="text-[#10B981]">Pinnacle Consensus</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16 w-full">
        {/* 1. EMPIRICAL LEAGUE FREQUENCY SPECTRUM */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-[#10B981]">
                Global Spectrum
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-display text-white mt-0.5">
                Empirical BTTS Rates Across 30 Leagues
              </h2>
            </div>
            <span className="text-xs font-mono text-[#9CA3AF]">
              Derived strictly from real match scorelines (Home &ge; 1 &amp;&amp; Away &ge; 1)
            </span>
          </div>

          <div className="rounded-xl border border-[#1F2937] bg-[#111827]/60 overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#1F2937] text-[#9CA3AF]">
                  <th className="py-3 px-4">League</th>
                  <th className="py-3 px-4">Completed Fixtures</th>
                  <th className="py-3 px-4">BTTS YES Rate</th>
                  <th className="py-3 px-4">Baseline ROI @ 1.90</th>
                  <th className="py-3 px-4">Empirical Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2937]">
                {bttsRankings.map((b) => (
                  <tr key={b.id} className="hover:bg-[#111827]">
                    <td className="py-3.5 px-4 font-bold text-white whitespace-nowrap">
                      {b.leagueId}
                    </td>
                    <td className="py-3.5 px-4 text-neutral-300">{b.bets} matches</td>
                    <td className="py-3.5 px-4 font-bold text-white">
                      {b.hitRatePct}%
                    </td>
                    <td
                      className={`py-3.5 px-4 font-bold ${
                        b.roiPct > 0 ? 'text-[#10B981]' : 'text-red-400'
                      }`}
                    >
                      {b.roiPct > 0 ? `+${b.roiPct}%` : `${b.roiPct}%`}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          b.tier === 'GOLD'
                            ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
                            : b.tier === 'GREEN'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : b.tier === 'YELLOW'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : 'bg-red-500/15 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {b.tier}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 2. UPCOMING BTTS FIXTURES */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-[#10B981]">
                Target Fixtures
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-display text-white mt-0.5">
                Upcoming Both Teams To Score Matches
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
            {upcomingResult.fixtures.length === 0 ? (
              <div className="col-span-full py-8 text-center rounded-xl bg-[#111827]/40 border border-[#1F2937] text-xs font-mono text-[#9CA3AF]">
                No upcoming Both Teams To Score fixtures discovered for this target horizon. Next scheduled matchday will appear automatically.
              </div>
            ) : (
              upcomingResult.fixtures.map((f) => (
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
                    <span className="text-neutral-400">Market: BTTS Yes/No</span>
                    <span className="text-[#10B981] font-bold">
                      {f.markets?.btts?.available
                        ? `Yes: ${f.markets.btts.yesOdds?.toFixed(2) ?? '—'} / No: ${f.markets.btts.noOdds?.toFixed(2) ?? '—'}`
                        : 'Pre-match line pending'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* 3. SIGNAL FEED */}
        <section className="space-y-4 pt-6 border-t border-[#1F2937]">
          <MarketSignalsFeed
            currentMarket="btts"
            title="Both Teams To Score (BTTS)"
            description="Active signals evaluating mutual scoring probabilities against bookmaker consensus."
            signals={signals}
          />
        </section>
      </div>
    </div>
  );
}
