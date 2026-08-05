'use client';

import React, { useState, useEffect } from 'react';
import { GoldService, GoldOddsRecord } from '@/services/goldService';
import { FilterBar } from '@/components/ui/FilterBar';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatCard } from '@/components/ui/StatCard';
import { LineChart, Download, Sparkles, TrendingUp, ShieldCheck } from 'lucide-react';

export default function OddsExplorerPage() {
  const [records, setRecords] = useState<GoldOddsRecord[]>([]);
  const [market, setMarket] = useState('ALL');

  useEffect(() => {
    GoldService.getOddsExplorerRecords().then(setRecords);
  }, []);

  const filtered = market === 'ALL' ? records : records.filter((r) => r.market === market);

  const filters = [
    {
      key: 'market',
      label: 'Market',
      value: market,
      onChange: setMarket,
      options: [
        { label: 'All Markets', value: 'ALL' },
        { label: 'Asian Handicap', value: 'Asian Handicap' },
        { label: 'Over/Under', value: 'Over/Under' },
        { label: 'Moneyline', value: 'Moneyline' },
        { label: 'BTTS', value: 'BTTS' },
      ],
    },
  ];

  const columns: Column<GoldOddsRecord>[] = [
    { key: 'date', header: 'Date', render: (r) => <span className="font-mono text-xs text-[#9CA3AF]">{r.date}</span> },
    { key: 'match', header: 'Fixture & Season', render: (r) => (
        <div>
          <div className="font-bold text-[#F0FDF4] text-xs">{r.match}</div>
          <div className="text-[10px] text-[#9CA3AF] font-mono">{r.competition} ({r.season})</div>
        </div>
      )
    },
    { key: 'market', header: 'Market & Line', render: (r) => (
        <div>
          <span className="font-mono text-xs text-[#10B981] font-bold">{r.market}</span>
          <span className="ml-1 text-[11px] font-mono text-[#9CA3AF]">({r.line})</span>
        </div>
      )
    },
    { key: 'bookmaker', header: 'Bookmaker', render: (r) => <span className="font-mono text-xs font-semibold text-[#F0FDF4]">{r.bookmaker}</span> },
    { key: 'openingOdds', header: 'Open Odds', isNumeric: true, render: (r) => <span className="font-mono text-xs">{r.openingOdds.toFixed(2)}</span> },
    { key: 'closingOdds', header: 'Close Odds', isNumeric: true, render: (r) => <span className="font-mono text-xs font-bold text-[#10B981]">{r.closingOdds.toFixed(2)}</span> },
    { key: 'clvPct', header: 'CLV %', isNumeric: true, render: (r) => (
        <span className={`font-mono text-xs font-bold ${r.clvPct >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
          {r.clvPct >= 0 ? `+${r.clvPct}%` : `${r.clvPct}%`}
        </span>
      )
    },
    { key: 'result', header: 'Result', render: (r) => (
        <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
          r.result === 'WIN' ? 'bg-[#10B981]/20 text-[#10B981]' : r.result === 'PUSH' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' : 'bg-[#EF4444]/20 text-[#EF4444]'
        }`}>
          {r.result}
        </span>
      )
    },
  ];

  const exportCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Date,Match,Market,Line,Bookmaker,OpenOdds,CloseOdds,Result,CLV\n" +
      filtered.map(e => `${e.date},"${e.match}",${e.market},${e.line},${e.bookmaker},${e.openingOdds},${e.closingOdds},${e.result},${e.clvPct}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `handicaplab_odds_explorer_${market}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 bg-gradient-to-r from-[#111827] via-[#1A1F2E] to-[#0B0F0E] border border-[#1F2937] rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <LineChart className="h-5 w-5 text-[#10B981]" />
            <h1 className="text-xl font-bold text-[#F0FDF4]">Odds Explorer (Killer Feature)</h1>
            <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30 rounded uppercase">
              Pro / Elite
            </span>
          </div>
          <p className="text-xs text-[#9CA3AF] mt-1 font-sans">
            Filter 21,660 historical odds records across Pinnacle, SBOBET, and Bet365 with CLV tracking.
          </p>
        </div>

        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-3 py-2 bg-[#10B981] hover:bg-[#34D399] text-black font-mono font-bold text-xs rounded-lg transition-colors shadow-[0_0_12px_rgba(16,185,129,0.3)]"
        >
          <Download className="h-4 w-4" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Records Query" value={filtered.length} subtitle="Historical Odds Rows" icon={LineChart} />
        <StatCard title="Win Rate" value="60.0%" subtitle="Sample Win Rate" change="+10.0%" changeType="positive" icon={TrendingUp} />
        <StatCard title="Average CLV" value="+2.9%" subtitle="Pinnacle Line Benchmark" change="Beating Closing" changeType="positive" icon={ShieldCheck} />
        <StatCard title="ROI (Flat Stake)" value="+12.4%" subtitle="1.0 Unit Per Bet" change="+12.4%" changeType="positive" icon={Sparkles} />
      </div>

      {/* Filter Bar */}
      <FilterBar filters={filters} onReset={() => setMarket('ALL')} />

      {/* Main Odds Data Table */}
      <DataTable columns={columns} data={filtered} keyExtractor={(r) => r.id} />
    </div>
  );
}
