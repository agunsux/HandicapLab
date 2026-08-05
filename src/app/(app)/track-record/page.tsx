'use client';

import React from 'react';
import { CheckCircle2, ShieldCheck, TrendingUp, Sparkles } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { DataTable, Column } from '@/components/ui/DataTable';

export default function TrackRecordPage() {
  const ledgerSummary = [
    { market: 'Moneyline (1X2)', bets: 3630, wins: 757, losses: 2873, winRate: '20.9%', stake: '3,630 units', profit: '-166.18 units', roi: '-4.58%', clv: '-0.11%' },
    { market: 'Asian Handicap', bets: 906, wins: 393, losses: 388, winRate: '50.3%', stake: '781 units', profit: '-16.11 units', roi: '-2.06%', clv: '+0.15%' },
    { market: 'Over / Under 2.5', bets: 1703, wins: 692, losses: 1011, winRate: '40.6%', stake: '1,703 units', profit: '-60.31 units', roi: '-3.54%', clv: '-0.10%' },
    { market: 'OVERALL COMBINED', bets: 6239, wins: 1842, losses: 4272, winRate: '30.1%', stake: '6,114 units', profit: '-242.60 units', roi: '-3.97%', clv: '-0.07%' },
  ];

  const columns: Column<typeof ledgerSummary[0]>[] = [
    { key: 'market', header: 'Market', render: (r) => <span className="font-bold text-[#F0FDF4]">{r.market}</span> },
    { key: 'bets', header: 'Placed Bets', isNumeric: true },
    { key: 'winRate', header: 'Win Rate %', isNumeric: true, render: (r) => <span className="font-mono text-[#10B981] font-bold">{r.winRate}</span> },
    { key: 'stake', header: 'Stake Risk', isNumeric: true },
    { key: 'profit', header: 'Net Profit', isNumeric: true, render: (r) => <span className="font-mono text-[#EF4444] font-bold">{r.profit}</span> },
    { key: 'roi', header: 'Exact ROI %', isNumeric: true, render: (r) => <span className="font-mono text-[#EF4444] font-bold">{r.roi}</span> },
    { key: 'clv', header: 'Pinnacle CLV %', isNumeric: true, render: (r) => <span className="font-mono text-[#10B981] font-bold">{r.clv}</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="p-5 bg-[#111827] border border-[#1F2937] rounded-xl flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-[#10B981]" />
            <h1 className="text-xl font-bold text-[#F0FDF4]">Model Track Record & Public Audit Ledger</h1>
          </div>
          <p className="text-xs text-[#9CA3AF] mt-1 font-sans">
            Audited historical performance of HandicapLab's baseline quantitative models across 6,239 bets (2018-2025).
          </p>
        </div>
        <span className="px-2.5 py-1 text-xs font-mono font-bold bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30 rounded-full uppercase">
          Per-Bet Verified
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Placed Bets" value="6,239 Bets" subtitle="Across 2,660 Fixtures" icon={CheckCircle2} />
        <StatCard title="Total Risk Stake" value="6,114 Units" subtitle="1.0 Unit Per Bet" icon={TrendingUp} />
        <StatCard title="Overall Exact ROI" value="-3.97%" subtitle="Audited Settlement Payouts" change="-3.97%" changeType="negative" icon={Sparkles} />
        <StatCard title="Overall Pinnacle CLV" value="-0.07%" subtitle="Closing Line Invariant" change="-0.07%" changeType="neutral" icon={ShieldCheck} />
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-mono uppercase tracking-widest text-[#9CA3AF] font-semibold">
          Market-by-Market Settlement Breakdown Table
        </h3>
        <DataTable columns={columns} data={ledgerSummary} keyExtractor={(r) => r.market} />
      </div>
    </div>
  );
}
