import React from 'react';
import Link from 'next/link';
import { Database, Globe, Layers, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import type { HistoricalCoverageSummary } from '@/lib/services/historicalDataService';

interface HistoricalDataSectionProps {
  summary: HistoricalCoverageSummary;
}

export function HistoricalDataSection({ summary }: HistoricalDataSectionProps) {
  const fmt = (n: number) => n.toLocaleString('en-US');

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 border-y border-[#1F2937]/70 bg-[#0E1413]">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#111827] border border-[#1F2937] text-xs font-mono text-[#10B981] mb-2">
              <span className="h-2 w-2 rounded-full bg-[#10B981]" />
              FOUNDATIONAL DATASET &bull; AUDITED GOLD LAYER
            </div>
            <h2 className="text-2xl sm:text-4xl font-display font-black text-white tracking-tight">
              Historical Football Data
            </h2>
            <p className="text-sm text-[#9CA3AF] mt-1 max-w-xl">
              Verified multi-season football dataset powering our market models and Closing Line Value (CLV) evaluation.
            </p>
          </div>

          <Link
            href="/historical"
            className="text-xs font-mono text-[#10B981] hover:underline flex items-center gap-1.5 self-start md:self-auto font-bold"
          >
            <span>Explore Full Dataset & Database</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Aggregate KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
          <div className="p-5 sm:p-6 rounded-2xl bg-[#111827] border border-[#1F2937]">
            <div className="text-2xl sm:text-4xl font-mono font-bold text-white tabular-nums">
              {fmt(summary.completedMatches)}
            </div>
            <div className="text-[11px] font-mono uppercase tracking-widest text-[#9CA3AF] mt-1">
              Completed Matches
            </div>
            <div className="text-[10px] text-[#6B7280] font-mono mt-2">
              Full scores & timestamps
            </div>
          </div>

          <div className="p-5 sm:p-6 rounded-2xl bg-[#111827] border border-[#1F2937]">
            <div className="text-2xl sm:text-4xl font-mono font-bold text-[#10B981] tabular-nums">
              {summary.leaguesCount}
            </div>
            <div className="text-[11px] font-mono uppercase tracking-widest text-[#9CA3AF] mt-1">
              Target Leagues
            </div>
            <div className="text-[10px] text-[#6B7280] font-mono mt-2">
              Europe, Americas & Asia
            </div>
          </div>

          <div className="p-5 sm:p-6 rounded-2xl bg-[#111827] border border-[#1F2937]">
            <div className="text-2xl sm:text-4xl font-mono font-bold text-white tabular-nums">
              {fmt(summary.pinnacleOddsRecords)}
            </div>
            <div className="text-[11px] font-mono uppercase tracking-widest text-[#9CA3AF] mt-1">
              Pinnacle Odds Records
            </div>
            <div className="text-[10px] text-[#6B7280] font-mono mt-2">
              100% closing price benchmark
            </div>
          </div>

          <div className="p-5 sm:p-6 rounded-2xl bg-[#111827] border border-[#1F2937]">
            <div className="text-2xl sm:text-4xl font-mono font-bold text-[#10B981] tabular-nums">
              {summary.seasonWindow.start}&ndash;{summary.seasonWindow.end}
            </div>
            <div className="text-[11px] font-mono uppercase tracking-widest text-[#9CA3AF] mt-1">
              Historical Seasons
            </div>
            <div className="text-[10px] text-[#6B7280] font-mono mt-2">
              Walk-forward validation slice
            </div>
          </div>
        </div>

        {/* Regional & Market Breakdown Pill Bar */}
        <div className="p-5 rounded-2xl bg-[#111827]/60 border border-[#1F2937] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-neutral-400">Regional Distribution:</span>
            <span className="px-2.5 py-1 rounded bg-[#0B0F0E] border border-[#1F2937] text-white">
              Europe: <strong className="text-[#10B981]">{fmt(summary.regionalBreakdown.europe.matches)}</strong>
            </span>
            <span className="px-2.5 py-1 rounded bg-[#0B0F0E] border border-[#1F2937] text-white">
              Americas: <strong className="text-[#10B981]">{fmt(summary.regionalBreakdown.americas.matches)}</strong>
            </span>
            <span className="px-2.5 py-1 rounded bg-[#0B0F0E] border border-[#1F2937] text-white">
              Asia/Oceania: <strong className="text-[#10B981]">{fmt(summary.regionalBreakdown.asia.matches)}</strong>
            </span>
          </div>

          <Link
            href="/historical"
            className="text-[#10B981] hover:underline flex items-center gap-1 font-bold whitespace-nowrap self-start sm:self-auto"
          >
            Launch Historical Explorer &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}
