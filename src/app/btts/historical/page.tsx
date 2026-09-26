import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Database, ShieldCheck, Clock } from 'lucide-react';
import { BttsHistoryService } from '@/lib/services/bttsHistoryService';
import { BttsHistoricalExplorer } from '@/components/btts/BttsHistoricalExplorer';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'BTTS Historical Odds Explorer (2026) — HandicapLab',
  description:
    'Verified historical Both Teams To Score (BTTS) odds dataset from Pinnacle. Ground truth opening and closing odds with zero lookahead leakage.',
};

export default async function BttsHistoricalPage() {
  const records = BttsHistoryService.getRecords();
  const summary = BttsHistoryService.getSummary();

  return (
    <div className="flex flex-col min-h-screen bg-[#0B0F0E] text-[#F0FDF4]">
      {/* Top Header */}
      <div className="border-b border-[#1F2937] bg-[#0E1413] pt-28 pb-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Link
            href="/btts"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-neutral-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to BTTS Hub</span>
          </Link>

          <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-[#111827] border border-[#1F2937] text-xs font-mono text-[#10B981] mb-2 w-fit">
            <Database className="h-3.5 w-3.5" />
            HISTORICAL RESEARCH &bull; PINNACLE GROUND TRUTH
          </div>

          <h1 className="text-3xl sm:text-5xl font-display font-black text-white tracking-tight">
            BTTS Historical Odds — 2026
          </h1>
          <p className="text-sm text-[#9CA3AF] mt-2 max-w-3xl leading-relaxed">
            Empirical ledger of real Pinnacle Both Teams To Score (BTTS) historical odds. Every record preserves verified opening and closing timestamps, strictly filtered prior to kickoff to eliminate lookahead leakage.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <BttsHistoricalExplorer
          initialRecords={records}
          summary={summary}
        />
      </div>
    </div>
  );
}
