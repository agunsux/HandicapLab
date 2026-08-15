'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle2, ShieldCheck, TrendingUp, Sparkles } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { DataTable, Column } from '@/components/ui/DataTable';

interface MarketSummaryRow {
  market: string;
  bets: number;
  winRate: string;
  stake: string;
  profit: string;
  roi: string;
  clv: string;
}

export default function TrackRecordPage() {
  const [ledgerSummary, setLedgerSummary] = useState<MarketSummaryRow[]>([]);
  const [totalBets, setTotalBets] = useState<number>(0);
  const [totalStake, setTotalStake] = useState<string>('0 Units');
  const [overallRoi, setOverallRoi] = useState<string>('—');
  const [overallClv, setOverallClv] = useState<string>('—');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTrackRecord() {
      setLoading(true);
      try {
        const res = await fetch('/api/performance/markets');
        const json = await res.json();
        if (json.success && Array.isArray(json.breakdown)) {
          const breakdown = json.breakdown;
          const rows: MarketSummaryRow[] = breakdown.map((item: any) => {
            const stakeUnits = item.bets;
            const profitVal = (item.bets * (item.roi / 100));
            return {
              market: item.market,
              bets: item.bets,
              winRate: item.bets > 0 ? `${item.accuracy.toFixed(1)}%` : '—',
              stake: `${stakeUnits.toLocaleString()} units`,
              profit: item.bets > 0 ? `${profitVal >= 0 ? '+' : ''}${profitVal.toFixed(2)} units` : '0.00 units',
              roi: item.bets > 0 ? `${item.roi >= 0 ? '+' : ''}${item.roi.toFixed(2)}%` : '—',
              clv: item.bets > 0 ? `${item.clv >= 0 ? '+' : ''}${item.clv.toFixed(2)}%` : '—',
            };
          });

          const totalB = breakdown.reduce((acc: number, item: any) => acc + (item.bets || 0), 0);
          const totalProfit = breakdown.reduce((acc: number, item: any) => acc + (item.bets * (item.roi / 100)), 0);
          const weightedClv = totalB > 0
            ? breakdown.reduce((acc: number, item: any) => acc + (item.clv * item.bets), 0) / totalB
            : 0;
          const combinedRoi = totalB > 0 ? (totalProfit / totalB) * 100 : 0;

          if (totalB > 0) {
            rows.push({
              market: 'OVERALL COMBINED',
              bets: totalB,
              winRate: '—',
              stake: `${totalB.toLocaleString()} units`,
              profit: `${totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)} units`,
              roi: `${combinedRoi >= 0 ? '+' : ''}${combinedRoi.toFixed(2)}%`,
              clv: `${weightedClv >= 0 ? '+' : ''}${weightedClv.toFixed(2)}%`,
            });
            setOverallRoi(`${combinedRoi >= 0 ? '+' : ''}${combinedRoi.toFixed(2)}%`);
            setOverallClv(`${weightedClv >= 0 ? '+' : ''}${weightedClv.toFixed(2)}%`);
          } else {
            setOverallRoi('—');
            setOverallClv('—');
          }

          setLedgerSummary(rows);
          setTotalBets(totalB);
          setTotalStake(`${totalB.toLocaleString()} Units`);
        }
      } catch (err) {
        console.error('Failed to load track record:', err);
      } finally {
        setLoading(false);
      }
    }
    loadTrackRecord();
  }, []);

  const columns: Column<MarketSummaryRow>[] = [
    { key: 'market', header: 'Market', render: (r) => <span className="font-bold text-[#F0FDF4]">{r.market}</span> },
    { key: 'bets', header: 'Placed Bets', isNumeric: true },
    { key: 'winRate', header: 'Win Rate %', isNumeric: true, render: (r) => <span className="font-mono text-[#10B981] font-bold">{r.winRate}</span> },
    { key: 'stake', header: 'Stake Risk', isNumeric: true },
    { key: 'profit', header: 'Net Profit', isNumeric: true, render: (r) => <span className={`font-mono font-bold ${r.profit.startsWith('-') ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>{r.profit}</span> },
    { key: 'roi', header: 'Exact ROI %', isNumeric: true, render: (r) => <span className={`font-mono font-bold ${r.roi.startsWith('-') ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>{r.roi}</span> },
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
            Audited historical performance of HandicapLab quantitative models across verified settled predictions.
          </p>
        </div>
        <span className="px-2.5 py-1 text-xs font-mono font-bold bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30 rounded-full uppercase">
          Per-Bet Verified
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Placed Bets" value={`${totalBets} Bets`} subtitle="Audited Signals" icon={CheckCircle2} />
        <StatCard title="Total Risk Stake" value={totalStake} subtitle="1.0 Unit Per Bet" icon={TrendingUp} />
        <StatCard title="Overall Exact ROI" value={overallRoi} subtitle="Audited Settlement Payouts" icon={Sparkles} />
        <StatCard title="Overall Pinnacle CLV" value={overallClv} subtitle="Closing Line Invariant" icon={ShieldCheck} />
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-mono uppercase tracking-widest text-[#9CA3AF] font-semibold">
          Market-by-Market Settlement Breakdown Table
        </h3>
        {loading ? (
          <div className="p-8 text-center bg-[#111827] border border-[#1F2937] rounded-xl text-xs font-mono text-[#9CA3AF] animate-pulse">
            Loading audited track record...
          </div>
        ) : totalBets > 0 ? (
          <DataTable columns={columns} data={ledgerSummary} keyExtractor={(r) => r.market} />
        ) : (
          <div className="p-8 text-center bg-[#111827] border border-[#1F2937] rounded-xl font-mono text-xs text-[#9CA3AF] space-y-1">
            <div className="text-sm font-bold text-white">No Settled Predictions Recorded Yet</div>
            <p>Track record metrics populate automatically as model predictions reach final settlement.</p>
          </div>
        )}
      </div>
    </div>
  );
}
