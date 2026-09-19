import React from 'react';
import Link from 'next/link';
import { ArrowRight, BarChart3, Database, Globe, Layers, ExternalLink } from 'lucide-react';
import { UpcomingFixturesService } from '@/lib/services/upcomingFixturesService';
import { HistoricalDataService } from '@/lib/services/historicalDataService';
import { MarketIntelligenceService } from '@/lib/services/marketIntelligenceService';
import { getTerminalPredictions } from '@/lib/terminalData';
import { UpcomingFixturesSection } from '@/components/home/UpcomingFixturesSection';
import { MarketIntelligenceSection } from '@/components/home/MarketIntelligenceSection';
import { HistoricalDataSection } from '@/components/home/HistoricalDataSection';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'HandicapLab — Football Data & Statistics | Asian Handicap, Over/Under, BTTS',
  description:
    'Explore football data, team statistics, league trends, and market analytics. Asian Handicap records, Over/Under trends, and BTTS statistics across global leagues.',
};

export default async function HomePage() {
  // Fetch real data server-side in parallel with graceful fallbacks
  const [upcomingData, historicalSummary, marketSummary, predictions] = await Promise.all([
    UpcomingFixturesService.getUpcomingFixtures({ daysAhead: 7, limit: 12 }).catch((err) => {
      console.error('[HomePage] Upcoming fixtures fetch error:', err);
      return { fixtures: [], totalMatchesAvailable: 0, generatedAt: new Date().toISOString(), source: 'api-football' as const, dataState: 'DATA_UNAVAILABLE' as const, coverage: { leagues: 0, fixtures: 0 } };
    }),
    Promise.resolve(HistoricalDataService.getHistoricalSummary()),
    Promise.resolve(MarketIntelligenceService.getIntelligenceSummary()),
    Promise.resolve(getTerminalPredictions()).catch(() => []),
  ]);

  const settled = predictions.filter((p) => p.settlement_status === 'SETTLED');
  const settledPreview = settled.slice(0, 5);

  return (
    <div className="flex flex-col min-h-screen bg-[#0B1120] font-sans text-[#F0F4F8]">
      {/* SECTION 1 — HERO */}
      <section className="relative pt-28 pb-20 px-4 sm:px-6 lg:px-8 border-b border-[#1E293B]/70">
        <div className="max-w-5xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#131B2E] border border-[#1E293B] text-xs font-mono text-[#94A3B8]">
            <span className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
            {historicalSummary.leaguesCount ?? '—'} LEAGUES &bull; {historicalSummary.completedMatches?.toLocaleString() ?? '—'} MATCHES &bull; VERIFIED DATA
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-display font-black text-white tracking-tight leading-[1.08]">
            Football Data &amp;<br />
            <span className="text-[#3B82F6]">Statistics.</span>
          </h1>

          <p className="text-base sm:text-xl text-[#94A3B8] max-w-3xl mx-auto leading-relaxed">
            Explore match data, team performance, league trends, and market statistics across Asian Handicap, Over/Under, and BTTS. Verified sources. Transparent methodology.
          </p>

          {/* Core Dataset Fact Ribbon */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-[#94A3B8]">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#131B2E] border border-[#1E293B]">
              <Database className="h-3.5 w-3.5 text-[#3B82F6]" />
              <strong>{historicalSummary.completedMatches?.toLocaleString() ?? '—'}</strong> Matches
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#131B2E] border border-[#1E293B]">
              <Globe className="h-3.5 w-3.5 text-[#3B82F6]" />
              <strong>{historicalSummary.leaguesCount ?? '—'}</strong> Leagues
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#131B2E] border border-[#1E293B]">
              <Layers className="h-3.5 w-3.5 text-[#3B82F6]" />
              <strong>{historicalSummary.pinnacleOddsRecords?.toLocaleString() ?? '—'}</strong> Odds Records
            </span>
          </div>

          {/* Primary & Secondary CTAs */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Link
              href="/competitions"
              className="w-full sm:w-auto px-8 py-3.5 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white font-display font-bold text-sm transition-all shadow-lg hover:shadow-[#3B82F6]/20 flex items-center justify-center gap-2"
            >
              Explore Football Data <ArrowRight className="h-4 w-4" />
            </Link>

            <a
              href="#upcoming-matches"
              className="w-full sm:w-auto px-8 py-3.5 rounded-lg bg-[#131B2E] hover:bg-[#1E293B] border border-[#1E293B] text-white font-medium text-sm transition-all flex items-center justify-center gap-2"
            >
              Explore Matches
            </a>
          </div>

          {/* Contextual product pathways — intentionally secondary, no clutter */}
          <div className="pt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-[#94A3B8]">
            <Link href="/historical" className="hover:text-[#F0F4F8] transition-colors">
              Historical Data
            </Link>
            <Link href="/track-record" className="hover:text-[#F0F4F8] transition-colors">
              Track Record
            </Link>
            <Link href="/models" className="hover:text-[#F0F4F8] transition-colors">
              Model Registry
            </Link>
            <Link href="/pricing" className="hover:text-[#F0F4F8] transition-colors">
              Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 2 — UPCOMING FIXTURES */}
      <UpcomingFixturesSection
        initialFixtures={upcomingData.fixtures}
        totalAvailable={upcomingData.totalMatchesAvailable || upcomingData.fixtures.length}
        dataState={upcomingData.dataState}
      />

      {/* SECTION 3 — MARKET STATISTICS (AH, OU, BTTS) */}
      <MarketIntelligenceSection summary={marketSummary} />

      {/* SECTION 4 — HISTORICAL FOOTBALL DATA */}
      <HistoricalDataSection summary={historicalSummary} />

      {/* SECTION 5 — HOW HANDICAPLAB WORKS */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-[#1E293B]/70 bg-[#0D1525]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14 space-y-2">
            <span className="text-xs font-mono uppercase tracking-widest text-[#3B82F6]">Methodology</span>
            <h2 className="text-2xl sm:text-4xl font-display font-bold text-white">
              How HandicapLab Works
            </h2>
            <p className="text-sm text-[#94A3B8] max-w-xl mx-auto">
              Three systematic stages from global data collection to verified statistical intelligence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-[#131B2E]/60 border border-[#1E293B]">
              <div className="text-3xl font-mono font-bold text-[#3B82F6] mb-3">01</div>
              <h3 className="text-base font-bold text-white mb-2">Global Data Coverage</h3>
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                We track football fixtures, results, and statistics across leagues worldwide. Every data point is sourced from verified providers with full provenance tracking.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#131B2E]/60 border border-[#1E293B]">
              <div className="text-3xl font-mono font-bold text-[#3B82F6] mb-3">02</div>
              <h3 className="text-base font-bold text-white mb-2">Statistical Intelligence</h3>
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                Historical distributions, team form analysis, and market statistics across Asian Handicap, Over/Under, and BTTS. Every metric is computed from empirical data.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#131B2E]/60 border border-[#1E293B]">
              <div className="text-3xl font-mono font-bold text-[#3B82F6] mb-3">03</div>
              <h3 className="text-base font-bold text-white mb-2">Research Infrastructure</h3>
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                Transparent methodology, audited data pipelines, and API access for researchers. All statistics include sample sizes and verification timestamps.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6 — REAL TRACK RECORD PREVIEW */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-[#3B82F6]">
              Verified Results
            </span>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mt-1">
              Track Record
            </h2>
            <p className="text-xs text-[#94A3B8] mt-1">
              Audited out-of-sample settlements. Zero synthetic or fabricated data.
            </p>
          </div>

          <Link
            href="/track-record"
            className="text-xs font-mono text-[#3B82F6] hover:underline flex items-center gap-1.5 self-start sm:self-auto"
          >
            View Full Track Record ({settled.length} settled) <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {settledPreview.length === 0 ? (
          <div className="rounded-2xl border border-[#1E293B] bg-[#131B2E]/50 p-12 text-center">
            <BarChart3 className="h-10 w-10 text-[#94A3B8]/40 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-white font-mono">Track record is building.</h3>
            <p className="text-xs text-[#94A3B8] mt-1 max-w-md mx-auto">
              Settlement data will appear here as verified results become available. All outcomes are recorded with full provenance.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-[#1E293B] bg-[#131B2E]/60 overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#1E293B] text-[#94A3B8]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Match</th>
                  <th className="py-3 px-4">Market</th>
                  <th className="py-3 px-4">Pick</th>
                  <th className="py-3 px-4">Odds</th>
                  <th className="py-3 px-4">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {settledPreview.map((item) => (
                  <tr key={item.id} className="hover:bg-[#131B2E]/80">
                    <td className="py-3 px-4 text-[#94A3B8] whitespace-nowrap">
                      {item.kickoff_at.slice(0, 10)}
                    </td>
                    <td className="py-3 px-4 font-bold text-white whitespace-nowrap">
                      {item.home_team} vs {item.away_team}
                    </td>
                    <td className="py-3 px-4 text-[#CBD5E1]">{item.market}</td>
                    <td className="py-3 px-4 text-[#3B82F6] capitalize">
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

      {/* SECTION 7 — DATA PLATFORM CTA + SALMO CROSS-PROMOTION */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-[#1E293B]/70">
        <div className="max-w-4xl mx-auto text-center p-10 sm:p-14 rounded-3xl bg-[#131B2E] border border-[#1E293B] space-y-6">
          <h2 className="text-3xl sm:text-5xl font-display font-black text-white tracking-tight">
            Football intelligence<br />you can trust.
          </h2>

          <p className="text-sm text-[#94A3B8] max-w-xl mx-auto">
            Explore verified match statistics, historical trends, and league analytics. Every data point is sourced, timestamped, and auditable.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/competitions"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white font-display font-bold text-sm transition-all shadow-lg hover:shadow-[#3B82F6]/20"
            >
              Explore Leagues <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/methodology"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-lg bg-[#1E293B]/50 hover:bg-[#1E293B] border border-[#334155] text-white font-medium text-sm transition-all"
            >
              View Methodology
            </Link>
          </div>

          {/* Subtle Salmo.dev cross-promotion */}
          <div className="pt-6 border-t border-[#1E293B]/50">
            <p className="text-xs text-[#64748B]">
              Want market intelligence and betting opportunities?
            </p>
            <a
              href="https://salmo.dev"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#94A3B8] hover:text-[#3B82F6] transition-colors mt-1"
            >
              Explore Salmo.dev <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </section>

      {/* Footer is rendered by MarketingFooter in layout.tsx — no inline footer needed */}
    </div>
  );
}
