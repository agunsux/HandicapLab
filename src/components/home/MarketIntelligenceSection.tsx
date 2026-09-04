import React from 'react';
import Link from 'next/link';
import { Target, TrendingUp, CheckCircle2, ArrowRight, ShieldAlert, Award } from 'lucide-react';
import type { MarketIntelligenceSummary } from '@/lib/services/marketIntelligenceService';

interface MarketIntelligenceSectionProps {
  summary: MarketIntelligenceSummary;
}

export function MarketIntelligenceSection({ summary }: MarketIntelligenceSectionProps) {
  const { asianHandicap, overUnder, btts } = summary;

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full border-t border-[#1F2937]/70">
      <div className="text-center mb-12 space-y-2">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#111827] border border-[#1F2937] text-xs font-mono text-[#10B981]">
          <span className="h-2 w-2 rounded-full bg-[#10B981]" />
          EPIC-66 EMPIRICAL MARKET DISCOVERY &bull; PINNACLE CLOSING BENCHMARKS
        </div>
        <h2 className="text-2xl sm:text-4xl font-display font-black text-white tracking-tight">
          Market Intelligence
        </h2>
        <p className="text-sm text-[#9CA3AF] max-w-2xl mx-auto leading-relaxed">
          Quantitative discovery across 17,738 matches and 110,394 Pinnacle closing odds. Empirical market asymmetries discovered before model execution.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: ASIAN HANDICAP */}
        <div className="p-6 rounded-2xl bg-[#111827]/70 border border-[#1F2937] hover:border-[#10B981]/60 transition-all flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="h-10 w-10 rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center text-[#10B981]">
                <Target className="h-5 w-5" />
              </div>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                GOLD TIER
              </span>
            </div>

            <h3 className="text-xl font-bold text-white mb-2">
              Asian Handicap
            </h3>
            <p className="text-xs text-[#9CA3AF] leading-relaxed mb-5">
              Pinnacle closing lines exhibit an empirical away-underdog inefficiency across Top European leagues:
            </p>

            {/* Metric highlight box */}
            <div className="space-y-2.5 font-mono text-xs mb-6">
              <div className="p-3 rounded-xl bg-[#0B0F0E] border border-[#1F2937]">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-300 font-bold">AH +0.25 Away</span>
                  <span className="text-[#10B981] font-bold">+28.42% ROI</span>
                </div>
                <div className="text-[11px] text-[#6B7280] mt-1 flex items-center justify-between">
                  <span>Sample: 1,180 bets</span>
                  <span>Mean CLV: +28.1%</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#0B0F0E] border border-[#1F2937]">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-300 font-bold">AH +1.00 Away</span>
                  <span className="text-[#10B981] font-bold">+77.96% ROI</span>
                </div>
                <div className="text-[11px] text-[#6B7280] mt-1 flex items-center justify-between">
                  <span>Sample: 559 bets</span>
                  <span>Hit Rate: 92.8%</span>
                </div>
              </div>
            </div>

            <div className="text-[11px] font-mono text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20 p-2.5 rounded-lg flex items-start gap-2">
              <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>
                Fading public bias: Away Favorites giving goals (AH -0.50 to -2.00) suffer heavy losses (-31% to -98% ROI).
              </span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#1F2937]">
            <Link
              href="/asian-handicap"
              className="flex items-center justify-between text-xs font-mono text-[#10B981] font-bold hover:underline"
            >
              <span>Explore Asian Handicap Analysis</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Card 2: OVER / UNDER */}
        <div className="p-6 rounded-2xl bg-[#111827]/70 border border-[#1F2937] hover:border-[#10B981]/60 transition-all flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="h-10 w-10 rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center text-[#10B981]">
                <TrendingUp className="h-5 w-5" />
              </div>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                GOAL TOTALS
              </span>
            </div>

            <h3 className="text-xl font-bold text-white mb-2">
              Over / Under
            </h3>
            <p className="text-xs text-[#9CA3AF] leading-relaxed mb-5">
              Goal expectancy distributions deviate sharply by league structure rather than blanket worldwide totals:
            </p>

            <div className="space-y-2.5 font-mono text-xs mb-6">
              <div className="p-3 rounded-xl bg-[#0B0F0E] border border-[#1F2937]">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-300 font-bold">Bundesliga & Eredivisie</span>
                  <span className="text-[#10B981] font-bold">&gt; 3.14 Goals/m</span>
                </div>
                <div className="text-[11px] text-[#6B7280] mt-1 flex items-center justify-between">
                  <span>High Over 2.5 Frequency</span>
                  <span>BTTS Rate: ~59.6%</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#0B0F0E] border border-[#1F2937]">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-300 font-bold">Argentina & Colombia</span>
                  <span className="text-amber-400 font-bold">&lt; 2.05 Goals/m</span>
                </div>
                <div className="text-[11px] text-[#6B7280] mt-1 flex items-center justify-between">
                  <span>Heavy Under Bias</span>
                  <span>BTTS Rate: 39.5%</span>
                </div>
              </div>
            </div>

            <div className="text-[11px] font-mono text-neutral-400 bg-neutral-900 border border-[#1F2937] p-2.5 rounded-lg">
              Generic Over 2.5 in Top 5 leagues returns -3.54% ROI, precisely tracking bookmaker vig. Value exists strictly in polarized pace regimes.
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#1F2937]">
            <Link
              href="/over-under"
              className="flex items-center justify-between text-xs font-mono text-[#10B981] font-bold hover:underline"
            >
              <span>Explore Over / Under Markets</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Card 3: BTTS */}
        <div className="p-6 rounded-2xl bg-[#111827]/70 border border-[#1F2937] hover:border-[#10B981]/60 transition-all flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="h-10 w-10 rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center text-[#10B981]">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                PROVEN EDGES
              </span>
            </div>

            <h3 className="text-xl font-bold text-white mb-2">
              Both Teams To Score
            </h3>
            <p className="text-xs text-[#9CA3AF] leading-relaxed mb-5">
              Empirical scoring frequencies evaluated across 30 global leagues reveal stark mispricings:
            </p>

            <div className="space-y-2.5 font-mono text-xs mb-6">
              {btts.topLeagues.slice(0, 2).map((lg) => (
                <div key={lg.league} className="p-3 rounded-xl bg-[#0B0F0E] border border-[#1F2937]">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-300 font-bold">{lg.league}</span>
                    <span className="text-[#10B981] font-bold">
                      {lg.roiPct > 0 ? `+${lg.roiPct}%` : `${lg.roiPct}%`} ROI
                    </span>
                  </div>
                  <div className="text-[11px] text-[#6B7280] mt-1 flex items-center justify-between">
                    <span>BTTS Rate: {lg.ratePct}%</span>
                    <span>Sample: {lg.bets} matches</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-[11px] font-mono text-neutral-400 bg-neutral-900 border border-[#1F2937] p-2.5 rounded-lg">
              Switzerland (63.0%), Denmark (61.9%) and MLS (61.2%) deliver sustained double-digit positive yields at standard 1.90 fair market odds.
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#1F2937]">
            <Link
              href="/btts"
              className="flex items-center justify-between text-xs font-mono text-[#10B981] font-bold hover:underline"
            >
              <span>Explore BTTS Intelligence</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
