import React from 'react';
import Link from 'next/link';
import { TrendingUp, ArrowRight, ShieldCheck, Clock, CheckCircle2, Info, Activity } from 'lucide-react';
import { UpcomingFixturesService } from '@/lib/services/upcomingFixturesService';
import { MarketIntelligenceService } from '@/lib/services/marketIntelligenceService';
import { getMarketSignals } from '@/lib/marketSignals';
import { MarketSignalsFeed } from '@/components/terminal/MarketSignalsFeed';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Over / Under Intelligence — HandicapLab',
  description:
    'Real upcoming fixtures, goal distributions, and empirical market tendencies for Over/Under football totals.',
};

export default async function OverUnderRoutePage() {
  const [signals, upcomingResult, marketSummary] = await Promise.all([
    getMarketSignals('over-under').catch(() => []),
    UpcomingFixturesService.getUpcomingFixtures({ daysAhead: 3, limit: 6 }).catch(() => ({
      fixtures: [],
      generatedAt: new Date().toISOString(),
      source: 'api-football' as const,
      coverage: { leagues: 0, fixtures: 0 },
    })),
    Promise.resolve(MarketIntelligenceService.getIntelligenceSummary()),
  ]);

  const { highScoringLeagues, baselineOver25RoiPct, baselineUnder25RoiPct } = marketSummary.overUnder;

  return (
    <div className="flex flex-col min-h-screen bg-[#0B0F0E] text-[#F0FDF4]">
      {/* Top Header */}
      <div className="border-b border-[#1F2937] bg-[#0E1413] pt-28 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#111827] border border-[#1F2937] text-xs font-mono text-[#10B981] mb-3">
            <TrendingUp className="h-3.5 w-3.5" />
            GOAL TOTALS &bull; EXPECTANCY MODELS
          </div>
          <h1 className="text-3xl sm:text-5xl font-display font-black text-white tracking-tight">
            Over / Under Intelligence
          </h1>
          <p className="text-sm text-[#9CA3AF] mt-2 max-w-2xl leading-relaxed">
            Quantitative analysis of total match goals. Evaluating pacing divergence between bivariate Poisson models and market lines.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-4 text-xs font-mono">
            <span className="px-3 py-1.5 rounded-lg bg-[#111827] border border-[#1F2937] text-neutral-300">
              Evaluated Totals: <strong className="text-white">Quarter &amp; Half Totals (0.5 to 4.5)</strong>
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-[#111827] border border-[#1F2937] text-neutral-300">
              Over 2.5 Baseline Vig: <strong className="text-neutral-400">{baselineOver25RoiPct}%</strong>
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-[#111827] border border-[#1F2937] text-neutral-300">
              Scoring Regime: <strong className="text-[#10B981]">Bivariate Goal Distribution</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16 w-full">
        {/* 1. LEAGUE GOAL TENDENCY CLUSTERS */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-[#10B981]">
                Empirical Distribution
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-display text-white mt-0.5">
                League Scoring Tendencies
              </h2>
            </div>
            <span className="text-xs font-mono text-[#9CA3AF]">
              Evaluated across completed 2024–2026 fixture records
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
            {highScoringLeagues.map((lg) => (
              <div key={lg.league} className="p-4 rounded-xl bg-[#111827]/70 border border-[#1F2937]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white text-sm">{lg.league}</span>
                  <span className="text-[#10B981] font-bold text-[11px]">HIGH OVER</span>
                </div>
                <div className="space-y-1 text-[#9CA3AF]">
                  <div className="flex items-center justify-between">
                    <span>Average Goals:</span>
                    <strong className="text-white">{lg.avgGoals} / match</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>BTTS Frequency:</span>
                    <strong className="text-[#10B981]">{lg.bttsRatePct}%</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-[#111827]/40 border border-[#1F2937] text-xs font-mono text-[#9CA3AF] flex items-start gap-2.5">
            <Info className="h-4 w-4 text-[#10B981] flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Global football totals are highly polarized: German Bundesliga and Swiss Super League average over 3.15 goals per match, while Argentine Primera Division averages under 2.00 goals per match with a 60.5% Under 2.5 rate. Edge detection requires adjusting baseline Poisson rates per league cluster.
            </p>
          </div>
        </section>

        {/* 2. UPCOMING OVER/UNDER FIXTURES */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-[#10B981]">
                Target Matches
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-display text-white mt-0.5">
                Upcoming Over / Under Fixtures
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
                No upcoming Over / Under fixtures discovered for this target horizon. Next scheduled matchday will appear automatically.
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
                    <span className="text-neutral-400">Total Line: 2.5</span>
                    <span className="text-[#10B981] font-bold">
                      {f.markets?.overUnder?.available
                        ? `Over: ${f.markets.overUnder.overOdds?.toFixed(2) ?? '—'} / Under: ${f.markets.overUnder.underOdds?.toFixed(2) ?? '—'}`
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
            currentMarket="over-under"
            title="Over / Under"
            description="Active totals divergence signals comparing bivariate expected goals distributions against closing market lines."
            signals={signals}
          />
        </section>
      </div>
    </div>
  );
}
