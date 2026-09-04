import React from 'react';
import Link from 'next/link';
import { ArrowRight, BarChart3, ShieldCheck, Database, Target, TrendingUp, CheckCircle2 } from 'lucide-react';
import { UpcomingFixturesService } from '@/lib/services/upcomingFixturesService';
import { HistoricalDataService } from '@/lib/services/historicalDataService';
import { MarketIntelligenceService } from '@/lib/services/marketIntelligenceService';
import { getTerminalPredictions } from '@/lib/terminalData';
import { UpcomingFixturesSection } from '@/components/home/UpcomingFixturesSection';
import { MarketIntelligenceSection } from '@/components/home/MarketIntelligenceSection';
import { HistoricalDataSection } from '@/components/home/HistoricalDataSection';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'HandicapLab — Football Market Intelligence for Asian Handicap, Over/Under & BTTS',
  description:
    'Real football data, historical walk-forward market analysis, and Pinnacle closing line benchmarks across Asian Handicap, Over/Under, and Both Teams To Score.',
};

export default async function HomePage() {
  // Fetch real data server-side in parallel with graceful fallbacks
  const [upcomingData, historicalSummary, marketSummary, predictions] = await Promise.all([
    UpcomingFixturesService.getUpcomingFixtures({ daysAhead: 1, limit: 12 }).catch((err) => {
      console.error('[HomePage] Upcoming fixtures fetch error:', err);
      return { fixtures: [], totalMatchesAvailable: 0, generatedAt: new Date().toISOString(), source: 'api-football' as const, coverage: { leagues: 0, fixtures: 0 } };
    }),
    Promise.resolve(HistoricalDataService.getHistoricalSummary()),
    Promise.resolve(MarketIntelligenceService.getIntelligenceSummary()),
    Promise.resolve(getTerminalPredictions()).catch(() => []),
  ]);

  const settled = predictions.filter((p) => p.settlement_status === 'SETTLED');
  const settledPreview = settled.slice(0, 5);

  return (
    <div className="flex flex-col min-h-screen bg-[#0B0F0E] font-sans text-[#F0FDF4]">
      {/* SECTION 1 — HERO */}
      <section className="relative pt-28 pb-20 px-4 sm:px-6 lg:px-8 border-b border-[#1F2937]/70">
        <div className="max-w-5xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111827] border border-[#1F2937] text-xs font-mono text-[#10B981]">
            <span className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
            30 GLOBAL LEAGUES &bull; 17,738 MATCHES &bull; PINNACLE CLOSING BENCHMARKS
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-display font-black text-white tracking-tight leading-[1.08]">
            Football Market Intelligence.<br />
            <span className="text-[#10B981]">Built Around Asian Handicap, Over/Under &amp; BTTS.</span>
          </h1>

          <p className="text-base sm:text-xl text-[#9CA3AF] max-w-3xl mx-auto leading-relaxed">
            We analyze real football fixtures using empirical historical distributions, bivariate goal expectancy models, and closing line value (CLV) evaluation. No tipster picks. No black-box hype.
          </p>

          {/* Core Dataset Fact Ribbon */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-neutral-300">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#111827] border border-[#1F2937]">
              <Database className="h-3.5 w-3.5 text-[#10B981]" />
              <strong>17,738</strong> Completed Matches
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#111827] border border-[#1F2937]">
              <Target className="h-3.5 w-3.5 text-[#10B981]" />
              <strong>110,394</strong> Pinnacle Odds
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#111827] border border-[#1F2937]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#10B981]" />
              <strong>0</strong> Synthetic Data
            </span>
          </div>

          {/* Primary & Secondary CTAs */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <a
              href="#upcoming-matches"
              className="w-full sm:w-auto px-8 py-3.5 rounded-lg bg-[#10B981] hover:bg-[#10B981]/90 text-black font-display font-bold text-sm transition-all shadow-lg hover:shadow-[#10B981]/20 flex items-center justify-center gap-2"
            >
              Explore Today&apos;s Matches <ArrowRight className="h-4 w-4" />
            </a>

            <Link
              href="/historical"
              className="w-full sm:w-auto px-8 py-3.5 rounded-lg bg-[#111827] hover:bg-[#1A2436] border border-[#1F2937] text-white font-mono text-sm transition-all flex items-center justify-center gap-2"
            >
              <Database className="h-4 w-4 text-[#9CA3AF]" />
              Explore Historical Data
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 2 — UPCOMING FIXTURES */}
      <UpcomingFixturesSection
        initialFixtures={upcomingData.fixtures}
        totalAvailable={upcomingData.totalMatchesAvailable || upcomingData.fixtures.length}
      />

      {/* SECTION 3 — MARKET INTELLIGENCE (AH, OU, BTTS) */}
      <MarketIntelligenceSection summary={marketSummary} />

      {/* SECTION 4 — HISTORICAL FOOTBALL DATA */}
      <HistoricalDataSection summary={historicalSummary} />

      {/* SECTION 5 — HOW HANDICAPLAB WORKS */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-[#1F2937]/70 bg-[#0E1413]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14 space-y-2">
            <span className="text-xs font-mono uppercase tracking-widest text-[#10B981]">Methodology</span>
            <h2 className="text-2xl sm:text-4xl font-display font-bold text-white">
              How HandicapLab Works
            </h2>
            <p className="text-sm text-[#9CA3AF] max-w-xl mx-auto">
              Three systematic stages from global data ingestion to audited post-match CLV settlement.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-[#111827]/60 border border-[#1F2937]">
              <div className="text-3xl font-mono font-bold text-[#10B981] mb-3">01</div>
              <h3 className="text-base font-bold text-white mb-2">Target Market Selection</h3>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                We restrict analysis to high-liquidity football markets: Asian Handicap, Over/Under totals, and Both Teams To Score.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#111827]/60 border border-[#1F2937]">
              <div className="text-3xl font-mono font-bold text-[#10B981] mb-3">02</div>
              <h3 className="text-base font-bold text-white mb-2">Empirical Edge Detection</h3>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                We compare market prices against historical distributions and bivariate Poisson models, validating statistically whether an asymmetry exists ($p &lt; 0.05$).
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#111827]/60 border border-[#1F2937]">
              <div className="text-3xl font-mono font-bold text-[#10B981] mb-3">03</div>
              <h3 className="text-base font-bold text-white mb-2">Pinnacle CLV Benchmark</h3>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                Every settlement is benchmarked against the Pinnacle closing line. We prioritize Closing Line Value (CLV) over short-term luck.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6 — REAL TRACK RECORD PREVIEW */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-[#10B981]">
              Transparency First
            </span>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mt-1">
              Real Track Record
            </h2>
            <p className="text-xs text-[#9CA3AF] mt-1">
              Audited out-of-sample settlements. Zero synthetic or fabricated bets.
            </p>
          </div>

          <Link
            href="/track-record"
            className="text-xs font-mono text-[#10B981] hover:underline flex items-center gap-1.5 self-start sm:self-auto"
          >
            View Full Track Record ({settled.length} settled) <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {settledPreview.length === 0 ? (
          <div className="rounded-2xl border border-[#1F2937] bg-[#111827]/50 p-12 text-center">
            <BarChart3 className="h-10 w-10 text-[#9CA3AF]/40 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-white font-mono">Track record is building.</h3>
            <p className="text-xs text-[#9CA3AF] mt-1 max-w-md mx-auto">
              No live picks are currently active under our strict data isolation gate. When approved candidate models promote picks, every settlement will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-[#1F2937] bg-[#111827]/60 overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#1F2937] text-[#9CA3AF]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Match</th>
                  <th className="py-3 px-4">Market</th>
                  <th className="py-3 px-4">Pick</th>
                  <th className="py-3 px-4">Odds</th>
                  <th className="py-3 px-4">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2937]">
                {settledPreview.map((item) => (
                  <tr key={item.id} className="hover:bg-[#111827]/80">
                    <td className="py-3 px-4 text-[#9CA3AF] whitespace-nowrap">
                      {item.kickoff_at.slice(0, 10)}
                    </td>
                    <td className="py-3 px-4 font-bold text-white whitespace-nowrap">
                      {item.home_team} vs {item.away_team}
                    </td>
                    <td className="py-3 px-4 text-neutral-300">{item.market}</td>
                    <td className="py-3 px-4 text-[#10B981] capitalize">
                      {item.side} {item.line}
                    </td>
                    <td className="py-3 px-4 text-white font-bold">{item.taken_odds.toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          (item.profit_loss || 0) > 0
                            ? 'bg-[#10B981]/15 text-[#10B981]'
                            : (item.profit_loss || 0) < 0
                            ? 'bg-red-500/15 text-red-400'
                            : 'bg-neutral-800 text-neutral-400'
                        }`}
                      >
                        {item.actual_outcome || (item.profit_loss || 0) > 0 ? 'WIN' : 'LOSS'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* SECTION 7 — COMMITMENT & ACCESS CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-[#1F2937]/70">
        <div className="max-w-4xl mx-auto text-center p-10 sm:p-14 rounded-3xl bg-[#111827] border border-[#1F2937] space-y-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#10B981]/10 text-[#10B981] text-xs font-mono">
            <ShieldCheck className="h-4 w-4" /> QUANTITATIVE ACCESS
          </div>

          <h2 className="text-3xl sm:text-5xl font-display font-black text-white tracking-tight">
            DATA FIRST. MARKET FIRST. MODEL SECOND.
          </h2>

          <p className="text-sm text-[#9CA3AF] max-w-xl mx-auto">
            Explore our verified historical datasets, inspect real model calibration curves, and evaluate closing line value performance across 30 global football leagues.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/pricing"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-lg bg-[#10B981] hover:bg-[#10B981]/90 text-black font-display font-bold text-sm transition-all shadow-lg hover:shadow-[#10B981]/20"
            >
              START FREE TRIAL <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/models"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-lg bg-[#1F2937]/50 hover:bg-[#1F2937] border border-[#374151] text-white font-mono text-sm transition-all"
            >
              View Model Registry
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 8 — FOOTER */}
      <footer className="py-10 px-4 sm:px-6 lg:px-8 border-t border-[#1F2937] bg-[#0B0F0E]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs font-mono text-[#9CA3AF]">
          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
            <span className="font-bold text-white text-sm">HandicapLab</span>
            <span className="hidden sm:inline">&bull;</span>
            <span>Football Market Intelligence for Asian Handicap, Over/Under &amp; BTTS.</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6">
            <Link href="/asian-handicap" className="hover:text-white transition-colors">
              Asian Handicap
            </Link>
            <Link href="/over-under" className="hover:text-white transition-colors">
              Over / Under
            </Link>
            <Link href="/btts" className="hover:text-white transition-colors">
              BTTS
            </Link>
            <Link href="/historical" className="hover:text-white transition-colors">
              Historical
            </Link>
            <Link href="/models" className="hover:text-white transition-colors">
              Models
            </Link>
            <Link href="/track-record" className="hover:text-white transition-colors">
              Track Record
            </Link>
            <Link href="/pricing" className="hover:text-white transition-colors">
              Pricing
            </Link>
          </div>

          <div className="text-[11px] text-[#6B7280]">
            &copy; {new Date().getFullYear()} HandicapLab. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
