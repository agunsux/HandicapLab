import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Target, ShieldCheck, Database } from 'lucide-react';
import { AhHistoryService } from '@/lib/services/ahHistoryService';
import { AhHistoricalExplorer } from '@/components/ah/AhHistoricalExplorer';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Historical Asian Handicap Explorer — HandicapLab / Salmo',
  description:
    'Full historical Asian Handicap ledger and empirical performance explorer. Filter by league, season, handicap line, side, and bookmaker odds.',
};

export default async function HistoricalAhExplorerPage() {
  const [initialHistorical, availableFilters] = await Promise.all([
    Promise.resolve(
      AhHistoryService.queryObservations({
        league: 'ENG-PL',
        limit: 25,
        offset: 0,
      })
    ),
    Promise.resolve(AhHistoryService.getAvailableFilters()),
  ]);

  return (
    <div className="flex flex-col min-h-screen bg-[#0B0F0E] text-[#F0FDF4]">
      {/* Top Header */}
      <div className="border-b border-[#1F2937] bg-[#0E1413] pt-28 pb-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Link
            href="/asian-handicap"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-neutral-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Asian Handicap Hub</span>
          </Link>

          <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-[#111827] border border-[#1F2937] text-xs font-mono text-[#10B981] mb-2 w-fit">
            <Database className="h-3.5 w-3.5" />
            HISTORICAL RESEARCH &bull; SETTLEMENT LEDGER
          </div>

          <h1 className="text-3xl sm:text-5xl font-display font-black text-white tracking-tight">
            Historical AH Explorer
          </h1>
          <p className="text-sm text-[#9CA3AF] mt-2 max-w-3xl leading-relaxed">
            Multi-season empirical ledger of European football Asian Handicap lines. Every bet settles through the validated 5-outcome accounting engine with exact P&amp;L accounting and zero lookahead leakage.
          </p>
        </div>
      </div>

      {/* Explorer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <AhHistoricalExplorer
          initialResult={initialHistorical}
          availableFilters={availableFilters}
        />
      </div>
    </div>
  );
}
